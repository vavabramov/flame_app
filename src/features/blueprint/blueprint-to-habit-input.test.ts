import { validateHabitInput } from '@/features/habits/habit.validation';

import fixture from './__fixtures__/read-more.v1.json';
import { blueprintToHabitInput } from './blueprint-to-habit-input';
import { validateBlueprint } from './validate-blueprint';

const validated = (mutate: (doc: Record<string, any>) => void = () => undefined) => {
  const doc = JSON.parse(JSON.stringify(fixture));
  mutate(doc);
  const result = validateBlueprint(doc);
  if (!result.valid) throw new Error(JSON.stringify(result.errors));
  return result.value;
};

describe('blueprint → HabitInput', () => {
  it('maps the Read More fixture onto the app’s existing habit model', () => {
    const input = blueprintToHabitInput(validated());
    expect(input).toEqual({
      type: 'build',
      template: 'read_more',
      targetMinutes: 15,
      name: 'Read',
      icon: '📚',
      color: '#FF8737',
      scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      reminderTime: null,
    });
    // The app's own validator accepts the mapped input unchanged.
    expect(validateHabitInput(input)).toEqual({ value: input, errors: {} });
  });

  it('maps a reminder, a null goal, tokens and a custom schedule', () => {
    const input = blueprintToHabitInput(
      validated((d) => {
        d.habit.reminder = { localTime: '07:45' };
        d.habit.schedule.days = [6, 0];
        d.metrics[0].goal = null;
        d.presentation = { icon: 'sun', colorToken: 'lagoon' };
      }),
    );
    expect(input).toMatchObject({ reminderTime: '07:45', scheduleDays: [0, 6], targetMinutes: null, icon: '☀️', color: '#3CC8E0' });
    expect(validateHabitInput(input).errors).toEqual({});
  });

  it('never carries the blueprint ID or metadata into the habit', () => {
    const input = blueprintToHabitInput(validated());
    expect(JSON.stringify(input)).not.toContain('draft_fixture_read_more');
    expect(Object.keys(input).sort()).toEqual(
      ['color', 'icon', 'name', 'reminderTime', 'scheduleDays', 'targetMinutes', 'template', 'type'],
    );
  });
});
