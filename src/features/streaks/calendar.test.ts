import { type DayStatusContext, buildMonthGrid, dayStatus } from './calendar';

const MON_WED_FRI = [1, 3, 5];
const ctx = (overrides: Partial<DayStatusContext> = {}): DayStatusContext => ({
  today: '2024-01-10',
  scheduleDays: MON_WED_FRI,
  startDate: '2024-01-01',
  completed: new Set(['2024-01-01', '2024-01-02', '2024-01-05']),
  lapses: new Set(),
  ...overrides,
});

describe('day status', () => {
  it('marks every stored completion, even on unscheduled days', () => {
    expect(dayStatus('2024-01-01', ctx())).toBe('completed'); // Mon
    expect(dayStatus('2024-01-02', ctx())).toBe('completed'); // Tue, unscheduled
    expect(dayStatus('2024-01-05', ctx())).toBe('completed'); // Fri
  });

  it('marks past scheduled days without a check-in as missed', () => {
    expect(dayStatus('2024-01-03', ctx())).toBe('missed'); // Wed
    expect(dayStatus('2024-01-08', ctx())).toBe('missed'); // Mon
  });

  it('never marks today, unscheduled or future days as missed', () => {
    expect(dayStatus('2024-01-10', ctx())).toBe('open'); // Wed, today
    expect(dayStatus('2024-01-09', ctx())).toBe('unscheduled'); // Tue
    expect(dayStatus('2024-01-11', ctx())).toBe('future'); // Thu, unscheduled and upcoming
    expect(dayStatus('2024-01-12', ctx())).toBe('future'); // Fri, scheduled and upcoming
  });

  it('separates days before the habit started from misses', () => {
    expect(dayStatus('2023-12-29', ctx())).toBe('not-started'); // Fri before start
    expect(dayStatus('2023-12-28', ctx())).toBe('unscheduled'); // Thu
  });

  it('ignores a future-dated completion', () => {
    expect(dayStatus('2024-01-12', ctx({ completed: new Set(['2024-01-12']) }))).toBe('future');
  });

  it('shows lapses distinctly, and never as a success', () => {
    const c = ctx({ completed: new Set(['2024-01-08']), lapses: new Set(['2024-01-08', '2024-01-10']) });
    expect(dayStatus('2024-01-08', c)).toBe('lapse');
    expect(dayStatus('2024-01-10', c)).toBe('lapse');
  });
});

describe('month grid', () => {
  it('lays out a Monday-first month with padding', () => {
    // February 2024 starts on a Thursday and has 29 days.
    const weeks = buildMonthGrid(
      { year: 2024, month: 2 },
      ctx({ today: '2024-02-15', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: '2024-02-01', completed: new Set() }),
    );
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]?.date).toBe('2024-02-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(29);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().find((c) => c?.isToday)?.date).toBe('2024-02-15');
  });
});
