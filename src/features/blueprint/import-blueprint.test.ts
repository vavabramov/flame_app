import fixture from './__fixtures__/read-more.v1.json';
import { MAX_BLUEPRINT_BYTES } from './catalog';
import { prepareImport } from './import-blueprint';

const text = (mutate: (doc: Record<string, any>) => void = () => undefined) => {
  const doc = JSON.parse(JSON.stringify(fixture));
  mutate(doc);
  return JSON.stringify(doc);
};
const codes = (t: string) => {
  const r = prepareImport(t);
  return r.ok ? [] : r.errors.map((e) => e.code);
};

describe('prepareImport', () => {
  it('turns a valid export into the app’s habit input', () => {
    const r = prepareImport(text());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input).toEqual({
      type: 'build',
      template: 'read_more',
      targetMinutes: 15,
      name: 'Read',
      icon: '📚',
      color: '#FF8737',
      scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      reminderTime: null,
    });
  });

  it('asks for input when nothing was pasted', () => {
    expect(codes('   ')).toEqual(['invalid_json']);
  });

  it('rejects text that isn’t JSON, or is too large', () => {
    expect(codes('Read every day please')).toEqual(['invalid_json']);
    expect(codes('x'.repeat(MAX_BLUEPRINT_BYTES + 1))).toEqual(['too_large']);
  });

  it('catches JSON that was changed after export (scenario 10)', () => {
    expect(codes(text((d) => (d.habit.direction = 'break')))).toEqual(['incompatible_direction']);
    expect(codes(text((d) => (d.postImportCommand = 'rm -rf ~')))).toEqual(['unknown_key']);
    expect(codes(text((d) => (d.schemaVersion = '2.0.0')))).toEqual(['unsupported_schema_version']);
    expect(codes(text((d) => (d.habit.schedule.days = [7])))).toEqual(['out_of_range']);
    expect(codes(text((d) => (d.checkIn.targetAutomaticallyCompletesHabit = true)))).toEqual(['unsupported_value']);
    expect(codes(text((d) => (d.presentation.colorToken = 'flame-orange')))).toEqual(['unknown_color']);
  });

  it('never carries the blueprint ID into the habit', () => {
    const r = prepareImport(text((d) => (d.blueprintId = 'draft_existing_habit_id')));
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.input)).not.toContain('draft_existing_habit_id');
  });
});
