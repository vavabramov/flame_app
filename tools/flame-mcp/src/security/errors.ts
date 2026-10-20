/** Tool-level errors with a stable code. Never include user text or blueprints. */
export type ToolErrorCode = 'draft_not_found' | 'too_many_drafts' | 'draft_invalid' | 'export_too_large';

export class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
    /** Optional machine-readable details, e.g. validation errors. Never user text. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
