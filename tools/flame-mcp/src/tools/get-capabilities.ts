import {
  BLUEPRINT_KIND,
  BLUEPRINT_SCHEMA_VERSION,
  CATALOG_SUMMARY,
  CATALOG_VERSION,
  MAX_BLUEPRINT_BYTES,
} from '../catalog/index';
import { AVAILABLE_TOOLS, SERVER_VERSION } from '../config';

/** What this server and the FLAME catalog support. Static; contains no user data. */
export function getCapabilities() {
  return {
    server: { name: 'flame', version: SERVER_VERSION },
    blueprint: { kind: BLUEPRINT_KIND, schemaVersion: BLUEPRINT_SCHEMA_VERSION, catalogVersion: CATALOG_VERSION },
    templates: CATALOG_SUMMARY.templates.map((t) => ({ id: t.id, version: t.version })),
    modules: CATALOG_SUMMARY.modules.map((m) => ({ id: m.id, version: m.version })),
    tools: [...AVAILABLE_TOOLS],
    supportedTransferMode: 'manual-json',
    maxBlueprintBytes: MAX_BLUEPRINT_BYTES,
    limitations: [
      'no-live-phone-database',
      'no-cloud-sync',
      'no-apply-to-phone',
      'no-user-data-access',
      'drafts-not-available-yet',
    ],
    notes: [
      'FLAME runs on the iPhone with its own local database. This server cannot read or change it.',
      'A blueprint is moved to the phone by hand and the app validates it again before showing a preview.',
      'Only templates and modules listed here exist. Anything else is unsupported.',
    ],
  };
}
