/**
 * Data for the per-habit activity heatmap: columns are weeks (Monday-first),
 * rows are weekdays Monday → Sunday, each cell is one local calendar day.
 * Pure: no React, no SQLite. The visual component only renders this.
 */
import { HABIT_TYPE_COPY, type HabitType } from '@/features/habits/habit-type';
import { type DayStatusContext, type HabitDayStatus, dayStatus } from '@/features/streaks/calendar';
import { type LocalDate, addDays, localDateToDate, toDayNumber, weekdayOf } from '@/lib/dates';

export type HabitDayCell = {
  dateKey: LocalDate;
  status: HabitDayStatus;
  scheduled: boolean;
  completed: boolean;
  lapse: boolean;
  isToday: boolean;
  accessibleLabel: string;
};

export type HeatmapSummary = {
  /** Successful scheduled days in the window. */
  completed: number;
  /** Scheduled days that have ended (or today, once checked in or lapsed). */
  scheduled: number;
  rate: number | null;
  from: LocalDate;
  to: LocalDate;
};

export type HabitHeatmap = {
  /** One column per week, each with 7 cells, Monday first. */
  columns: HabitDayCell[][];
  /** Month name above the column where that month's first week begins. */
  monthLabels: { column: number; label: string }[];
  summary: HeatmapSummary;
  /** False when nothing has happened yet, so the UI can say so instead of showing an empty grid. */
  hasHistory: boolean;
};

export const DEFAULT_HEATMAP_WEEKS = 26; // about six months

export type HeatmapInput = DayStatusContext & { habitType: HabitType; weeks?: number };

/** Human status text, worded for the habit's direction. */
export function describeDayStatus(status: HabitDayStatus, habitType: HabitType): string {
  switch (status) {
    case 'completed':
      return HABIT_TYPE_COPY[habitType].successStatus;
    case 'lapse':
      return 'lapse logged';
    case 'missed':
      return 'no check-in';
    case 'open':
      return 'today, not checked in yet';
    case 'unscheduled':
      return 'not scheduled';
    case 'not-started':
      return 'before this habit started';
    case 'future':
      return 'upcoming';
  }
}

export function formatDayLabel(date: LocalDate): string {
  return localDateToDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function buildHabitHeatmap(input: HeatmapInput): HabitHeatmap {
  const weeks = input.weeks ?? DEFAULT_HEATMAP_WEEKS;
  const { today, scheduleDays, habitType } = input;

  // The last column is the week containing today; it may end in future days.
  const thisMonday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const firstMonday = addDays(thisMonday, -7 * (weeks - 1));

  const columns: HabitDayCell[][] = [];
  const monthLabels: { column: number; label: string }[] = [];
  let completed = 0;
  let scheduledCount = 0;
  let hasHistory = false;

  for (let w = 0; w < weeks; w += 1) {
    const column: HabitDayCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const dateKey = addDays(firstMonday, w * 7 + d);
      const status = dayStatus(dateKey, input);
      const scheduled = scheduleDays.includes(weekdayOf(dateKey));
      const cell: HabitDayCell = {
        dateKey,
        status,
        scheduled,
        completed: status === 'completed',
        lapse: status === 'lapse',
        isToday: dateKey === today,
        accessibleLabel: `${formatDayLabel(dateKey)}: ${describeDayStatus(status, habitType)}`,
      };
      column.push(cell);

      // Same definition as completionRate: elapsed scheduled days since the start;
      // today only once it's closed by a check-in or a lapse.
      if (scheduled && (status === 'completed' || status === 'missed' || status === 'lapse')) {
        scheduledCount += 1;
        if (status === 'completed') completed += 1;
      }
      if (status === 'completed' || status === 'lapse' || status === 'missed') hasHistory = true;
    }
    columns.push(column);

    // Label the column containing the 1st of a month (and the first column),
    // skipping labels that would collide with the previous one.
    const firstOfMonth = column.find((c) => c.dateKey.endsWith('-01'));
    const labelDate = w === 0 ? column[0].dateKey : firstOfMonth?.dateKey;
    if (labelDate) {
      const previous = monthLabels[monthLabels.length - 1];
      if (!previous || w - previous.column >= 3) {
        monthLabels.push({
          column: w,
          label: localDateToDate(labelDate).toLocaleDateString('en-US', { month: 'short' }),
        });
      } else if (firstOfMonth && previous.column === 0) {
        // A real month start beats the partial first column.
        monthLabels[monthLabels.length - 1] = {
          column: w,
          label: localDateToDate(firstOfMonth.dateKey).toLocaleDateString('en-US', { month: 'short' }),
        };
      }
    }
  }

  return {
    columns,
    monthLabels,
    summary: {
      completed,
      scheduled: scheduledCount,
      rate: scheduledCount === 0 ? null : completed / scheduledCount,
      from: firstMonday,
      to: today,
    },
    hasHistory,
  };
}

/** Calendar days covered by the heatmap up to and including today. */
export function heatmapWindowDays(heatmap: HabitHeatmap): number {
  return toDayNumber(heatmap.summary.to) - toDayNumber(heatmap.summary.from) + 1;
}
