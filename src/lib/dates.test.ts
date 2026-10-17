import {
  addDays,
  addMonths,
  datesOfMonth,
  daysBetween,
  isValidLocalDate,
  msUntilNextLocalMidnight,
  toLocalDate,
  weekdayOf,
} from './dates';

const HOUR = 3_600_000;

describe('local date arithmetic', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(daysBetween('2023-12-30', '2024-01-02')).toBe(3);
  });

  it('validates real calendar dates', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2023-02-29')).toBe(false);
    expect(isValidLocalDate('2024-13-01')).toBe(false);
    expect(isValidLocalDate('2024-1-1')).toBe(false);
  });

  it('numbers weekdays with 0 = Sunday', () => {
    expect(weekdayOf('2024-01-07')).toBe(0);
    expect(weekdayOf('2024-02-29')).toBe(4);
    expect(weekdayOf('1969-12-31')).toBe(3);
  });

  it('lists the dates of a month', () => {
    expect(datesOfMonth({ year: 2024, month: 2 })).toHaveLength(29);
    expect(datesOfMonth({ year: 2023, month: 2 })).toHaveLength(28);
    expect(datesOfMonth({ year: 2024, month: 12 }).at(-1)).toBe('2024-12-31');
  });

  it('adds months across years', () => {
    expect(addMonths({ year: 2024, month: 12 }, 1)).toEqual({ year: 2025, month: 1 });
    expect(addMonths({ year: 2024, month: 1 }, -1)).toEqual({ year: 2023, month: 12 });
  });
});

// `npm test` runs with TZ=America/New_York so these exercise a real DST zone.
describe('daylight-saving transitions (America/New_York)', () => {
  it('is running in a time zone with DST', () => {
    expect(new Date(2024, 0, 1).getTimezoneOffset()).not.toBe(new Date(2024, 6, 1).getTimezoneOffset());
  });

  it('uses the local calendar day, not the UTC day', () => {
    // 22:30 EST on Mar 9 is already Mar 10 in UTC.
    const lateEvening = new Date('2024-03-10T03:30:00Z');
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2024-03-10');
    expect(toLocalDate(lateEvening)).toBe('2024-03-09');
  });

  it('keeps late-night times on the right day around the transitions', () => {
    expect(toLocalDate(new Date(2024, 2, 10, 23, 30))).toBe('2024-03-10');
    expect(toLocalDate(new Date(2024, 10, 3, 23, 30))).toBe('2024-11-03');
    expect(toLocalDate(new Date(2024, 10, 3, 0, 30))).toBe('2024-11-03');
  });

  it('measures the 23-hour and 25-hour days correctly', () => {
    expect(msUntilNextLocalMidnight(new Date(2024, 2, 10, 0, 0))).toBe(23 * HOUR);
    expect(msUntilNextLocalMidnight(new Date(2024, 10, 3, 0, 0))).toBe(25 * HOUR);
    // Calendar arithmetic is unaffected by the short/long day.
    expect(addDays('2024-03-10', 1)).toBe('2024-03-11');
    expect(addDays('2024-11-03', 1)).toBe('2024-11-04');
  });
});
