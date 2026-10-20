import Ajv from 'ajv';

import { READ_MORE_TEMPLATE } from '@/features/habits/habit-template';
import { NAME_MAX_LENGTH } from '@/features/habits/habit.validation';
import { MAX_MINUTES_PER_DAY, MAX_PAGES_PER_DAY, MAX_TARGET_MINUTES } from '@/features/reading/reading.validation';
import { HABIT_COLORS, HABIT_ICONS } from '@/theme/colors';

import fixture from './__fixtures__/read-more.v1.json';
import { type BlueprintErrorCode } from './blueprint.types';
import {
  CATALOG_SUMMARY,
  COLOR_TOKENS,
  ICON_TOKENS,
  MAX_BLUEPRINT_BYTES,
  NAME_LIMIT,
  READ_MORE_DEFAULTS,
  READ_MORE_PROFILE,
} from './catalog';
import schema from './schema/habit-blueprint.v1.schema.json';
import { parseBlueprintJson, validateBlueprint } from './validate-blueprint';

type Doc = Record<string, any>;

/** A fresh deep copy of the valid fixture, changed by `mutate`. */
const variant = (mutate: (doc: Doc) => void = () => undefined): Doc => {
  const doc = JSON.parse(JSON.stringify(fixture)) as Doc;
  mutate(doc);
  return doc;
};

const codesOf = (doc: unknown): BlueprintErrorCode[] => {
  const result = validateBlueprint(doc);
  return result.valid ? [] : result.errors.map((e) => e.code);
};

const ajv = new Ajv({ allErrors: true, strict: true });
const schemaAccepts = ajv.compile(schema);

describe('valid Read More blueprint', () => {
  it('passes and returns a normalized copy', () => {
    const input = variant((d) => {
      d.habit.name = '  Read   before bed ';
      d.habit.schedule.days = [5, 1, 3];
    });
    const result = validateBlueprint(input);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.value?.habit.name).toBe('Read before bed');
    expect(result.value?.habit.schedule.days).toEqual([1, 3, 5]);
    expect(result.value).not.toBe(input);
    expect(input.habit.name).toBe('  Read   before bed '); // input untouched
  });

  it('accepts a reminder, a null goal and no metadata', () => {
    const result = validateBlueprint(
      variant((d) => {
        d.habit.reminder = { localTime: '21:30' };
        d.metrics[0].goal = null;
        delete d.metadata;
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.code)).toEqual(['reminder_needs_permission']);
  });

  it('accepts metrics and widgets in any order', () => {
    expect(codesOf(variant((d) => {
      d.metrics.reverse();
      d.widgets.reverse();
      d.widgets[0].config.metricIds.reverse();
    }))).toEqual([]);
  });

  it('parses raw JSON text', () => {
    expect(parseBlueprintJson(JSON.stringify(fixture)).valid).toBe(true);
  });
});

describe('spec scenarios (§14)', () => {
  it('4. rejects an unknown widget module like widget.custom_code', () => {
    expect(codesOf(variant((d) => d.widgets.push({ id: 'x', moduleId: 'widget.custom_code', version: '1.0.0', config: {} }))))
      .toContain('unknown_module');
    expect(codesOf(variant((d) => (d.widgets[0].moduleId = 'widget.custom_code')))).toContain('unknown_module');
  });

  it('5. rejects extra fields such as postImportCommand, at any level', () => {
    expect(codesOf(variant((d) => (d.postImportCommand = 'rm -rf /')))).toEqual(['unknown_key']);
    expect(codesOf(variant((d) => (d.habit.sql = 'DROP TABLE habits')))).toEqual(['unknown_key']);
    expect(codesOf(variant((d) => (d.widgets[1].config.script = 'alert(1)')))).toEqual(['unknown_key']);
    expect(codesOf(variant((d) => (d.metrics[0].constraints.formula = 'x*2')))).toEqual(['unknown_key']);
  });

  it('6. rejects Read More as a Break habit instead of rewriting it', () => {
    const result = validateBlueprint(variant((d) => (d.habit.direction = 'break')));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([expect.objectContaining({ code: 'incompatible_direction', path: '/habit/direction' })]);
  });

  it.each([
    ['negative', -1, 'out_of_range'],
    ['fractional', 7.5, 'not_integer'],
    ['a string', '15', 'invalid_type'],
    ['above the limit', MAX_TARGET_MINUTES + 1, 'out_of_range'],
    ['zero', 0, 'out_of_range'],
  ])('7. rejects a target that is %s', (_label, value, code) => {
    expect(codesOf(variant((d) => (d.metrics[0].goal.value = value)))).toEqual([code]);
  });

  it('7. rejects changed minute or page limits', () => {
    expect(codesOf(variant((d) => (d.metrics[0].constraints.minimum = -1)))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[0].constraints.maximum = 5000)))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[1].constraints.integer = false)))).toEqual(['unsupported_value']);
  });

  it.each([
    ['day 7', [1, 7], 'out_of_range'],
    ['day -1', [-1], 'out_of_range'],
    ['duplicates', [1, 1, 3], 'duplicate'],
    ['a string day', ['1'], 'invalid_type'],
    ['a fractional day', [1.5], 'not_integer'],
    ['no days', [], 'missing_item'],
  ])('8. rejects a schedule with %s', (_label, days, code) => {
    expect(codesOf(variant((d) => (d.habit.schedule.days = days)))).toEqual([code]);
  });

  it('9. rejects an unknown schemaVersion without converting it', () => {
    expect(codesOf(variant((d) => (d.schemaVersion = '2.0.0')))).toEqual(['unsupported_schema_version']);
    expect(codesOf(variant((d) => (d.schemaVersion = '0.9.0')))).toEqual(['unsupported_schema_version']);
  });
});

describe('versions, template and modules', () => {
  it.each([
    ['kind', (d: Doc) => (d.kind = 'flame.something'), 'unsupported_kind'],
    ['catalogVersion', (d: Doc) => (d.catalogVersion = '1.1.0'), 'unsupported_catalog_version'],
    ['template id', (d: Doc) => (d.template.id = 'learn-language'), 'unknown_template'],
    ['template version', (d: Doc) => (d.template.version = '1.1.0'), 'unsupported_template_version'],
    ['metric module version', (d: Doc) => (d.metrics[0].version = '2.0.0'), 'unsupported_module_version'],
    ['widget module version', (d: Doc) => (d.widgets[1].version = '0.1.0'), 'unsupported_module_version'],
    ['check-in module', (d: Doc) => (d.checkIn.moduleId = 'logic.auto_check_in'), 'unknown_module'],
    ['metric module', (d: Doc) => (d.metrics[1].moduleId = 'metric.distance'), 'unknown_module'],
  ])('rejects an unsupported %s', (_label, mutate, code) => {
    expect(codesOf(variant(mutate))).toEqual([code]);
  });

  it('keeps the target from ever completing the habit', () => {
    expect(codesOf(variant((d) => (d.checkIn.targetAutomaticallyCompletesHabit = true)))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.checkIn.completionPolicy = 'target_reached')))).toEqual(['unsupported_value']);
  });

  it('rejects unsupported metric settings and goals', () => {
    expect(codesOf(variant((d) => (d.metrics[0].required = false)))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[1].unit = 'chapters')))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[0].entryMode = 'timer')))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[0].label = 'Anything I like')))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[0].goal.kind = 'weekly_quota')))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metrics[1].goal = { kind: 'daily_target', value: 10 })))).toEqual(['unsupported_value']);
  });

  it('requires both metrics and both widgets, each once', () => {
    expect(codesOf(variant((d) => d.metrics.pop()))).toEqual(['missing_item', 'unknown_reference', 'unknown_reference']);
    expect(codesOf(variant((d) => d.metrics.push(JSON.parse(JSON.stringify(d.metrics[0])))))).toEqual(['duplicate']);
    expect(codesOf(variant((d) => d.widgets.pop()))).toEqual(['missing_item']);
    expect(codesOf(variant((d) => (d.widgets[1] = JSON.parse(JSON.stringify(d.widgets[0])))))).toEqual(['duplicate', 'missing_item']);
  });

  it('checks widget metric references', () => {
    expect(codesOf(variant((d) => (d.widgets[0].config.metricIds = ['reading_minutes', 'steps'])))).toEqual([
      'unknown_reference',
      'missing_item',
    ]);
    expect(codesOf(variant((d) => (d.widgets[0].config.metricIds = ['reading_minutes', 'reading_minutes'])))).toEqual([
      'duplicate',
      'missing_item',
    ]);
    expect(codesOf(variant((d) => (d.widgets[1].config.period = 'current_streak_window')))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.widgets[0].config.allowEditToday = false)))).toEqual(['unsupported_value']);
  });
});

describe('habit fields', () => {
  it('validates the name like the app does', () => {
    expect(codesOf(variant((d) => (d.habit.name = '   ')))).toEqual(['invalid_name']);
    expect(codesOf(variant((d) => (d.habit.name = 'x'.repeat(NAME_LIMIT + 1))))).toEqual(['too_long']);
    expect(codesOf(variant((d) => (d.habit.name = 'x'.repeat(NAME_LIMIT))))).toEqual([]);
    expect(codesOf(variant((d) => (d.habit.name = 'Read\u0000now')))).toEqual(['invalid_name']);
    expect(codesOf(variant((d) => (d.habit.name = 42)))).toEqual(['invalid_type']);
  });

  it.each(['24:00', '7:30', '07:60', '0730', ''])('rejects reminder time %j', (time) => {
    expect(codesOf(variant((d) => (d.habit.reminder = { localTime: time })))).toEqual(['invalid_time']);
  });

  it('rejects unknown icons and colors, including raw emoji and hex', () => {
    expect(codesOf(variant((d) => (d.presentation.icon = '📚')))).toEqual(['unknown_icon']);
    expect(codesOf(variant((d) => (d.presentation.icon = 'toString')))).toEqual(['unknown_icon']);
    expect(codesOf(variant((d) => (d.presentation.colorToken = '#FF8737')))).toEqual(['unknown_color']);
    expect(codesOf(variant((d) => (d.presentation.colorToken = 'flame-orange')))).toEqual(['unknown_color']);
  });

  it('validates the blueprint ID and metadata', () => {
    expect(codesOf(variant((d) => (d.blueprintId = '../../etc/passwd')))).toEqual(['invalid_id']);
    expect(codesOf(variant((d) => (d.blueprintId = 'x'.repeat(65))))).toEqual(['invalid_id']);
    expect(codesOf(variant((d) => (d.metadata.createdBy = 'someone')))).toEqual(['unsupported_value']);
    expect(codesOf(variant((d) => (d.metadata.createdAt = 'yesterday')))).toEqual(['invalid_timestamp']);
    expect(codesOf(variant((d) => (d.metadata.createdAt = '2026-10-20T10:00:00Z')))).toEqual([]);
    expect(codesOf(variant((d) => (d.metadata.notes = Array(11).fill('n'))))).toEqual(['too_many']);
    expect(codesOf(variant((d) => (d.metadata.notes = ['x'.repeat(201)])))).toEqual(['too_long']);
  });
});

describe('untrusted input', () => {
  it.each([null, [], 'blueprint', 42, true])('rejects a non-object root: %j', (value) => {
    expect(codesOf(value)).toEqual(['not_object']);
  });

  it('rejects prototype-polluting keys without touching prototypes', () => {
    const text = JSON.stringify(fixture).replace('"habit":{', '"habit":{"__proto__":{"polluted":true},');
    const result = parseBlueprintJson(text);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ code: 'unknown_key', path: '/habit/__proto__' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(codesOf(variant((d) => Object.defineProperty(d, 'constructor', { value: 1, enumerable: true })))).toEqual(['unknown_key']);
  });

  it('reports missing fields', () => {
    expect(codesOf(variant((d) => delete d.checkIn))).toEqual(['missing_key']);
    expect(codesOf(variant((d) => delete d.habit.reminder))).toEqual(['missing_key']);
  });

  it('rejects invalid JSON and oversized input before parsing', () => {
    expect(parseBlueprintJson('{"schemaVersion": ').errors[0].code).toBe('invalid_json');
    const huge = JSON.stringify(variant((d) => (d.metadata.notes = ['x'.repeat(MAX_BLUEPRINT_BYTES)])));
    expect(parseBlueprintJson(huge).errors).toEqual([expect.objectContaining({ code: 'too_large' })]);
    // Multi-byte characters count as bytes, not characters.
    const emoji = '"' + '📚'.repeat(MAX_BLUEPRINT_BYTES / 4) + '"';
    expect(parseBlueprintJson(emoji).errors[0].code).toBe('too_large');
  });

  it('gives every error a stable code, a path and a message', () => {
    const result = validateBlueprint(variant((d) => {
      d.habit.direction = 'break';
      d.presentation.icon = 'nope';
      d.extra = 1;
    }));
    expect(result.valid).toBe(false);
    for (const error of result.errors) {
      expect(error.code).toMatch(/^[a-z_]+$/);
      expect(typeof error.path).toBe('string');
      expect(error.message.length).toBeGreaterThan(5);
    }
  });
});

describe('JSON Schema contract', () => {
  it('accepts the valid fixture', () => {
    expect(schemaAccepts(fixture)).toBe(true);
  });

  // Every structural rule the schema can express must agree with the validator.
  it.each<[string, (d: Doc) => void]>([
    ['unknown top-level key', (d) => (d.postImportCommand = 'x')],
    ['unknown nested key', (d) => (d.widgets[0].config.script = 'x')],
    ['schema version', (d) => (d.schemaVersion = '2.0.0')],
    ['break direction', (d) => (d.habit.direction = 'break')],
    ['day 7', (d) => (d.habit.schedule.days = [7])],
    ['duplicate day', (d) => (d.habit.schedule.days = [1, 1])],
    ['no days', (d) => (d.habit.schedule.days = [])],
    ['fractional target', (d) => (d.metrics[0].goal.value = 7.5)],
    ['target above limit', (d) => (d.metrics[0].goal.value = 601)],
    ['bad reminder', (d) => (d.habit.reminder = { localTime: '24:00' })],
    ['unknown icon', (d) => (d.presentation.icon = 'flame')],
    ['unknown color', (d) => (d.presentation.colorToken = 'flame-orange')],
    ['auto-complete', (d) => (d.checkIn.targetAutomaticallyCompletesHabit = true)],
    ['missing metric', (d) => d.metrics.pop()],
    ['duplicate metric', (d) => (d.metrics[1] = JSON.parse(JSON.stringify(d.metrics[0])))],
    ['custom widget', (d) => (d.widgets[0].moduleId = 'widget.custom_code')],
    ['summary period', (d) => (d.widgets[1].config.period = 'current_streak_window')],
    ['name too long', (d) => (d.habit.name = 'x'.repeat(41))],
    ['blueprint id', (d) => (d.blueprintId = '../x')],
  ])('rejects %s in both the schema and the validator', (_label, mutate) => {
    const doc = variant(mutate);
    expect(schemaAccepts(doc)).toBe(false);
    expect(validateBlueprint(doc).valid).toBe(false);
  });

  it('lists exactly the catalog icon and color tokens', () => {
    const props = (schema as Doc).properties.presentation.properties;
    expect(props.icon.enum).toEqual(Object.keys(ICON_TOKENS));
    expect(props.colorToken.enum).toEqual(Object.keys(COLOR_TOKENS));
  });
});

describe('catalog stays in sync with the app', () => {
  it('icon and color tokens map one-to-one onto the app palettes', () => {
    expect([...Object.values(ICON_TOKENS)].sort()).toEqual([...HABIT_ICONS].sort());
    expect(Object.values(COLOR_TOKENS)).toEqual([...HABIT_COLORS]);
  });

  it('limits match the app validators', () => {
    expect(NAME_LIMIT).toBe(NAME_MAX_LENGTH);
    expect(READ_MORE_PROFILE.metrics.reading_minutes.constraints.maximum).toBe(MAX_MINUTES_PER_DAY);
    expect(READ_MORE_PROFILE.metrics.pages_read.constraints.maximum).toBe(MAX_PAGES_PER_DAY);
    expect(READ_MORE_PROFILE.metrics.reading_minutes.goal.maximum).toBe(MAX_TARGET_MINUTES);
  });

  it('suggested defaults match the app’s Read More template', () => {
    const app = READ_MORE_TEMPLATE.defaults;
    expect({
      name: READ_MORE_DEFAULTS.name,
      type: READ_MORE_DEFAULTS.direction,
      scheduleDays: [...READ_MORE_DEFAULTS.days],
      reminderTime: READ_MORE_DEFAULTS.reminder,
      targetMinutes: READ_MORE_DEFAULTS.targetMinutes,
      icon: ICON_TOKENS[READ_MORE_DEFAULTS.icon],
      color: COLOR_TOKENS[READ_MORE_DEFAULTS.colorToken],
    }).toEqual({
      name: app.name,
      type: app.type,
      scheduleDays: app.scheduleDays,
      reminderTime: app.reminderTime,
      targetMinutes: app.targetMinutes,
      icon: app.icon,
      color: app.color,
    });
  });

  it('advertises only Read More', () => {
    expect(CATALOG_SUMMARY.templates).toEqual([{ id: 'read-more', version: '1.0.0' }]);
  });
});
