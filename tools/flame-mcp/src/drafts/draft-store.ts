/**
 * In-memory drafts for this server process only. Nothing is written to disk;
 * drafts disappear when the client restarts the server. Every change bumps the
 * revision, which invalidates any earlier validation result.
 */
import { randomBytes } from 'node:crypto';

import { type BlueprintIssue, type BlueprintWarning, type HabitBlueprintV1, validateBlueprint } from '../blueprint/index';
import { MAX_DRAFTS } from '../security/input-limits';
import { ToolError } from '../security/errors';

import {
  type ReadMoreParams,
  type ReadMoreSettings,
  applyParams,
  buildReadMoreBlueprint,
  defaultReadMoreSettings,
} from './read-more-factory';

type ValidationRecord = {
  revision: number;
  valid: boolean;
  errors: BlueprintIssue[];
  warnings: BlueprintWarning[];
  normalized: HabitBlueprintV1 | null;
};

type Draft = {
  id: string;
  templateId: 'read-more';
  templateVersion: '1.0.0';
  revision: number;
  createdAt: string;
  updatedAt: string;
  settings: ReadMoreSettings;
  validation: ValidationRecord | null;
};

export type DraftView = {
  draftId: string;
  template: { id: string; version: string };
  revision: number;
  createdAt: string;
  updatedAt: string;
  blueprint: Record<string, unknown>;
  /** `not_validated` after any change, until validate_draft runs again. */
  validationStatus: 'not_validated' | 'valid' | 'invalid';
  validation: null | { revision: number; valid: boolean; errors: BlueprintIssue[]; warnings: BlueprintWarning[] };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class DraftStore {
  private readonly drafts = new Map<string, Draft>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  get size(): number {
    return this.drafts.size;
  }

  create(params: ReadMoreParams): DraftView {
    if (this.drafts.size >= MAX_DRAFTS) {
      throw new ToolError('too_many_drafts', `This session already holds ${MAX_DRAFTS} drafts. Reuse one with update_draft.`);
    }
    const id = `draft_${randomBytes(16).toString('hex')}`;
    const timestamp = this.now().toISOString();
    const draft: Draft = {
      id,
      templateId: 'read-more',
      templateVersion: '1.0.0',
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: applyParams(defaultReadMoreSettings(), params),
      validation: null,
    };
    this.drafts.set(id, draft);
    // Validate on create so the client sees problems right away.
    this.validateDraft(draft);
    return this.view(draft);
  }

  get(id: string): DraftView {
    return this.view(this.find(id));
  }

  update(id: string, patch: ReadMoreParams): DraftView {
    const draft = this.find(id);
    draft.settings = applyParams(draft.settings, patch);
    draft.revision += 1;
    draft.updatedAt = this.now().toISOString();
    draft.validation = null; // any change invalidates the previous result
    return this.view(draft);
  }

  validate(id: string): DraftView & { normalizedBlueprint: HabitBlueprintV1 | null } {
    const draft = this.find(id);
    const record = this.validateDraft(draft);
    return { ...this.view(draft), normalizedBlueprint: record.normalized ? clone(record.normalized) : null };
  }

  private find(id: string): Draft {
    const draft = this.drafts.get(id);
    if (!draft) throw new ToolError('draft_not_found', 'No draft with this ID exists in the current session.');
    return draft;
  }

  private blueprintOf(draft: Draft): Record<string, unknown> {
    return buildReadMoreBlueprint(draft.id, draft.settings, draft.createdAt);
  }

  private validateDraft(draft: Draft): ValidationRecord {
    const result = validateBlueprint(this.blueprintOf(draft));
    const record: ValidationRecord = {
      revision: draft.revision,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      normalized: result.valid ? result.value : null,
    };
    draft.validation = record;
    return record;
  }

  private view(draft: Draft): DraftView {
    const current = draft.validation && draft.validation.revision === draft.revision ? draft.validation : null;
    return clone({
      draftId: draft.id,
      template: { id: draft.templateId, version: draft.templateVersion },
      revision: draft.revision,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      blueprint: this.blueprintOf(draft),
      validationStatus: current === null ? 'not_validated' : current.valid ? 'valid' : 'invalid',
      validation: current
        ? { revision: current.revision, valid: current.valid, errors: current.errors, warnings: current.warnings }
        : null,
    });
  }
}
