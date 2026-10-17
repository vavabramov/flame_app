import {
  type LocalDate,
  type YearMonth,
  compareLocalDates,
  datesOfMonth,
  weekdayOf,
} from '@/lib/dates';

/**
 * - completed: a completion is stored for this date (always shown, scheduled or not)
 * - missed: scheduled, on or after the start date, before today, not completed
 * - today: today, scheduled, not yet completed
 * - upcoming: scheduled and in the future
 * - off: not scheduled, or before the habit started
 */
export type CalendarDayState = 'completed' | 'missed' | 'today' | 'upcoming' | 'off';

export type CalendarCell = { date: LocalDate; day: number; state: CalendarDayState; isToday: boolean };

export function calendarDayState(
  date: LocalDate,
  today: LocalDate,
  scheduleDays: readonly number[],
  startDate: LocalDate,
  completed: ReadonlySet<LocalDate>,
): CalendarDayState {
  if (completed.has(date) && compareLocalDates(date, today) <= 0) return 'completed';
  if (!scheduleDays.includes(weekdayOf(date))) return 'off';
  const vsToday = compareLocalDates(date, today);
  if (vsToday > 0) return 'upcoming';
  if (compareLocalDates(date, startDate) < 0) return 'off';
  return vsToday === 0 ? 'today' : 'missed';
}

/** Monday-first weeks for a month grid. `null` pads the first and last week. */
export function buildMonthGrid(
  yearMonth: YearMonth,
  today: LocalDate,
  scheduleDays: readonly number[],
  startDate: LocalDate,
  completed: ReadonlySet<LocalDate>,
): (CalendarCell | null)[][] {
  const dates = datesOfMonth(yearMonth);
  const leading = (weekdayOf(dates[0]) + 6) % 7;
  const cells: (CalendarCell | null)[] = [
    ...Array<null>(leading).fill(null),
    ...dates.map((date, i) => ({
      date,
      day: i + 1,
      state: calendarDayState(date, today, scheduleDays, startDate, completed),
      isToday: date === today,
    })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
