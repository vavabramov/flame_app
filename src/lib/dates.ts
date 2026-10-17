/**
 * Local calendar-date helpers. All day logic in the app goes through here.
 *
 * - A `LocalDate` is a `YYYY-MM-DD` string for the user's wall-clock calendar day.
 * - Converting an instant to a LocalDate uses the device's local time zone
 *   (`getFullYear/getMonth/getDate`), never `toISOString().slice(0, 10)`, which
 *   is UTC and can shift the day.
 * - Day arithmetic works on "day numbers" derived from the calendar date itself
 *   (days since 1970-01-01 of that calendar date), never by adding 24h to a
 *   timestamp, so daylight-saving transitions cannot skip or repeat a day.
 * - Weekdays follow `Date#getDay`: 0 = Sunday, 1 = Monday, … 6 = Saturday.
 */

export type LocalDate = string;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type YearMonth = { year: number; month: number }; // month is 1–12

const MS_PER_DAY = 86_400_000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** The local calendar date of an instant, in the device's time zone. */
export function toLocalDate(instant: Date): LocalDate {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

function parseParts(date: LocalDate): [number, number, number] {
  const match = LOCAL_DATE_PATTERN.exec(date);
  if (!match) throw new Error(`Invalid local date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isValidLocalDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
  );
}

/** Days since 1970-01-01 for the given calendar date (time-zone independent). */
export function toDayNumber(date: LocalDate): number {
  const [year, month, day] = parseParts(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): LocalDate {
  const utc = new Date(dayNumber * MS_PER_DAY);
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

/** 1970-01-01 was a Thursday (4). */
export function weekdayOfDayNumber(dayNumber: number): Weekday {
  return ((((dayNumber + 4) % 7) + 7) % 7) as Weekday;
}

export function weekdayOf(date: LocalDate): Weekday {
  return weekdayOfDayNumber(toDayNumber(date));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** LocalDate strings sort chronologically as plain strings. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A JS Date at local midnight of the calendar date, for display formatting only. */
export function localDateToDate(date: LocalDate): Date {
  const [year, month, day] = parseParts(date);
  return new Date(year, month - 1, day);
}

export function yearMonthOf(date: LocalDate): YearMonth {
  const [year, month] = parseParts(date);
  return { year, month };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareYearMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Every calendar date of the month, in order. */
export function datesOfMonth(yearMonth: YearMonth): LocalDate[] {
  const first = `${yearMonth.year}-${pad(yearMonth.month)}-01`;
  return Array.from({ length: daysInMonth(yearMonth) }, (_, i) => addDays(first, i));
}

/** Milliseconds until the next local midnight, measured on the wall clock. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
