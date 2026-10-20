import { READ_MORE_TEMPLATE } from '@/features/habits/habit-template';
import { validateHabitInput } from '@/features/habits/habit.validation';

import { formatMinutesProgress, summarizeReading } from './reading-summary';
import { isValidReadingEntry, isValidTargetMinutes, parseReadingEntry } from './reading.validation';

describe('reading entry validation', () => {
  it('accepts whole minutes with or without pages', () => {
    expect(parseReadingEntry('15', '')).toEqual({ value: { minutes: 15, pages: null }, errors: {} });
    expect(parseReadingEntry(' 20 ', ' 12 ')).toEqual({ value: { minutes: 20, pages: 12 }, errors: {} });
    expect(parseReadingEntry('0', '0').value).toEqual({ minutes: 0, pages: 0 });
  });

  it('requires minutes', () => {
    expect(parseReadingEntry('', '10').errors.minutes).toBe('Enter the minutes you read.');
  });

  it('rejects negative, decimal and non-numeric values with friendly messages', () => {
    for (const bad of ['-5', '1.5', 'ten', '1e3']) {
      expect(parseReadingEntry(bad, '').errors.minutes).toMatch(/whole number/);
      expect(parseReadingEntry('10', bad).errors.pages).toMatch(/whole number/);
    }
  });

  it('rejects implausible amounts', () => {
    expect(parseReadingEntry('1441', '').errors.minutes).toBeDefined();
    expect(parseReadingEntry('1440', '').value?.minutes).toBe(1440);
    expect(parseReadingEntry('10', '10001').errors.pages).toBeDefined();
  });

  it('guards values that bypass the form', () => {
    expect(isValidReadingEntry({ minutes: 10, pages: null })).toBe(true);
    expect(isValidReadingEntry({ minutes: -1, pages: null })).toBe(false);
    expect(isValidReadingEntry({ minutes: 2.5, pages: null })).toBe(false);
    expect(isValidReadingEntry({ minutes: 10, pages: -3 })).toBe(false);
  });

  it('validates the daily target', () => {
    expect(isValidTargetMinutes(null)).toBe(true);
    expect(isValidTargetMinutes(15)).toBe(true);
    expect(isValidTargetMinutes(0)).toBe(false);
    expect(isValidTargetMinutes(601)).toBe(false);
    expect(isValidTargetMinutes(7.5)).toBe(false);
  });
});

describe('Read More template', () => {
  it('prefills a valid Build habit: Read, every day, 15-minute target', () => {
    const { value, errors } = validateHabitInput(READ_MORE_TEMPLATE.defaults);
    expect(errors).toEqual({});
    expect(value).toMatchObject({
      type: 'build',
      template: 'read_more',
      name: 'Read',
      scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      targetMinutes: 15,
    });
  });

  it('rejects an invalid target or unknown template', () => {
    expect(validateHabitInput({ ...READ_MORE_TEMPLATE.defaults, targetMinutes: 0 }).errors.targetMinutes).toBeDefined();
    expect(
      validateHabitInput({ ...READ_MORE_TEMPLATE.defaults, template: 'bogus' as never }).errors.template,
    ).toBeDefined();
  });
});

describe('reading summary', () => {
  it('has no data and no invented numbers when nothing is logged', () => {
    const s = summarizeReading([], '2024-01-10');
    expect(s.hasData).toBe(false);
    expect(s.last30).toEqual({ daysLogged: 0, minutes: 0, pages: null });
    expect(s.recent).toEqual([]);
  });

  it('totals minutes, and pages only where recorded', () => {
    const s = summarizeReading(
      [
        { localDate: '2024-01-08', minutes: 20, pages: null },
        { localDate: '2024-01-09', minutes: 15, pages: 12 },
        { localDate: '2024-01-10', minutes: 0, pages: 3 },
      ],
      '2024-01-10',
    );
    expect(s.last30).toEqual({ daysLogged: 3, minutes: 35, pages: 15 });
    expect(s.recent.map((r) => r.localDate)).toEqual(['2024-01-10', '2024-01-09', '2024-01-08']);
  });

  it('keeps pages null when no entry has pages', () => {
    const s = summarizeReading([{ localDate: '2024-01-09', minutes: 20, pages: null }], '2024-01-10');
    expect(s.allTime.pages).toBeNull();
  });

  it('uses a 30-calendar-day window including today, across a year boundary', () => {
    const s = summarizeReading(
      [
        { localDate: '2023-12-11', minutes: 5, pages: null }, // 30 days before Jan 10: outside
        { localDate: '2023-12-12', minutes: 7, pages: null }, // 29 days before: inside
        { localDate: '2024-01-10', minutes: 10, pages: null },
      ],
      '2024-01-10',
    );
    expect(s.last30.minutes).toBe(17);
    expect(s.allTime.minutes).toBe(22);
  });

  it('crosses leap day and DST transitions by calendar day', () => {
    const leap = summarizeReading(
      [
        { localDate: '2024-02-29', minutes: 10, pages: null },
        { localDate: '2024-01-31', minutes: 99, pages: null }, // 30 days before Mar 1: outside
      ],
      '2024-03-01',
    );
    expect(leap.last30.minutes).toBe(10);
    const dst = summarizeReading([{ localDate: '2024-03-10', minutes: 25, pages: 5 }], '2024-03-11');
    expect(dst.last30).toEqual({ daysLogged: 1, minutes: 25, pages: 5 });
  });

  it('ignores future-dated entries and limits recent history', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      localDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
      minutes: 10,
      pages: null,
    }));
    const s = summarizeReading([...records, { localDate: '2024-01-20', minutes: 500, pages: null }], '2024-01-10');
    expect(s.allTime.minutes).toBe(100);
    expect(s.recent).toHaveLength(7);
    expect(s.recent[0].localDate).toBe('2024-01-10');
  });

  it('formats progress with and without a target', () => {
    expect(formatMinutesProgress(12, 15)).toBe('12 / 15 min');
    expect(formatMinutesProgress(20, null)).toBe('20 min');
  });
});
