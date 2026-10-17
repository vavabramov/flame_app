import { buildMonthGrid, calendarDayState } from './calendar';

const MON_WED_FRI = [1, 3, 5];

describe('calendar day state', () => {
  const done = new Set(['2024-01-01', '2024-01-02', '2024-01-05']);
  const state = (date: string) => calendarDayState(date, '2024-01-10', MON_WED_FRI, '2024-01-01', done);

  it('marks every stored completion, even on unscheduled days', () => {
    expect(state('2024-01-01')).toBe('completed'); // Mon
    expect(state('2024-01-02')).toBe('completed'); // Tue, unscheduled
    expect(state('2024-01-05')).toBe('completed'); // Fri
  });

  it('marks past scheduled days without a completion as missed', () => {
    expect(state('2024-01-03')).toBe('missed'); // Wed
    expect(state('2024-01-08')).toBe('missed'); // Mon
  });

  it('never marks today or future days as missed', () => {
    expect(state('2024-01-10')).toBe('today'); // Wed, open
    expect(state('2024-01-12')).toBe('upcoming'); // Fri
    expect(state('2024-01-11')).toBe('off'); // Thu, unscheduled
  });

  it('does not mark days before the habit started as missed', () => {
    expect(calendarDayState('2023-12-29', '2024-01-10', MON_WED_FRI, '2024-01-01', done)).toBe('off');
  });

  it('ignores a future-dated completion', () => {
    const future = new Set(['2024-01-12']);
    expect(calendarDayState('2024-01-12', '2024-01-10', MON_WED_FRI, '2024-01-01', future)).toBe('upcoming');
  });
});

describe('month grid', () => {
  it('lays out a Monday-first month with padding', () => {
    // February 2024 starts on a Thursday and has 29 days.
    const weeks = buildMonthGrid({ year: 2024, month: 2 }, '2024-02-15', [0, 1, 2, 3, 4, 5, 6], '2024-02-01', new Set());
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]?.date).toBe('2024-02-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(29);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().find((c) => c?.isToday)?.date).toBe('2024-02-15');
  });
});
