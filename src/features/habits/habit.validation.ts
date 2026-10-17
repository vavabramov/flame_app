import { isHabitType } from './habit-type';
import { type HabitInput } from './habit.types';

export const NAME_MAX_LENGTH = 40;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
/** Weeks are shown Monday-first. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type HabitInputErrors = Partial<
  Record<'type' | 'name' | 'scheduleDays' | 'reminderTime' | 'icon' | 'color', string>
>;

/** Sorted, unique, valid weekdays. */
export function normalizeScheduleDays(days: readonly unknown[]): number[] {
  const valid = days.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
  return [...new Set(valid)].sort((a, b) => a - b);
}

export function isValidReminderTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function validateHabitInput(input: HabitInput): {
  value: HabitInput | null;
  errors: HabitInputErrors;
} {
  const errors: HabitInputErrors = {};
  const name = input.name.trim().replace(/\s+/g, ' ');
  const scheduleDays = normalizeScheduleDays(input.scheduleDays);

  if (name.length === 0) errors.name = 'Give your habit a name.';
  else if (name.length > NAME_MAX_LENGTH) errors.name = `Keep it under ${NAME_MAX_LENGTH} characters.`;
  if (scheduleDays.length === 0) errors.scheduleDays = 'Pick at least one day.';
  if (input.reminderTime !== null && !isValidReminderTime(input.reminderTime)) {
    errors.reminderTime = 'Choose a valid time.';
  }
  if (!isHabitType(input.type)) errors.type = 'Choose Build or Break.';
  if (input.icon.trim().length === 0) errors.icon = 'Choose an icon.';
  if (input.color.trim().length === 0) errors.color = 'Choose a color.';

  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value: { ...input, name, scheduleDays }, errors };
}

export function describeSchedule(days: readonly number[]): string {
  const normalized = normalizeScheduleDays(days);
  if (normalized.length === 7) return 'Every day';
  if (normalized.join() === '1,2,3,4,5') return 'Weekdays';
  if (normalized.join() === '0,6') return 'Weekends';
  return WEEKDAY_DISPLAY_ORDER.filter((d) => normalized.includes(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(' · ');
}
