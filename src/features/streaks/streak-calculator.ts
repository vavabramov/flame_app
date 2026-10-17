/**
 * Pure streak and completion-rate math. No React, no SQLite.
 *
 * Inputs are the habit's weekday schedule, the date tracking began, the set of
 * completed local dates (the source of truth), and "today" in local time.
 *
 * Rules
 * - A scheduled day is a weekday in `scheduleDays` on or after `startDate`.
 *   Days before the habit existed are never counted as missed.
 * - Current streak: walk backwards over scheduled days from today, counting
 *   completed ones until the first missed scheduled day.
 *   - If today is scheduled but not completed yet, today is skipped rather than
 *     treated as missed: the streak stays alive until the local day ends.
 *   - Unscheduled days are skipped and never break a streak.
 *   Example: schedule Mon/Wed/Fri, today is Monday. Last Friday completed (and
 *   Wednesday before it) gives a current streak of 2 all of Monday. Completing
 *   Monday makes it 3. Tuesday is unscheduled, so it never breaks it.
 * - Best streak: the longest run of consecutive completed scheduled days in the
 *   whole history. It never decreases when a day is missed.
 * - Completions on unscheduled days (possible after a schedule edit) stay in the
 *   history and calendar, but don't count toward streaks or rates.
 * - Lapses (Break habits) are separate events, never successes. A lapse today
 *   closes the day: the current streak ends right away instead of waiting for
 *   midnight. Past successes and the best streak are untouched. If a date somehow
 *   has both a completion and a lapse, the lapse wins.
 * - Future-dated completions and lapses are ignored.
 * - Schedule edits apply to the whole history: streaks are recomputed with the
 *   current schedule.
 */

import {
  type LocalDate,
  compareLocalDates,
  toDayNumber,
  weekdayOfDayNumber,
} from '@/lib/dates';

export type StreakHistory = {
  /** Weekdays the habit is scheduled on, 0 = Sunday … 6 = Saturday. */
  scheduleDays: readonly number[];
  /** Local date the habit started being tracked (its creation date). */
  startDate: LocalDate;
  /** Local dates with a completion. Duplicates are harmless. */
  completedDates: Iterable<LocalDate>;
  /** Local dates with a logged lapse (Break habits). */
  lapseDates?: Iterable<LocalDate>;
};

export type StreakSummary = {
  currentStreak: number;
  bestStreak: number;
  isScheduledToday: boolean;
  isCompletedToday: boolean;
  isLapsedToday: boolean;
};

export type CompletionRate = {
  completed: number;
  /** Scheduled days in the window, i.e. the denominator. */
  scheduled: number;
  /** `completed / scheduled`, or null when no scheduled days have elapsed. */
  rate: number | null;
};

type PreparedHistory = {
  schedule: Set<number>;
  done: Set<number>;
  lapsed: Set<number>;
  start: number;
  today: number;
};

function prepare(history: StreakHistory, today: LocalDate): PreparedHistory {
  const todayNumber = toDayNumber(today);
  const done = new Set<number>();
  let start = toDayNumber(history.startDate);

  for (const date of history.completedDates) {
    const day = toDayNumber(date);
    if (day > todayNumber) continue;
    done.add(day);
    // A completion before the recorded start date still counts as history.
    if (day < start) start = day;
  }

  const lapsed = new Set<number>();
  for (const date of history.lapseDates ?? []) {
    const day = toDayNumber(date);
    if (day > todayNumber) continue;
    lapsed.add(day);
    done.delete(day);
    if (day < start) start = day;
  }

  return { schedule: new Set(history.scheduleDays), done, lapsed, start, today: todayNumber };
}

const isScheduled = (prepared: PreparedHistory, day: number) =>
  prepared.schedule.has(weekdayOfDayNumber(day));

export function isScheduledOn(scheduleDays: readonly number[], date: LocalDate): boolean {
  return scheduleDays.includes(weekdayOfDayNumber(toDayNumber(date)));
}

export function currentStreak(history: StreakHistory, today: LocalDate): number {
  const prepared = prepare(history, today);
  if (prepared.schedule.size === 0) return 0;

  let day = prepared.today;
  // Today's scheduled occurrence isn't missed until the day ends (or a lapse closes it).
  if (isScheduled(prepared, day) && !prepared.done.has(day) && !prepared.lapsed.has(day)) day -= 1;

  let streak = 0;
  for (; day >= prepared.start; day -= 1) {
    if (!isScheduled(prepared, day)) continue;
    if (!prepared.done.has(day)) break;
    streak += 1;
  }
  return streak;
}

export function bestStreak(history: StreakHistory, today: LocalDate): number {
  const prepared = prepare(history, today);
  if (prepared.schedule.size === 0) return 0;

  let best = 0;
  let run = 0;
  for (let day = prepared.start; day <= prepared.today; day += 1) {
    if (!isScheduled(prepared, day)) continue;
    if (prepared.done.has(day)) {
      run += 1;
      if (run > best) best = run;
    } else if (day !== prepared.today || prepared.lapsed.has(day)) {
      run = 0;
    }
  }
  return best;
}

export function summarizeStreak(history: StreakHistory, today: LocalDate): StreakSummary {
  const lapsedToday = new Set(history.lapseDates ?? []).has(today);
  return {
    currentStreak: currentStreak(history, today),
    bestStreak: bestStreak(history, today),
    isScheduledToday: isScheduledOn(history.scheduleDays, today),
    isCompletedToday: !lapsedToday && new Set(history.completedDates).has(today),
    isLapsedToday: lapsedToday,
  };
}

/**
 * Completion rate over the last `windowDays` calendar days, today included.
 *
 * - The denominator is only scheduled days, on or after the start date.
 * - Future dates are never in the window.
 * - Today counts only once it's completed or a lapse is logged. An open today is
 *   neither a miss nor in the denominator, so the rate never drops just because
 *   the day isn't over.
 */
export function completionRate(
  history: StreakHistory,
  today: LocalDate,
  windowDays: number,
): CompletionRate {
  const prepared = prepare(history, today);
  const from = Math.max(prepared.start, prepared.today - windowDays + 1);

  let completed = 0;
  let scheduled = 0;
  for (let day = from; day <= prepared.today; day += 1) {
    if (!isScheduled(prepared, day)) continue;
    const isDone = prepared.done.has(day);
    if (day === prepared.today && !isDone && !prepared.lapsed.has(day)) continue;
    scheduled += 1;
    if (isDone) completed += 1;
  }

  return { completed, scheduled, rate: scheduled === 0 ? null : completed / scheduled };
}

/**
 * The normal UI only lets you check in, or undo, for the current local date.
 * Past dates are read-only history. Future dates can never be checked in.
 */
export function canToggleCompletion(date: LocalDate, today: LocalDate): boolean {
  return compareLocalDates(date, today) === 0;
}
