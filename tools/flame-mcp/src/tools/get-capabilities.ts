import {
  BLUEPRINT_KIND,
  BLUEPRINT_SCHEMA_VERSION,
  CATALOG_SUMMARY,
  CATALOG_VERSION,
  MAX_BLUEPRINT_BYTES,
} from '../catalog/index';
import { AVAILABLE_TOOLS, SERVER_VERSION } from '../config';
import { PLANNER_PROMPT_NAME, PLANNER_PROMPT_VERSION } from '../prompts/planner-v1';
import { MAX_DRAFTS } from '../security/input-limits';

/** What this server and the FLAME catalog support. Static; contains no user data. */
export function getCapabilities() {
  return {
    server: { name: 'flame', version: SERVER_VERSION },
    blueprint: { kind: BLUEPRINT_KIND, schemaVersion: BLUEPRINT_SCHEMA_VERSION, catalogVersion: CATALOG_VERSION },
    templates: CATALOG_SUMMARY.templates.map((t) => ({ id: t.id, version: t.version })),
    modules: CATALOG_SUMMARY.modules.map((m) => ({ id: m.id, version: m.version })),
    tools: [...AVAILABLE_TOOLS],
    prompts: [{ name: PLANNER_PROMPT_NAME, version: PLANNER_PROMPT_VERSION }],
    supportedTransferMode: 'manual-json',
    maxBlueprintBytes: MAX_BLUEPRINT_BYTES,
    maxDraftsPerSession: MAX_DRAFTS,
    limitations: [
      'no-live-phone-database',
      'no-cloud-sync',
      'no-apply-to-phone',
      'no-user-data-access',
      'drafts-in-memory-only',
      'export-returns-json-text-only',
    ],
    notes: [
      'FLAME runs on the iPhone with its own local database. This server cannot read or change it.',
      'A blueprint is moved to the phone by hand and the app validates it again before showing a preview.',
      'Only templates and modules listed here exist. Anything else is unsupported.',
      'Drafts live only in this server session and are lost when it restarts.',
      'export_draft returns JSON text to copy; it never writes files or installs anything. The user imports it in FLAME and confirms there.',
    ],
  };
}
