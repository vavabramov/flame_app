/**
 * Strict runtime validation of an untrusted Habit Blueprint v1.
 *
 * - Every object is checked for unknown keys at every level, including
 *   prototype-polluting names like `__proto__` (JSON.parse makes them own keys).
 * - Versions, template, modules, tokens and fixed profile values must match the
 *   catalog exactly. Nothing unknown is silently converted or dropped.
 * - Never mutates or reuses the input: the normalized value is built fresh.
 * - Errors carry a stable `code`, a `path` and a friendly `message`.
 *
 * Pure: relative imports of import-free modules only (see catalog.ts).
 */
import {
  BLUEPRINT_ID_PATTERN,
  BLUEPRINT_KIND,
  BLUEPRINT_SCHEMA_VERSION,
  CATALOG_VERSION,
  COLOR_TOKENS,
  ICON_TOKENS,
  MAX_BLUEPRINT_BYTES,
  MAX_NOTE_LENGTH,
  MAX_NOTES,
  NAME_LIMIT,
  READ_MORE_PROFILE,
  type ColorToken,
  type IconToken,
  type ReadMoreMetricId,
  type ReadMoreWidgetId,
} from './catalog';
import {
  type BlueprintErrorCode,
  type BlueprintIssue,
  type BlueprintValidationResult,
  type BlueprintWarning,
  type HabitBlueprintV1,
  type MetricEntryWidget,
  type MetricSummaryWidget,
  type PagesReadMetric,
  type ReadingMinutesMetric,
} from './blueprint.types';

type Json = unknown;
type Obj = Record<string, Json>;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
// Control characters have no place in a habit name shown as plain text.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

class Checker {
  readonly errors: BlueprintIssue[] = [];
  readonly warnings: BlueprintWarning[] = [];
  /** Paths already reported as missing; later checks on them stay quiet. */
  private readonly missing = new Set<string>();

  fail(code: BlueprintErrorCode, path: string, message: string): void {
    if (code === 'missing_key') this.missing.add(path);
    else if (this.missing.has(path)) return;
    this.errors.push({ code, path, message });
  }

  /** A plain object with exactly the allowed keys (optional ones may be absent). */
  object(value: Json, path: string, required: readonly string[], optional: readonly string[] = []): Obj | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.fail('not_object', path, 'Expected an object.');
      return null;
    }
    const obj = value as Obj;
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) this.fail('unknown_key', `${path}/${key}`, `“${key}” isn’t a supported field.`);
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        this.fail('missing_key', `${path}/${key}`, `“${key}” is required.`);
      }
    }
    return obj;
  }

  has(obj: Obj, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  /** The value must equal `expected` exactly (strings, numbers, booleans, null). */
  exact(value: Json, expected: string | number | boolean | null, path: string, code: BlueprintErrorCode, message: string) {
    if (value !== expected) this.fail(code, path, message);
  }

  string(value: Json, path: string): value is string {
    if (typeof value !== 'string') {
      this.fail('invalid_type', path, 'Expected text.');
      return false;
    }
    return true;
  }

  integer(value: Json, path: string, min: number, max: number, what: string): value is number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      this.fail('invalid_type', path, `${what} must be a number.`);
      return false;
    }
    if (!Number.isInteger(value)) {
      this.fail('not_integer', path, `${what} must be a whole number.`);
      return false;
    }
    if (value < min || value > max) {
      this.fail('out_of_range', path, `${what} must be between ${min} and ${max}.`);
      return false;
    }
    return true;
  }

  array(value: Json, path: string): Json[] | null {
    if (!Array.isArray(value)) {
      this.fail('invalid_type', path, 'Expected a list.');
      return null;
    }
    return value;
  }
}

function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // surrogate pair
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Size-checks and parses raw JSON text, then validates it. For imports. */
export function parseBlueprintJson(text: string): BlueprintValidationResult {
  if (utf8ByteLength(text) > MAX_BLUEPRINT_BYTES) {
    return invalid([{ code: 'too_large', path: '', message: `The file is larger than ${MAX_BLUEPRINT_BYTES / 1024} KB.` }]);
  }
  let parsed: Json;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid([{ code: 'invalid_json', path: '', message: 'This isn’t valid JSON.' }]);
  }
  return validateBlueprint(parsed);
}

function invalid(errors: BlueprintIssue[], warnings: BlueprintWarning[] = []): BlueprintValidationResult {
  return { valid: false, value: null, errors, warnings };
}

export function validateBlueprint(input: Json): BlueprintValidationResult {
  const c = new Checker();
  const root = c.object(
    input,
    '',
    ['schemaVersion', 'kind', 'blueprintId', 'catalogVersion', 'template', 'habit', 'metrics', 'widgets', 'checkIn', 'presentation'],
    ['metadata'],
  );
  if (!root) return invalid(c.errors);

  // Versions first: an unknown schema is rejected as such, never auto-converted.
  c.exact(root.schemaVersion, BLUEPRINT_SCHEMA_VERSION, '/schemaVersion', 'unsupported_schema_version',
    `Only blueprint schema ${BLUEPRINT_SCHEMA_VERSION} is supported.`);
  c.exact(root.kind, BLUEPRINT_KIND, '/kind', 'unsupported_kind', `“kind” must be “${BLUEPRINT_KIND}”.`);
  c.exact(root.catalogVersion, CATALOG_VERSION, '/catalogVersion', 'unsupported_catalog_version',
    `Only catalog ${CATALOG_VERSION} is supported.`);
  if (c.string(root.blueprintId, '/blueprintId') && !BLUEPRINT_ID_PATTERN.test(root.blueprintId)) {
    c.fail('invalid_id', '/blueprintId', 'Blueprint IDs use 1–64 letters, digits, “-” or “_”.');
  }

  const template = c.object(root.template, '/template', ['id', 'version']);
  if (template) {
    if (template.id !== READ_MORE_PROFILE.template.id) {
      c.fail('unknown_template', '/template/id', 'Only the “read-more” template is available.');
    } else {
      c.exact(template.version, READ_MORE_PROFILE.template.version, '/template/version', 'unsupported_template_version',
        `Only read-more ${READ_MORE_PROFILE.template.version} is supported.`);
    }
  }

  const habit = validateHabit(c, root.habit);
  const metrics = validateMetrics(c, root.metrics);
  const widgets = validateWidgets(c, root.widgets, metrics.ids);
  validateCheckIn(c, root.checkIn);
  const presentation = validatePresentation(c, root.presentation);
  const metadata = c.has(root, 'metadata') ? validateMetadata(c, root.metadata) : undefined;

  if (c.errors.length > 0 || !habit || !metrics.value || !widgets || !presentation) {
    return invalid(c.errors, c.warnings);
  }
  if (habit.reminder) {
    c.warnings.push({
      code: 'reminder_needs_permission',
      path: '/habit/reminder',
      message: 'The reminder works once notifications are allowed for FLAME on the iPhone.',
    });
  }

  const value: HabitBlueprintV1 = {
    schemaVersion: '1.0.0',
    kind: 'flame.habit-blueprint',
    blueprintId: root.blueprintId as string,
    catalogVersion: '1.0.0',
    template: { id: 'read-more', version: '1.0.0' },
    habit,
    metrics: metrics.value,
    widgets,
    checkIn: {
      moduleId: 'logic.manual_check_in',
      version: '1.0.0',
      completionPolicy: 'explicit_user_action',
      targetAutomaticallyCompletesHabit: false,
    },
    presentation,
    ...(metadata ? { metadata } : {}),
  };
  return { valid: true, value, errors: [], warnings: c.warnings };
}

function validateHabit(c: Checker, input: Json): HabitBlueprintV1['habit'] | null {
  const habit = c.object(input, '/habit', ['name', 'direction', 'schedule', 'reminder']);
  if (!habit) return null;
  const before = c.errors.length;

  let name = '';
  if (c.string(habit.name, '/habit/name')) {
    name = habit.name.trim().replace(/\s+/g, ' ');
    if (name.length === 0) c.fail('invalid_name', '/habit/name', 'The habit needs a name.');
    else if (name.length > NAME_LIMIT) c.fail('too_long', '/habit/name', `Keep the name under ${NAME_LIMIT} characters.`);
    else if (CONTROL_CHARS.test(name)) c.fail('invalid_name', '/habit/name', 'The name contains unsupported characters.');
  }

  if (habit.direction === 'break') {
    c.fail('incompatible_direction', '/habit/direction', 'Read More is a Build habit. Break isn’t supported for this template.');
  } else if (habit.direction !== 'build') {
    c.fail('unsupported_value', '/habit/direction', 'Direction must be “build”.');
  }

  const days: number[] = [];
  const schedule = c.object(habit.schedule, '/habit/schedule', ['kind', 'days']);
  if (schedule) {
    c.exact(schedule.kind, 'weekdays', '/habit/schedule/kind', 'unsupported_value', 'Only weekday schedules are supported.');
    const list = c.array(schedule.days, '/habit/schedule/days');
    if (list) {
      if (list.length === 0) c.fail('missing_item', '/habit/schedule/days', 'Pick at least one day.');
      list.forEach((day, i) => {
        const path = `/habit/schedule/days/${i}`;
        if (!c.integer(day, path, 0, 6, 'A weekday (0 = Sunday … 6 = Saturday)')) return;
        if (days.includes(day)) c.fail('duplicate', path, `Day ${day} is listed twice.`);
        else days.push(day);
      });
    }
  }

  let reminder: HabitBlueprintV1['habit']['reminder'] = null;
  if (habit.reminder !== null && c.has(habit, 'reminder')) {
    const r = c.object(habit.reminder, '/habit/reminder', ['localTime']);
    if (r && c.string(r.localTime, '/habit/reminder/localTime')) {
      if (!TIME_PATTERN.test(r.localTime)) {
        c.fail('invalid_time', '/habit/reminder/localTime', 'Use a 24-hour time like “08:30”.');
      } else {
        reminder = { localTime: r.localTime };
      }
    }
  }

  if (c.errors.length > before) return null;
  return {
    name,
    direction: 'build',
    schedule: { kind: 'weekdays', days: [...days].sort((a, b) => a - b) },
    reminder,
  };
}

function validateMetrics(
  c: Checker,
  input: Json,
): { value: HabitBlueprintV1['metrics'] | null; ids: Set<ReadMoreMetricId> } {
  const ids = new Set<ReadMoreMetricId>();
  const list = c.array(input, '/metrics');
  if (!list) return { value: null, ids };
  const before = c.errors.length;
  const out: HabitBlueprintV1['metrics'] = [];

  list.forEach((item, i) => {
    const path = `/metrics/${i}`;
    const m = c.object(item, path, ['id', 'moduleId', 'version', 'label', 'required', 'unit', 'entryMode', 'constraints', 'goal']);
    if (!m) return;
    if (m.id !== 'reading_minutes' && m.id !== 'pages_read') {
      c.fail('unknown_module', `${path}/id`, 'Read More tracks only “reading_minutes” and “pages_read”.');
      return;
    }
    const id = m.id as ReadMoreMetricId;
    if (ids.has(id)) {
      c.fail('duplicate', `${path}/id`, `Metric “${id}” is listed twice.`);
      return;
    }
    ids.add(id);
    const profile = READ_MORE_PROFILE.metrics[id];

    if (m.moduleId !== profile.moduleId) {
      c.fail('unknown_module', `${path}/moduleId`, `“${id}” uses module “${profile.moduleId}”.`);
    } else {
      c.exact(m.version, profile.version, `${path}/version`, 'unsupported_module_version', `Only ${profile.moduleId} ${profile.version} is supported.`);
    }
    c.exact(m.label, profile.label, `${path}/label`, 'unsupported_value', `The label for “${id}” is “${profile.label}”.`);
    c.exact(m.required, profile.required, `${path}/required`, 'unsupported_value',
      profile.required ? 'Reading time is always required.' : 'Pages are always optional.');
    c.exact(m.unit, profile.unit, `${path}/unit`, 'unsupported_value', `The unit for “${id}” is “${profile.unit}”.`);
    c.exact(m.entryMode, profile.entryMode, `${path}/entryMode`, 'unsupported_value', 'Only manual entry is supported.');

    const k = c.object(m.constraints, `${path}/constraints`, ['minimum', 'maximum', 'integer']);
    if (k) {
      c.exact(k.minimum, profile.constraints.minimum, `${path}/constraints/minimum`, 'unsupported_value', `Minimum is ${profile.constraints.minimum}.`);
      c.exact(k.maximum, profile.constraints.maximum, `${path}/constraints/maximum`, 'unsupported_value', `Maximum is ${profile.constraints.maximum}.`);
      c.exact(k.integer, true, `${path}/constraints/integer`, 'unsupported_value', 'Values are whole numbers.');
    }

    let goal: ReadingMinutesMetric['goal'] = null;
    if (id === 'reading_minutes') {
      if (m.goal !== null && c.has(m, 'goal')) {
        const g = c.object(m.goal, `${path}/goal`, ['kind', 'value']);
        if (g) {
          c.exact(g.kind, 'daily_target', `${path}/goal/kind`, 'unsupported_value', 'Only a daily target is supported.');
          const { minimum, maximum } = profile.goal as { minimum: number; maximum: number };
          if (c.integer(g.value, `${path}/goal/value`, minimum, maximum, 'The daily target in minutes')) {
            goal = { kind: 'daily_target', value: g.value };
          }
        }
      }
      out.push({
        id: 'reading_minutes',
        moduleId: 'metric.duration_minutes',
        version: '1.0.0',
        label: 'Reading time',
        required: true,
        unit: 'minutes',
        entryMode: 'manual',
        constraints: { minimum: 0, maximum: 1440, integer: true },
        goal,
      } satisfies ReadingMinutesMetric);
    } else {
      if (c.has(m, 'goal') && m.goal !== null) c.fail('unsupported_value', `${path}/goal`, 'Pages can’t have a goal.');
      out.push({
        id: 'pages_read',
        moduleId: 'metric.count',
        version: '1.0.0',
        label: 'Pages read',
        required: false,
        unit: 'pages',
        entryMode: 'manual',
        constraints: { minimum: 0, maximum: 10000, integer: true },
        goal: null,
      } satisfies PagesReadMetric);
    }
  });

  // The app always shows both fields, so both metrics must be declared.
  for (const id of Object.keys(READ_MORE_PROFILE.metrics) as ReadMoreMetricId[]) {
    if (!ids.has(id)) c.fail('missing_item', '/metrics', `Read More needs the “${id}” metric.`);
  }
  return { value: c.errors.length > before ? null : out, ids };
}

function validateMetricIds(c: Checker, input: Json, path: string, declared: Set<ReadMoreMetricId>, expected: readonly string[]) {
  const list = c.array(input, path);
  if (!list) return;
  const seen = new Set<string>();
  list.forEach((id, i) => {
    if (typeof id !== 'string') {
      c.fail('invalid_type', `${path}/${i}`, 'Expected a metric ID.');
      return;
    }
    if (seen.has(id)) c.fail('duplicate', `${path}/${i}`, `“${id}” is listed twice.`);
    seen.add(id);
    if (!declared.has(id as ReadMoreMetricId)) c.fail('unknown_reference', `${path}/${i}`, `No metric “${id}” is declared.`);
  });
  for (const id of expected) {
    if (!seen.has(id)) c.fail('missing_item', path, `This widget always shows “${id}”.`);
  }
}

function validateWidgets(
  c: Checker,
  input: Json,
  declared: Set<ReadMoreMetricId>,
): HabitBlueprintV1['widgets'] | null {
  const list = c.array(input, '/widgets');
  if (!list) return null;
  const before = c.errors.length;
  const ids = new Set<ReadMoreWidgetId>();

  list.forEach((item, i) => {
    const path = `/widgets/${i}`;
    const w = c.object(item, path, ['id', 'moduleId', 'version', 'config']);
    if (!w) return;
    if (w.id !== 'daily_metric_entry' && w.id !== 'metric_summary') {
      c.fail('unknown_module', `${path}/id`, 'Read More uses only “daily_metric_entry” and “metric_summary”.');
      return;
    }
    const id = w.id as ReadMoreWidgetId;
    if (ids.has(id)) {
      c.fail('duplicate', `${path}/id`, `Widget “${id}” is listed twice.`);
      return;
    }
    ids.add(id);
    const profile = READ_MORE_PROFILE.widgets[id];
    if (w.moduleId !== profile.moduleId) {
      c.fail('unknown_module', `${path}/moduleId`, `“${id}” uses module “${profile.moduleId}”.`);
    } else {
      c.exact(w.version, profile.version, `${path}/version`, 'unsupported_module_version', `Only ${profile.moduleId} ${profile.version} is supported.`);
    }

    if (id === 'daily_metric_entry') {
      const cfg = c.object(w.config, `${path}/config`, ['metricIds', 'allowEditToday']);
      if (cfg) {
        validateMetricIds(c, cfg.metricIds, `${path}/config/metricIds`, declared, profile.config.metricIds);
        c.exact(cfg.allowEditToday, true, `${path}/config/allowEditToday`, 'unsupported_value', 'Today’s entry is always editable.');
      }
    } else {
      const cfg = c.object(w.config, `${path}/config`, ['metricIds', 'period']);
      if (cfg) {
        validateMetricIds(c, cfg.metricIds, `${path}/config/metricIds`, declared, profile.config.metricIds);
        c.exact(cfg.period, READ_MORE_PROFILE.widgets.metric_summary.config.period, `${path}/config/period`, 'unsupported_value',
          'The summary covers the last 30 days and all time.');
      }
    }
  });

  for (const id of Object.keys(READ_MORE_PROFILE.widgets) as ReadMoreWidgetId[]) {
    if (!ids.has(id)) c.fail('missing_item', '/widgets', `Read More needs the “${id}” widget.`);
  }
  if (c.errors.length > before) return null;

  const entry: MetricEntryWidget = {
    id: 'daily_metric_entry',
    moduleId: 'widget.metric_entry',
    version: '1.0.0',
    config: { metricIds: ['reading_minutes', 'pages_read'], allowEditToday: true },
  };
  const summary: MetricSummaryWidget = {
    id: 'metric_summary',
    moduleId: 'widget.metric_summary',
    version: '1.0.0',
    config: { metricIds: ['reading_minutes', 'pages_read'], period: 'last_30_days_and_all_time' },
  };
  return [entry, summary];
}

function validateCheckIn(c: Checker, input: Json): void {
  const k = c.object(input, '/checkIn', ['moduleId', 'version', 'completionPolicy', 'targetAutomaticallyCompletesHabit']);
  if (!k) return;
  const p = READ_MORE_PROFILE.checkIn;
  if (k.moduleId !== p.moduleId) c.fail('unknown_module', '/checkIn/moduleId', `Check-ins use “${p.moduleId}”.`);
  else c.exact(k.version, p.version, '/checkIn/version', 'unsupported_module_version', `Only ${p.moduleId} ${p.version} is supported.`);
  c.exact(k.completionPolicy, p.completionPolicy, '/checkIn/completionPolicy', 'unsupported_value',
    'The habit is completed only by an explicit check-in.');
  c.exact(k.targetAutomaticallyCompletesHabit, false, '/checkIn/targetAutomaticallyCompletesHabit', 'unsupported_value',
    'Reaching the reading target never completes the habit automatically.');
}

function validatePresentation(c: Checker, input: Json): HabitBlueprintV1['presentation'] | null {
  const p = c.object(input, '/presentation', ['icon', 'colorToken']);
  if (!p) return null;
  const okIcon = typeof p.icon === 'string' && Object.prototype.hasOwnProperty.call(ICON_TOKENS, p.icon);
  const okColor = typeof p.colorToken === 'string' && Object.prototype.hasOwnProperty.call(COLOR_TOKENS, p.colorToken);
  if (!okIcon) c.fail('unknown_icon', '/presentation/icon', 'Choose one of the catalog icon tokens.');
  if (!okColor) c.fail('unknown_color', '/presentation/colorToken', 'Choose one of the catalog color tokens.');
  return okIcon && okColor ? { icon: p.icon as IconToken, colorToken: p.colorToken as ColorToken } : null;
}

function validateMetadata(c: Checker, input: Json): HabitBlueprintV1['metadata'] | undefined {
  const m = c.object(input, '/metadata', ['createdBy'], ['createdAt', 'notes']);
  if (!m) return undefined;
  if (m.createdBy !== 'ai-draft' && m.createdBy !== 'manual') {
    c.fail('unsupported_value', '/metadata/createdBy', '“createdBy” must be “ai-draft” or “manual”.');
  }
  // createdAt is informational: checked for format, never stored as habit data.
  if (c.has(m, 'createdAt') && c.string(m.createdAt, '/metadata/createdAt') && !ISO_TIMESTAMP.test(m.createdAt)) {
    c.fail('invalid_timestamp', '/metadata/createdAt', 'Use an ISO 8601 timestamp.');
  }
  const notes: string[] = [];
  if (c.has(m, 'notes')) {
    const list = c.array(m.notes, '/metadata/notes');
    if (list) {
      if (list.length > MAX_NOTES) c.fail('too_many', '/metadata/notes', `At most ${MAX_NOTES} notes.`);
      list.slice(0, MAX_NOTES).forEach((note, i) => {
        if (!c.string(note, `/metadata/notes/${i}`)) return;
        if (note.length > MAX_NOTE_LENGTH) c.fail('too_long', `/metadata/notes/${i}`, `Notes are at most ${MAX_NOTE_LENGTH} characters.`);
        else notes.push(note);
      });
    }
  }
  return {
    createdBy: m.createdBy === 'manual' ? 'manual' : 'ai-draft',
    ...(typeof m.createdAt === 'string' ? { createdAt: m.createdAt } : {}),
    ...(c.has(m, 'notes') ? { notes } : {}),
  };
}
