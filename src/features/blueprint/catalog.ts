/**
 * The FLAME blueprint catalog: the only templates, modules and values a Habit
 * Blueprint may use. It lists what the app actually implements, nothing more.
 *
 * Pure module: relative imports only, and only of import-free modules, with no
 * React Native or Expo, so the future MCP server can reuse it. Numeric limits come
 * from the app's own validators.
 */
import { MAX_MINUTES_PER_DAY, MAX_PAGES_PER_DAY, MAX_TARGET_MINUTES } from '../reading/reading.validation';
import { HABIT_COLORS, HABIT_ICONS } from '../../theme/colors';

export const BLUEPRINT_SCHEMA_VERSION = '1.0.0';
export const BLUEPRINT_KIND = 'flame.habit-blueprint';
export const CATALOG_VERSION = '1.0.0';

/** Upper bound for an imported blueprint, in UTF-8 bytes of the raw JSON text. */
export const MAX_BLUEPRINT_BYTES = 256 * 1024;

export const BLUEPRINT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_NOTES = 10;
export const MAX_NOTE_LENGTH = 200;

/** Named icon tokens → the emoji the app stores. Mirrors `HABIT_ICONS` exactly. */
export const ICON_TOKENS = {
  sprout: '🌱',
  water: '💧',
  'book-open': '📚',
  run: '🏃',
  meditate: '🧘',
  strength: '💪',
  salad: '🥗',
  sleep: '😴',
  write: '✍️',
  guitar: '🎸',
  brain: '🧠',
  walk: '🚶',
  teeth: '🦷',
  pill: '💊',
  broom: '🧹',
  'no-phone': '📵',
  sun: '☀️',
  palette: '🎨',
  laptop: '💻',
  gratitude: '🙏',
} as const satisfies Record<string, (typeof HABIT_ICONS)[number]>;

/** Named color tokens → the hex the app stores. Mirrors `HABIT_COLORS` exactly. */
export const COLOR_TOKENS = {
  ember: HABIT_COLORS[0],
  amber: HABIT_COLORS[1],
  mint: HABIT_COLORS[2],
  lagoon: HABIT_COLORS[3],
  sky: HABIT_COLORS[4],
  lilac: HABIT_COLORS[5],
  rose: HABIT_COLORS[6],
  coral: HABIT_COLORS[7],
} as const;

export type IconToken = keyof typeof ICON_TOKENS;
export type ColorToken = keyof typeof COLOR_TOKENS;

/** Same as the app's `NAME_MAX_LENGTH`; a test keeps them in sync. */
export const NAME_LIMIT = 40;

/**
 * Compatibility profile read-more@1.0.0. Every fixed value below must match the
 * blueprint exactly; only the `editable` parts are user choices.
 */
export const READ_MORE_PROFILE = {
  template: { id: 'read-more', version: '1.0.0' },
  /** Stored as `habits.template`. */
  appTemplate: 'read_more',
  /** Read More only supports the Build direction. */
  directions: ['build'],
  scheduleKinds: ['weekdays'],
  metrics: {
    reading_minutes: {
      moduleId: 'metric.duration_minutes',
      version: '1.0.0',
      label: 'Reading time',
      required: true,
      unit: 'minutes',
      entryMode: 'manual',
      constraints: { minimum: 0, maximum: MAX_MINUTES_PER_DAY, integer: true },
      /** Daily target in whole minutes, or null. Guidance only; never completes the habit. */
      goal: { kind: 'daily_target', minimum: 1, maximum: MAX_TARGET_MINUTES, nullable: true },
    },
    pages_read: {
      moduleId: 'metric.count',
      version: '1.0.0',
      label: 'Pages read',
      required: false,
      unit: 'pages',
      entryMode: 'manual',
      constraints: { minimum: 0, maximum: MAX_PAGES_PER_DAY, integer: true },
      goal: null,
    },
  },
  widgets: {
    daily_metric_entry: {
      moduleId: 'widget.metric_entry',
      version: '1.0.0',
      config: { metricIds: ['reading_minutes', 'pages_read'], allowEditToday: true },
    },
    metric_summary: {
      moduleId: 'widget.metric_summary',
      version: '1.0.0',
      config: { metricIds: ['reading_minutes', 'pages_read'], period: 'last_30_days_and_all_time' },
    },
  },
  checkIn: {
    moduleId: 'logic.manual_check_in',
    version: '1.0.0',
    completionPolicy: 'explicit_user_action',
    targetAutomaticallyCompletesHabit: false,
  },
} as const;

export type ReadMoreMetricId = keyof typeof READ_MORE_PROFILE.metrics;
export type ReadMoreWidgetId = keyof typeof READ_MORE_PROFILE.widgets;

/** What a client may learn about the catalog. No user data. */
export const CATALOG_SUMMARY = {
  schemaVersion: BLUEPRINT_SCHEMA_VERSION,
  catalogVersion: CATALOG_VERSION,
  templates: [READ_MORE_PROFILE.template],
  modules: [
    { id: 'metric.duration_minutes', version: '1.0.0' },
    { id: 'metric.count', version: '1.0.0' },
    { id: 'widget.metric_entry', version: '1.0.0' },
    { id: 'widget.metric_summary', version: '1.0.0' },
    { id: 'logic.manual_check_in', version: '1.0.0' },
  ],
  iconTokens: Object.keys(ICON_TOKENS),
  colorTokens: Object.keys(COLOR_TOKENS),
} as const;
