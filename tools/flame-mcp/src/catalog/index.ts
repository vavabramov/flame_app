/**
 * The catalog is owned by the app (src/features/blueprint/catalog.ts) and shared
 * here by relative import, so the server can never advertise something the app
 * doesn't implement. That module is pure and imports only import-free modules.
 */
export {
  BLUEPRINT_KIND,
  BLUEPRINT_SCHEMA_VERSION,
  CATALOG_SUMMARY,
  CATALOG_VERSION,
  COLOR_TOKENS,
  ICON_TOKENS,
  MAX_BLUEPRINT_BYTES,
  NAME_LIMIT,
  READ_MORE_DEFAULTS,
  READ_MORE_PROFILE,
} from '../../../../src/features/blueprint/catalog';
