import {
  type LocalDate,
  type YearMonth,
  compareLocalDates,
  datesOfMonth,
  weekdayOf,
} from '@/lib/dates';

/**
 * The status of one local calendar day for one habit. The month calendar and the
 * activity heatmap both use this, so they can never disagree.
 *
 * - completed: a successful day is stored (done / made it), scheduled or not
 * - lapse: a lapse is stored (Break habits). Never a success
 * - missed: scheduled, on or after the start date, before today, no check-in
 * - open: today, scheduled, no check-in yet. Not a miss
 * - unscheduled: the habit isn't scheduled on this weekday
 * - not-started: scheduled weekday before the habit was created
 * - future: after today
 */
export type HabitDayStatus = 'completed' | 'lapse' | 'missed' | 'open' | 'unscheduled' | 'not-started' | 'future';

export type DayStatusContext = {
  today: LocalDate;
  scheduleDays: readonly number[];
  startDate: LocalDate;
  completed: ReadonlySet<LocalDate>;
  /** Pass an empty set for habits that don't track lapses. */
  lapses: ReadonlySet<LocalDate>;
};

export function dayStatus(date: LocalDate, ctx: DayStatusContext): HabitDayStatus {
  if (compareLocalDates(date, ctx.today) > 0) return 'future';
  // A lapse wins over a completion on the same date: it's never shown as a success.
  if (ctx.lapses.has(date)) return 'lapse';
  if (ctx.completed.has(date)) return 'completed';
  if (!ctx.scheduleDays.includes(weekdayOf(date))) return 'unscheduled';
  if (compareLocalDates(date, ctx.startDate) < 0) return 'not-started';
  return date === ctx.today ? 'open' : 'missed';
}

export type CalendarCell = { date: LocalDate; day: number; status: HabitDayStatus; isToday: boolean };

/** Monday-first weeks for a month grid. `null` pads the first and last week. */
export function buildMonthGrid(yearMonth: YearMonth, ctx: DayStatusContext): (CalendarCell | null)[][] {
  const dates = datesOfMonth(yearMonth);
  const leading = (weekdayOf(dates[0]) + 6) % 7;
  const cells: (CalendarCell | null)[] = [
    ...Array<null>(leading).fill(null),
    ...dates.map((date, i) => ({ date, day: i + 1, status: dayStatus(date, ctx), isToday: date === ctx.today })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
