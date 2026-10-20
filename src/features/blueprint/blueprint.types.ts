/**
 * Habit Blueprint v1: a declarative, versioned description of a habit to create.
 * Not a program: no code, SQL, expressions, URLs or paths. TypeScript types don't
 * validate untrusted JSON; `validateBlueprint` does.
 */
import { type ColorToken, type IconToken } from './catalog';

export type ReadingMinutesMetric = {
  id: 'reading_minutes';
  moduleId: 'metric.duration_minutes';
  version: '1.0.0';
  label: 'Reading time';
  required: true;
  unit: 'minutes';
  entryMode: 'manual';
  constraints: { minimum: 0; maximum: 1440; integer: true };
  goal: null | { kind: 'daily_target'; value: number };
};

export type PagesReadMetric = {
  id: 'pages_read';
  moduleId: 'metric.count';
  version: '1.0.0';
  label: 'Pages read';
  required: false;
  unit: 'pages';
  entryMode: 'manual';
  constraints: { minimum: 0; maximum: 10000; integer: true };
  goal: null;
};

export type MetricEntryWidget = {
  id: 'daily_metric_entry';
  moduleId: 'widget.metric_entry';
  version: '1.0.0';
  config: { metricIds: ('reading_minutes' | 'pages_read')[]; allowEditToday: true };
};

export type MetricSummaryWidget = {
  id: 'metric_summary';
  moduleId: 'widget.metric_summary';
  version: '1.0.0';
  config: { metricIds: ('reading_minutes' | 'pages_read')[]; period: 'last_30_days_and_all_time' };
};

export type HabitBlueprintV1 = {
  schemaVersion: '1.0.0';
  kind: 'flame.habit-blueprint';
  blueprintId: string;
  catalogVersion: '1.0.0';
  template: { id: 'read-more'; version: '1.0.0' };
  habit: {
    name: string;
    direction: 'build';
    /** Weekdays, 0 = Sunday … 6 = Saturday. */
    schedule: { kind: 'weekdays'; days: number[] };
    reminder: null | { localTime: string };
  };
  metrics: (ReadingMinutesMetric | PagesReadMetric)[];
  widgets: (MetricEntryWidget | MetricSummaryWidget)[];
  checkIn: {
    moduleId: 'logic.manual_check_in';
    version: '1.0.0';
    completionPolicy: 'explicit_user_action';
    targetAutomaticallyCompletesHabit: false;
  };
  presentation: { icon: IconToken; colorToken: ColorToken };
  metadata?: { createdBy: 'ai-draft' | 'manual'; createdAt?: string; notes?: string[] };
};

/** Stable machine-readable error codes. Messages may change; codes may not. */
export type BlueprintErrorCode =
  | 'too_large'
  | 'invalid_json'
  | 'not_object'
  | 'unknown_key'
  | 'missing_key'
  | 'invalid_type'
  | 'unsupported_schema_version'
  | 'unsupported_kind'
  | 'unsupported_catalog_version'
  | 'unknown_template'
  | 'unsupported_template_version'
  | 'unknown_module'
  | 'unsupported_module_version'
  | 'unsupported_value'
  | 'incompatible_direction'
  | 'invalid_id'
  | 'invalid_name'
  | 'out_of_range'
  | 'not_integer'
  | 'duplicate'
  | 'missing_item'
  | 'unknown_reference'
  | 'invalid_time'
  | 'invalid_timestamp'
  | 'unknown_icon'
  | 'unknown_color'
  | 'too_long'
  | 'too_many';

export type BlueprintIssue = {
  code: BlueprintErrorCode;
  /** JSON-pointer-like location, e.g. `/habit/schedule/days/2`. */
  path: string;
  message: string;
};

export type BlueprintWarningCode = 'reminder_needs_permission';
export type BlueprintWarning = { code: BlueprintWarningCode; path: string; message: string };

export type BlueprintValidationResult =
  | { valid: true; value: HabitBlueprintV1; errors: []; warnings: BlueprintWarning[] }
  | { valid: false; value: null; errors: BlueprintIssue[]; warnings: BlueprintWarning[] };
