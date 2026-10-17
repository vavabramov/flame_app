import { completionRate } from '@/features/streaks/streak-calculator';
import { type LocalDate, weekdayOf } from '@/lib/dates';

import { type HeatmapInput, buildHabitHeatmap, heatmapWindowDays } from './build-habit-heatmap';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const MON_WED_FRI = [1, 3, 5];

const input = (overrides: Partial<HeatmapInput> = {}): HeatmapInput => ({
  today: '2024-01-10', // Wednesday
  scheduleDays: EVERY_DAY,
  startDate: '2023-12-01',
  completed: new Set<LocalDate>(),
  lapses: new Set<LocalDate>(),
  habitType: 'build',
  weeks: 6,
  ...overrides,
});

const cellFor = (heatmap: ReturnType<typeof buildHabitHeatmap>, date: string) =>
  heatmap.columns.flat().find((c) => c.dateKey === date);

describe('heatmap grid', () => {
  it('has one Monday-first column per week, ending with the week of today', () => {
    const heatmap = buildHabitHeatmap(input());
    expect(heatmap.columns).toHaveLength(6);
    for (const column of heatmap.columns) {
      expect(column).toHaveLength(7);
      expect(column.map((c) => weekdayOf(c.dateKey))).toEqual([1, 2, 3, 4, 5, 6, 0]);
    }
    const last = heatmap.columns[5];
    expect(last[0].dateKey).toBe('2024-01-08');
    expect(last[2]).toMatchObject({ dateKey: '2024-01-10', isToday: true });
    expect(heatmap.summary.from).toBe('2023-12-04');
  });

  it('runs on consecutive calendar days across a year boundary', () => {
    const days = buildHabitHeatmap(input()).columns.flat().map((c) => c.dateKey);
    expect(days).toContain('2023-12-31');
    expect(days[days.indexOf('2023-12-31') + 1]).toBe('2024-01-01');
    expect(new Set(days).size).toBe(days.length);
  });

  it('includes leap day in the right place', () => {
    const heatmap = buildHabitHeatmap(input({ today: '2024-03-01', weeks: 2 }));
    const days = heatmap.columns.flat().map((c) => c.dateKey);
    expect(days.slice(days.indexOf('2024-02-28'), days.indexOf('2024-02-28') + 3)).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
    expect(cellFor(heatmap, '2024-02-29')?.accessibleLabel).toBe('Thursday, February 29: no check-in');
  });

  it('is not shifted by a daylight-saving change (tests run in America/New_York)', () => {
    const heatmap = buildHabitHeatmap(input({ today: '2024-03-13', weeks: 2 }));
    const days = heatmap.columns.flat().map((c) => c.dateKey);
    expect(days.slice(days.indexOf('2024-03-09'), days.indexOf('2024-03-09') + 3)).toEqual([
      '2024-03-09',
      '2024-03-10',
      '2024-03-11',
    ]);
    expect(weekdayOf('2024-03-10')).toBe(0);
    expect(cellFor(heatmap, '2024-03-10')?.accessibleLabel).toMatch(/^Sunday, March 10:/);
  });

  it('places month labels where a month begins, without collisions', () => {
    const heatmap = buildHabitHeatmap(input({ weeks: 26 }));
    const labels = heatmap.monthLabels;
    expect(labels.map((l) => l.label)).toContain('Jan');
    for (let i = 1; i < labels.length; i += 1) expect(labels[i].column - labels[i - 1].column).toBeGreaterThanOrEqual(3);
    const jan = labels.find((l) => l.label === 'Jan')!;
    expect(heatmap.columns[jan.column].some((c) => c.dateKey === '2024-01-01')).toBe(true);
  });
});

describe('heatmap statuses', () => {
  const heatmap = buildHabitHeatmap(
    input({
      scheduleDays: MON_WED_FRI,
      startDate: '2024-01-01',
      completed: new Set(['2024-01-01', '2024-01-03']),
    }),
  );

  it('marks a completed scheduled day', () => {
    expect(cellFor(heatmap, '2024-01-01')).toMatchObject({ status: 'completed', scheduled: true, completed: true });
    expect(cellFor(heatmap, '2024-01-01')?.accessibleLabel).toBe('Monday, January 1: completed');
  });

  it('marks a missed scheduled day', () => {
    expect(cellFor(heatmap, '2024-01-05')).toMatchObject({ status: 'missed', scheduled: true, completed: false });
  });

  it('keeps unscheduled days distinct from misses', () => {
    expect(cellFor(heatmap, '2024-01-02')).toMatchObject({ status: 'unscheduled', scheduled: false });
    expect(cellFor(heatmap, '2024-01-02')?.accessibleLabel).toBe('Tuesday, January 2: not scheduled');
  });

  it('marks today as open and later days as future', () => {
    expect(cellFor(heatmap, '2024-01-10')?.status).toBe('open');
    expect(cellFor(heatmap, '2024-01-12')?.status).toBe('future');
    expect(cellFor(heatmap, '2024-01-14')?.status).toBe('future');
  });

  it('marks days before the habit started without calling them misses', () => {
    expect(cellFor(heatmap, '2023-12-29')?.status).toBe('not-started');
  });
});

describe('Break habits', () => {
  const heatmap = buildHabitHeatmap(
    input({
      habitType: 'break',
      startDate: '2024-01-06',
      completed: new Set(['2024-01-06', '2024-01-07', '2024-01-09']),
      lapses: new Set(['2024-01-08']),
    }),
  );

  it('uses success-day wording and shows lapses distinctly', () => {
    expect(cellFor(heatmap, '2024-01-06')?.accessibleLabel).toBe('Saturday, January 6: made it');
    expect(cellFor(heatmap, '2024-01-08')).toMatchObject({ status: 'lapse', lapse: true, completed: false });
    expect(cellFor(heatmap, '2024-01-08')?.accessibleLabel).toBe('Monday, January 8: lapse logged');
  });

  it('treats a day with no check-in as no check-in, not as avoided', () => {
    const empty = buildHabitHeatmap(input({ habitType: 'break', startDate: '2024-01-06' }));
    expect(cellFor(empty, '2024-01-07')?.status).toBe('missed');
    expect(empty.summary.completed).toBe(0);
  });

  it('counts lapses in the denominator but never as successes', () => {
    // Jan 6–9 elapsed (today, the 10th, is open): 3 made it, 1 lapse.
    expect(heatmap.summary).toMatchObject({ completed: 3, scheduled: 4, rate: 0.75 });
  });
});

describe('heatmap summary', () => {
  it('matches the completion-rate calculation for the same window', () => {
    const cases: HeatmapInput[] = [
      input({ scheduleDays: MON_WED_FRI, startDate: '2023-11-01', completed: new Set(['2023-12-04', '2024-01-08']) }),
      input({ completed: new Set(['2024-01-09', '2024-01-10']), startDate: '2024-01-05' }),
      input({
        habitType: 'break',
        completed: new Set(['2024-01-08']),
        lapses: new Set(['2024-01-09', '2024-01-10']),
        startDate: '2024-01-01',
      }),
    ];
    for (const c of cases) {
      const heatmap = buildHabitHeatmap(c);
      const rate = completionRate(
        { scheduleDays: c.scheduleDays, startDate: c.startDate, completedDates: c.completed, lapseDates: c.lapses },
        c.today,
        heatmapWindowDays(heatmap),
      );
      expect({ completed: heatmap.summary.completed, scheduled: heatmap.summary.scheduled, rate: heatmap.summary.rate }).toEqual(rate);
    }
  });

  it('excludes future days and an open today', () => {
    const heatmap = buildHabitHeatmap(input({ startDate: '2024-01-08', completed: new Set(['2024-01-08']) }));
    // Mon 8 done, Tue 9 missed, Wed 10 (today) open, Thu–Sun future.
    expect(heatmap.summary).toMatchObject({ completed: 1, scheduled: 2, rate: 0.5 });
  });

  it('reports no history for a brand-new habit', () => {
    const heatmap = buildHabitHeatmap(input({ startDate: '2024-01-10' }));
    expect(heatmap.hasHistory).toBe(false);
    expect(heatmap.summary.rate).toBeNull();
  });
});
