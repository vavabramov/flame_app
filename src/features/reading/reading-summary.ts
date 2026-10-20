/** Pure reading summaries for Today and Progress. Never invents numbers: no data → nulls. */
import { type LocalDate, compareLocalDates, toDayNumber } from '@/lib/dates';

export type ReadingRecord = { localDate: LocalDate; minutes: number; pages: number | null };

export type ReadingTotals = {
  /** Days with a saved entry. */
  daysLogged: number;
  minutes: number;
  /** Null when no entry in the range has pages. */
  pages: number | null;
};

export type ReadingSummary = {
  last30: ReadingTotals;
  allTime: ReadingTotals;
  /** Most recent entries first, up to `recentLimit`. */
  recent: ReadingRecord[];
  hasData: boolean;
};

function totals(records: ReadingRecord[]): ReadingTotals {
  let minutes = 0;
  let pages: number | null = null;
  for (const r of records) {
    minutes += r.minutes;
    if (r.pages !== null) pages = (pages ?? 0) + r.pages;
  }
  return { daysLogged: records.length, minutes, pages };
}

/**
 * - last30: entries in the last 30 calendar days, today included.
 * - Future-dated entries are ignored everywhere.
 */
export function summarizeReading(
  records: Iterable<ReadingRecord>,
  today: LocalDate,
  recentLimit = 7,
): ReadingSummary {
  const todayNumber = toDayNumber(today);
  const past = [...records]
    .filter((r) => compareLocalDates(r.localDate, today) <= 0)
    .sort((a, b) => compareLocalDates(b.localDate, a.localDate));
  const last30 = past.filter((r) => todayNumber - toDayNumber(r.localDate) < 30);

  return {
    last30: totals(last30),
    allTime: totals(past),
    recent: past.slice(0, recentLimit),
    hasData: past.length > 0,
  };
}

/** "12 / 15 min", or "12 min" without a target. */
export function formatMinutesProgress(minutes: number, target: number | null): string {
  return target === null ? `${minutes} min` : `${minutes} / ${target} min`;
}
