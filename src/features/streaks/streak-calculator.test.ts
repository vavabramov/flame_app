import { toggleCompletionDate } from '@/features/habits/completions';
import { type LocalDate, weekdayOf } from '@/lib/dates';

import {
  type StreakHistory,
  bestStreak,
  canToggleCompletion,
  completionRate,
  currentStreak,
  summarizeStreak,
} from './streak-calculator';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const MON_WED_FRI = [1, 3, 5];
const MON_TO_FRI = [1, 2, 3, 4, 5];

const history = (
  scheduleDays: number[],
  startDate: LocalDate,
  completedDates: LocalDate[],
): StreakHistory => ({ scheduleDays, startDate, completedDates });

/** Inclusive run of dates within one month, e.g. range('2024-01', 1, 5). */
const range = (yearMonth: string, from: number, to: number): LocalDate[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${yearMonth}-${String(from + i).padStart(2, '0')}`);

describe('calendar fixtures', () => {
  it('uses January 2024, where the 1st is a Monday', () => {
    expect(weekdayOf('2024-01-01')).toBe(1);
    expect(weekdayOf('2024-01-07')).toBe(0);
  });
});

describe('streak calculator', () => {
  it('1. first-ever completion today gives a streak of 1', () => {
    const h = history(EVERY_DAY, '2024-01-01', ['2024-01-01']);
    expect(currentStreak(h, '2024-01-01')).toBe(1);
    expect(bestStreak(h, '2024-01-01')).toBe(1);
  });

  it('2. counts consecutive daily completions', () => {
    const h = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 5));
    expect(currentStreak(h, '2024-01-05')).toBe(5);
    expect(bestStreak(h, '2024-01-05')).toBe(5);
  });

  it('3. a missing scheduled day breaks the current streak', () => {
    const h = history(EVERY_DAY, '2024-01-01', ['2024-01-01', '2024-01-02', '2024-01-04', '2024-01-05']);
    expect(currentStreak(h, '2024-01-05')).toBe(2);
  });

  it('4. a missed day preserves the best streak and the history', () => {
    const dates = [...range('2024-01', 1, 4), '2024-01-06', '2024-01-07'];
    const h = history(EVERY_DAY, '2024-01-01', dates);
    expect(currentStreak(h, '2024-01-07')).toBe(2);
    expect(bestStreak(h, '2024-01-07')).toBe(4);
    expect(completionRate(h, '2024-01-07', 7)).toEqual({ completed: 6, scheduled: 7, rate: 6 / 7 });
  });

  it('5. today scheduled but not yet completed does not break the streak', () => {
    const h = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 4));
    expect(currentStreak(h, '2024-01-05')).toBe(4);
    expect(summarizeStreak(h, '2024-01-05')).toMatchObject({
      isScheduledToday: true,
      isCompletedToday: false,
    });
  });

  it('5b. a missed yesterday still ends the streak while today is open', () => {
    const h = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 3));
    expect(currentStreak(h, '2024-01-05')).toBe(0);
    expect(bestStreak(h, '2024-01-05')).toBe(3);
  });

  it('6. completing today increments the streak', () => {
    const h = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 5));
    expect(currentStreak(h, '2024-01-05')).toBe(5);
  });

  it('7. an unscheduled day does not break a streak', () => {
    // Mon–Fri schedule: Sat 6th and Sun 7th are not scheduled.
    const h = history(MON_TO_FRI, '2024-01-01', ['2024-01-04', '2024-01-05', '2024-01-08']);
    expect(currentStreak(h, '2024-01-07')).toBe(2); // Sunday
    expect(currentStreak(h, '2024-01-08')).toBe(3); // Monday, completed
  });

  it('8. three-days-per-week schedule (Mon/Wed/Fri)', () => {
    const base = ['2024-01-01', '2024-01-03', '2024-01-05']; // Mon, Wed, Fri
    const h = history(MON_WED_FRI, '2024-01-01', base);

    // Monday the 8th, not completed yet: last week's run stays valid all day.
    expect(currentStreak(h, '2024-01-08')).toBe(3);

    // Completing Monday advances by one scheduled occurrence.
    const withMonday = history(MON_WED_FRI, '2024-01-01', [...base, '2024-01-08']);
    expect(currentStreak(withMonday, '2024-01-08')).toBe(4);

    // Tuesday is not scheduled and doesn't break it. Wednesday is open until it ends.
    expect(currentStreak(withMonday, '2024-01-09')).toBe(4);
    expect(currentStreak(withMonday, '2024-01-10')).toBe(4);

    // Thursday: Wednesday was missed, so the current streak ends but the best stays.
    expect(currentStreak(withMonday, '2024-01-11')).toBe(0);
    expect(bestStreak(withMonday, '2024-01-11')).toBe(4);

    // The 30-day rate only counts Mon/Wed/Fri: 4 done of the 5 elapsed (1, 3, 5, 8, 10).
    expect(completionRate(withMonday, '2024-01-11', 30)).toEqual({ completed: 4, scheduled: 5, rate: 0.8 });
  });

  it('9. days before the habit was created are not missed days', () => {
    const fresh = history(EVERY_DAY, '2024-01-10', []);
    expect(currentStreak(fresh, '2024-01-10')).toBe(0);
    expect(completionRate(fresh, '2024-01-10', 30)).toEqual({ completed: 0, scheduled: 0, rate: null });

    const h = history(EVERY_DAY, '2024-01-10', ['2024-01-10', '2024-01-11']);
    expect(currentStreak(h, '2024-01-11')).toBe(2);
    expect(completionRate(h, '2024-01-11', 30)).toEqual({ completed: 2, scheduled: 2, rate: 1 });
    expect(completionRate(h, '2024-01-11', 7).scheduled).toBe(2);
  });

  it('10. duplicate completions are prevented and never inflate a streak', () => {
    const h = history(EVERY_DAY, '2024-01-01', ['2024-01-01', '2024-01-01', '2024-01-02']);
    expect(currentStreak(h, '2024-01-02')).toBe(2);
    expect(completionRate(h, '2024-01-02', 7)).toEqual({ completed: 2, scheduled: 2, rate: 1 });

    // Checking in twice toggles (undo) instead of creating a second record.
    const first = toggleCompletionDate(new Set(), '2024-01-02', '2024-01-02');
    expect([...first.dates]).toEqual(['2024-01-02']);
    expect(first.completed).toBe(true);
  });

  it("11. undoing today's completion recalculates from the source of truth", () => {
    const today = '2024-01-05';
    const completed = toggleCompletionDate(new Set(range('2024-01', 1, 4)), today, today);
    expect(currentStreak(history(EVERY_DAY, '2024-01-01', [...completed.dates]), today)).toBe(5);

    const undone = toggleCompletionDate(completed.dates, today, today);
    expect(undone.completed).toBe(false);
    const h = history(EVERY_DAY, '2024-01-01', [...undone.dates]);
    expect(currentStreak(h, today)).toBe(4);
    expect(bestStreak(h, today)).toBe(4);
  });

  it('12. counts streaks across month and year boundaries', () => {
    const dates = ['2023-12-30', '2023-12-31', '2024-01-01', '2024-01-02'];
    expect(currentStreak(history(EVERY_DAY, '2023-12-30', dates), '2024-01-02')).toBe(4);

    const monthEdge = ['2024-01-30', '2024-01-31', '2024-02-01'];
    expect(currentStreak(history(EVERY_DAY, '2024-01-30', monthEdge), '2024-02-01')).toBe(3);
  });

  it('13. handles leap day', () => {
    const daily = history(EVERY_DAY, '2024-02-28', ['2024-02-28', '2024-02-29', '2024-03-01']);
    expect(currentStreak(daily, '2024-03-01')).toBe(3);

    // Missing Feb 29 breaks a daily streak.
    const missed = history(EVERY_DAY, '2024-02-28', ['2024-02-28', '2024-03-01']);
    expect(currentStreak(missed, '2024-03-01')).toBe(1);

    // Thursday-only: Feb 22 and Feb 29, 2024 are consecutive Thursdays.
    const thursdays = history([4], '2024-02-22', ['2024-02-22', '2024-02-29']);
    expect(currentStreak(thursdays, '2024-03-01')).toBe(2);
  });

  it('14. streaks across a daylight-saving transition are counted by calendar day', () => {
    // US spring-forward was 2024-03-10, fall-back 2024-11-03.
    const spring = history(EVERY_DAY, '2024-03-09', ['2024-03-09', '2024-03-10', '2024-03-11']);
    expect(currentStreak(spring, '2024-03-11')).toBe(3);
    const fall = history(EVERY_DAY, '2024-11-02', ['2024-11-02', '2024-11-03', '2024-11-04']);
    expect(currentStreak(fall, '2024-11-04')).toBe(3);
  });

  it('15. future dates cannot be checked in and are ignored', () => {
    expect(canToggleCompletion('2024-01-06', '2024-01-05')).toBe(false);
    expect(canToggleCompletion('2024-01-04', '2024-01-05')).toBe(false);
    expect(canToggleCompletion('2024-01-05', '2024-01-05')).toBe(true);
    expect(() => toggleCompletionDate(new Set(), '2024-01-06', '2024-01-05')).toThrow(/only allowed for today/);

    const h = history(EVERY_DAY, '2024-01-01', [...range('2024-01', 1, 5), '2024-01-06', '2024-01-09']);
    expect(currentStreak(h, '2024-01-05')).toBe(5);
    expect(bestStreak(h, '2024-01-05')).toBe(5);
    expect(completionRate(h, '2024-01-05', 7)).toEqual({ completed: 5, scheduled: 5, rate: 1 });
  });

  it('returns zero for an empty schedule', () => {
    const h = history([], '2024-01-01', ['2024-01-01']);
    expect(currentStreak(h, '2024-01-01')).toBe(0);
    expect(bestStreak(h, '2024-01-01')).toBe(0);
  });
});

describe('completion rate', () => {
  it('excludes an open today from the denominator, and includes it once completed', () => {
    const open = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 6));
    expect(completionRate(open, '2024-01-07', 7)).toEqual({ completed: 6, scheduled: 6, rate: 1 });

    const done = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 7));
    expect(completionRate(done, '2024-01-07', 7)).toEqual({ completed: 7, scheduled: 7, rate: 1 });
  });

  it('limits the window to the last N calendar days including today', () => {
    const h = history(EVERY_DAY, '2024-01-01', range('2024-01', 1, 31));
    expect(completionRate(h, '2024-01-31', 7).scheduled).toBe(7);
    expect(completionRate(h, '2024-01-31', 30).scheduled).toBe(30);
  });

  it('uses only scheduled days as the denominator', () => {
    // Two weeks of Mon/Wed/Fri with every scheduled day done: 7-day window ending Sun the 14th.
    const h = history(MON_WED_FRI, '2024-01-01', ['2024-01-08', '2024-01-10', '2024-01-12']);
    expect(completionRate(h, '2024-01-14', 7)).toEqual({ completed: 3, scheduled: 3, rate: 1 });
  });

  it('ignores completions on unscheduled days', () => {
    const h = history(MON_WED_FRI, '2024-01-01', ['2024-01-01', '2024-01-02']);
    expect(completionRate(h, '2024-01-02', 7)).toEqual({ completed: 1, scheduled: 1, rate: 1 });
    expect(currentStreak(h, '2024-01-02')).toBe(1);
  });
});

describe('lapses (Break habits)', () => {
  const withLapses = (completed: LocalDate[], lapses: LocalDate[]): StreakHistory => ({
    scheduleDays: EVERY_DAY,
    startDate: '2024-01-01',
    completedDates: completed,
    lapseDates: lapses,
  });

  it('a lapse today ends the current streak right away but keeps the best streak', () => {
    const h = withLapses(range('2024-01', 1, 4), ['2024-01-05']);
    expect(currentStreak(h, '2024-01-05')).toBe(0);
    expect(bestStreak(h, '2024-01-05')).toBe(4);
    expect(summarizeStreak(h, '2024-01-05')).toMatchObject({ isLapsedToday: true, isCompletedToday: false });
  });

  it('a lapse closes today for the completion rate', () => {
    const h = withLapses(range('2024-01', 1, 4), ['2024-01-05']);
    expect(completionRate(h, '2024-01-05', 7)).toEqual({ completed: 4, scheduled: 5, rate: 0.8 });
  });

  it('the streak restarts the day after a lapse', () => {
    const h = withLapses([...range('2024-01', 1, 4), '2024-01-06'], ['2024-01-05']);
    expect(currentStreak(h, '2024-01-06')).toBe(1);
    expect(bestStreak(h, '2024-01-06')).toBe(4);
  });

  it('never counts a lapse as a success, even if a completion exists for the same day', () => {
    const h = withLapses(['2024-01-04', '2024-01-05'], ['2024-01-05']);
    expect(currentStreak(h, '2024-01-05')).toBe(0);
    expect(summarizeStreak(h, '2024-01-05').isCompletedToday).toBe(false);
  });

  it('not logging a lapse is not a success: only check-ins count', () => {
    const h = withLapses([], []);
    expect(currentStreak(h, '2024-01-05')).toBe(0);
    expect(completionRate(h, '2024-01-05', 7)).toEqual({ completed: 0, scheduled: 4, rate: 0 });
  });

  it('ignores future lapses', () => {
    const h = withLapses(range('2024-01', 1, 5), ['2024-01-07']);
    expect(currentStreak(h, '2024-01-05')).toBe(5);
  });
});
