import { parseScheduleDays } from './habit.repository';
import { describeSchedule, normalizeScheduleDays, validateHabitInput } from './habit.validation';
import { planReminders } from '@/features/reminders/reminder.plan';
import { type Habit } from './habit.types';

const base = { type: 'build' as const, name: 'Read', icon: '📚', color: '#FF8737', scheduleDays: [0, 1, 2, 3, 4, 5, 6], reminderTime: null };

describe('habit validation', () => {
  it('trims and collapses whitespace in the name', () => {
    expect(validateHabitInput({ ...base, name: '  Read   10  pages ' }).value?.name).toBe('Read 10 pages');
  });

  it('requires a name and at least one day', () => {
    const { value, errors } = validateHabitInput({ ...base, name: '   ', scheduleDays: [] });
    expect(value).toBeNull();
    expect(errors.name).toBeDefined();
    expect(errors.scheduleDays).toBeDefined();
  });

  it('limits the name length', () => {
    expect(validateHabitInput({ ...base, name: 'x'.repeat(41) }).errors.name).toBeDefined();
    expect(validateHabitInput({ ...base, name: 'x'.repeat(40) }).value).not.toBeNull();
  });

  it('validates the reminder time', () => {
    expect(validateHabitInput({ ...base, reminderTime: '07:30' }).value?.reminderTime).toBe('07:30');
    expect(validateHabitInput({ ...base, reminderTime: '24:00' }).errors.reminderTime).toBeDefined();
    expect(validateHabitInput({ ...base, reminderTime: '7:30' }).errors.reminderTime).toBeDefined();
  });

  it('normalizes schedule days', () => {
    expect(normalizeScheduleDays([5, 1, 1, 9, -1, 3.5, 3])).toEqual([1, 3, 5]);
  });

  it('describes common schedules', () => {
    expect(describeSchedule([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(describeSchedule([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeSchedule([6, 0])).toBe('Weekends');
    expect(describeSchedule([5, 1, 3])).toBe('Mon · Wed · Fri');
  });
});

describe('stored schedule parsing', () => {
  it('reads valid JSON and falls back to every day for bad data', () => {
    expect(parseScheduleDays('[1,3,5]')).toEqual([1, 3, 5]);
    expect(parseScheduleDays('not json')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseScheduleDays('[]')).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('reminder plan', () => {
  const habit = (overrides: Partial<Habit>): Habit => ({
    id: 'h1',
    ...base,
    scheduleDays: [1, 3, 5],
    reminderTime: '08:15',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  });

  it('schedules one weekly reminder per scheduled weekday, with stable ids', () => {
    const { planned } = planReminders([habit({})], true);
    expect(planned.map((r) => r.weekday)).toEqual([2, 4, 6]); // expo: 1 = Sunday
    expect(planned.every((r) => r.hour === 8 && r.minute === 15)).toBe(true);
    expect(planReminders([habit({})], true).planned.map((r) => r.identifier)).toEqual(
      planned.map((r) => r.identifier),
    );
  });

  it('plans nothing for archived habits, habits without a time, or when paused', () => {
    expect(planReminders([habit({ archivedAt: '2024-02-01T00:00:00.000Z' })], true).planned).toHaveLength(0);
    expect(planReminders([habit({ reminderTime: null })], true).planned).toHaveLength(0);
    expect(planReminders([habit({})], false).planned).toHaveLength(0);
  });

  it("caps at iOS's 64 pending notifications and reports the overflow", () => {
    const habits = Array.from({ length: 10 }, (_, i) =>
      habit({ id: `h${i}`, scheduleDays: [0, 1, 2, 3, 4, 5, 6] }),
    );
    const { planned, overflow } = planReminders(habits, true);
    expect(planned).toHaveLength(64);
    expect(overflow).toBe(6);
  });
});
