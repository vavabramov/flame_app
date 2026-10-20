export const SERVER_NAME = 'flame';
export const SERVER_VERSION = '0.1.0';

/** Tools this build actually provides. */
export const AVAILABLE_TOOLS = [
  'get_capabilities',
  'get_templates',
  'create_draft',
  'get_draft',
  'update_draft',
  'validate_draft',
  'export_draft',
] as const;
