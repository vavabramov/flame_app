import { type Habit } from '@/features/habits/habit.types';
import { HABIT_TYPE_COPY } from '@/features/habits/habit-type';
import { parseReminderTime } from '@/features/habits/habit.validation';

/** iOS keeps at most 64 pending local notifications per app. */
export const IOS_PENDING_NOTIFICATION_LIMIT = 64;
export const REMINDER_ID_PREFIX = 'flame-habit:';

export type PlannedReminder = {
  /** Deterministic, so rescheduling replaces instead of duplicating. */
  identifier: string;
  habitId: string;
  /** expo-notifications weekday: 1 = Sunday … 7 = Saturday. */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

export const reminderIdentifier = (habitId: string, weekday: number) =>
  `${REMINDER_ID_PREFIX}${habitId}:${weekday}`;

/**
 * The full set of weekly reminders that should exist right now: one per
 * scheduled weekday of each active habit with a reminder time.
 */
export function planReminders(
  habits: readonly Habit[],
  remindersEnabled: boolean,
): { planned: PlannedReminder[]; overflow: number } {
  if (!remindersEnabled) return { planned: [], overflow: 0 };

  const all: PlannedReminder[] = [];
  for (const habit of habits) {
    if (habit.archivedAt !== null || habit.reminderTime === null) continue;
    const time = parseReminderTime(habit.reminderTime);
    if (!time) continue;
    for (const day of habit.scheduleDays) {
      const weekday = day + 1; // our 0 = Sunday → expo's 1 = Sunday
      all.push({
        identifier: reminderIdentifier(habit.id, weekday),
        habitId: habit.id,
        weekday,
        hour: time.hour,
        minute: time.minute,
        title: `${habit.icon} ${habit.name}`,
        body: HABIT_TYPE_COPY[habit.type].reminderBody,
      });
    }
  }

  return {
    planned: all.slice(0, IOS_PENDING_NOTIFICATION_LIMIT),
    overflow: Math.max(0, all.length - IOS_PENDING_NOTIFICATION_LIMIT),
  };
}
