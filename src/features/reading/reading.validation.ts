/** Validation for a day's reading entry and the daily minutes target. */

export const MAX_MINUTES_PER_DAY = 1440;
export const MAX_PAGES_PER_DAY = 10000;
export const MAX_TARGET_MINUTES = 600;

export type ReadingEntry = { minutes: number; pages: number | null };
export type ReadingEntryErrors = Partial<Record<'minutes' | 'pages', string>>;

const WHOLE_NUMBER = /^\d+$/;

/** Parses the text fields of the reading form. Pages may be left empty. */
export function parseReadingEntry(minutesText: string, pagesText: string): {
  value: ReadingEntry | null;
  errors: ReadingEntryErrors;
} {
  const errors: ReadingEntryErrors = {};
  const minutesRaw = minutesText.trim();
  const pagesRaw = pagesText.trim();

  let minutes = 0;
  if (minutesRaw === '') errors.minutes = 'Enter the minutes you read.';
  else if (!WHOLE_NUMBER.test(minutesRaw)) errors.minutes = 'Use a whole number of minutes, like 15.';
  else {
    minutes = Number(minutesRaw);
    if (minutes > MAX_MINUTES_PER_DAY) errors.minutes = 'That’s more than a day. Check the number?';
  }

  let pages: number | null = null;
  if (pagesRaw !== '') {
    if (!WHOLE_NUMBER.test(pagesRaw)) errors.pages = 'Use a whole number of pages, or leave it empty.';
    else {
      pages = Number(pagesRaw);
      if (pages > MAX_PAGES_PER_DAY) errors.pages = 'That’s a lot of pages. Check the number?';
    }
  }

  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value: { minutes, pages }, errors };
}

/** For values that reach the service directly (not from text fields). */
export function isValidReadingEntry(entry: ReadingEntry): boolean {
  const okMinutes = Number.isInteger(entry.minutes) && entry.minutes >= 0 && entry.minutes <= MAX_MINUTES_PER_DAY;
  const okPages =
    entry.pages === null ||
    (Number.isInteger(entry.pages) && entry.pages >= 0 && entry.pages <= MAX_PAGES_PER_DAY);
  return okMinutes && okPages;
}

export function isValidTargetMinutes(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= MAX_TARGET_MINUTES);
}
