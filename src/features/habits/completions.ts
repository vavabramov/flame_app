import { type LocalDate } from '@/lib/dates';
import { canToggleCompletion } from '@/features/streaks/streak-calculator';

export class CheckInDateError extends Error {
  constructor(date: LocalDate) {
    super(`Check-ins are only allowed for today (got ${date}).`);
    this.name = 'CheckInDateError';
  }
}

/**
 * Toggles one habit's completion for `date` in an in-memory set.
 * A set can't hold duplicates, so the same date is never recorded twice.
 * The database enforces the same rule with UNIQUE (habit_id, local_date).
 */
export function toggleCompletionDate(
  dates: ReadonlySet<LocalDate>,
  date: LocalDate,
  today: LocalDate,
): { dates: Set<LocalDate>; completed: boolean } {
  if (!canToggleCompletion(date, today)) throw new CheckInDateError(date);
  const next = new Set(dates);
  if (next.has(date)) {
    next.delete(date);
    return { dates: next, completed: false };
  }
  next.add(date);
  return { dates: next, completed: true };
}
