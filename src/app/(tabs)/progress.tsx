import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HabitHeatmap, HeatmapLegend } from '@/components/HabitHeatmap';
import { HabitIcon } from '@/components/HabitIcon';
import { HabitTypeBadge } from '@/components/HabitTypeSelector';
import { ProgressCalendar } from '@/components/ProgressCalendar';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { habitStartDate, useHabitStore } from '@/features/habits/habit-store';
import { HABIT_TYPE_COPY, tracksLapses } from '@/features/habits/habit-type';
import { describeSchedule } from '@/features/habits/habit.validation';
import {
  type HabitDayCell,
  buildHabitHeatmap,
  describeDayStatus,
} from '@/features/progress/build-habit-heatmap';
import { type DayStatusContext } from '@/features/streaks/calendar';
import { type CompletionRate, completionRate } from '@/features/streaks/streak-calculator';
import {
  type LocalDate,
  type YearMonth,
  addMonths,
  compareYearMonths,
  localDateToDate,
  yearMonthOf,
} from '@/lib/dates';
import { colors, withAlpha } from '@/theme/colors';
import { GUTTER, radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

const EMPTY = new Set<LocalDate>();
const formatRate = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);
const rateDetail = ({ completed, scheduled }: CompletionRate) =>
  scheduled === 0 ? 'No scheduled days yet' : `${completed} of ${scheduled} scheduled days`;

export default function ProgressScreen() {
  const { today, activeHabits, archivedHabits, completions, lapses, stats } = useHabitStore();
  const habits = [...activeHabits, ...archivedHabits];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(today));
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);

  const habit = habits.find((h) => h.id === selectedId) ?? habits[0];

  // React Compiler memoizes these derived values.
  const context: DayStatusContext | null = habit
    ? {
        today,
        scheduleDays: habit.scheduleDays,
        startDate: habitStartDate(habit),
        completed: completions.get(habit.id) ?? EMPTY,
        lapses: tracksLapses(habit.type) ? (lapses.get(habit.id) ?? EMPTY) : EMPTY,
      }
    : null;
  const heatmap = habit && context ? buildHabitHeatmap({ ...context, habitType: habit.type }) : null;

  if (!habit || !context || !heatmap) {
    return (
      <Screen title="Progress">
        <EmptyState
          icon="calendar"
          iconFallback="▦"
          title="No progress to show yet"
          message="Create a habit and check in. Your activity grid and completion rates will build up here."
          actionLabel="Create a habit"
          onAction={() => router.push('/habits/new')}
        />
      </Screen>
    );
  }

  const copy = HABIT_TYPE_COPY[habit.type];
  const summary = stats.get(habit.id);
  const history = {
    scheduleDays: habit.scheduleDays,
    startDate: context.startDate,
    completedDates: context.completed,
    lapseDates: context.lapses,
  };
  const week = completionRate(history, today, 7);
  const month30 = completionRate(history, today, 30);

  const selectedCell: HabitDayCell | undefined =
    heatmap.columns.flat().find((c) => c.dateKey === (selectedDate ?? today)) ?? undefined;

  // The month view can go back to the first month with any history.
  let earliest = context.startDate;
  for (const date of context.completed) if (date < earliest) earliest = date;
  const currentMonth = yearMonthOf(today);
  const firstMonth = yearMonthOf(earliest);

  const select = (id: string) => {
    setSelectedId(id);
    setSelectedDate(null);
    setMonth(currentMonth);
  };

  return (
    <Screen title="Progress">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroller}>
        {habits.map((h) => {
          const selected = h.id === habit.id;
          return (
            <Pressable
              key={h.id}
              onPress={() => select(h.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${h.name}, ${HABIT_TYPE_COPY[h.type].label}${h.archivedAt ? ', archived' : ''}`}
              style={[
                styles.chip,
                selected && { backgroundColor: withAlpha(h.color, 0.16), borderColor: h.color },
                h.archivedAt !== null && !selected && styles.chipArchived,
              ]}>
              <Text style={styles.chipIcon}>{h.icon}</Text>
              <Text style={[type.callout, selected && { color: colors.textPrimary }]} numberOfLines={1}>
                {h.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.habitHeader}>
        <HabitIcon icon={habit.icon} color={habit.color} />
        <View style={styles.habitHeaderText}>
          <Text style={type.title} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {habit.name}
          </Text>
          <View style={styles.metaRow}>
            <HabitTypeBadge habitType={habit.type} />
            <Text style={type.footnote}>
              {describeSchedule(habit.scheduleDays)}
              {habit.archivedAt ? ' · Archived' : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tiles}>
        <StatTile label="Current streak" value={String(summary?.currentStreak ?? 0)} detail="in a row" accent={colors.accent} />
        <StatTile label="Best streak" value={String(summary?.bestStreak ?? 0)} detail="all time" />
        <StatTile label="Last 7 days" value={formatRate(week.rate)} detail={rateDetail(week)} />
        <StatTile label="Last 30 days" value={formatRate(month30.rate)} detail={rateDetail(month30)} />
      </View>

      <Card style={styles.gap}>
        <View style={styles.cardHeader}>
          <Text style={type.caption} accessibilityRole="header">
            Last 6 months
          </Text>
          {heatmap.hasHistory ? <Text style={type.footnote}>{formatRate(heatmap.summary.rate)}</Text> : null}
        </View>

        {heatmap.hasHistory ? (
          <>
            <Text style={type.body} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
              {heatmap.summary.completed} of {heatmap.summary.scheduled} scheduled days {copy.summaryVerb}
            </Text>
            <HabitHeatmap
              heatmap={heatmap}
              color={habit.color}
              selectedDate={selectedCell?.dateKey ?? null}
              onSelect={(cell) => setSelectedDate(cell.dateKey)}
            />
            <HeatmapLegend color={habit.color} successLabel={capitalize(copy.successStatus)} showLapses={tracksLapses(habit.type)} />
            {selectedCell ? <DayDetail cell={selectedCell} habitType={habit.type} /> : null}
          </>
        ) : (
          <View style={styles.gapSm}>
            <Text style={type.headline}>Your activity grid starts with your first check-in</Text>
            <Text style={type.callout}>
              Each square is a day. Check in on the Today tab and the last six months fill in here.
            </Text>
          </View>
        )}
      </Card>

      <Card>
        <ProgressCalendar
          month={month}
          context={context}
          habitType={habit.type}
          color={habit.color}
          canGoBack={compareYearMonths(month, firstMonth) > 0}
          canGoForward={compareYearMonths(month, currentMonth) < 0}
          onChangeMonth={(delta) => setMonth((m) => addMonths(m, delta))}
        />
      </Card>

      <Text style={type.footnote}>
        Rates count only the days this habit is scheduled, starting from the day you created it. Today is included
        once you check in{tracksLapses(habit.type) ? ' or log a lapse' : ''}, so an unfinished day never lowers your
        rate. Future days are never counted.
        {tracksLapses(habit.type)
          ? ' For a Break habit, only days you check in with “Made it today” count as successes.'
          : ''}
      </Text>
    </Screen>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function DayDetail({ cell, habitType }: { cell: HabitDayCell; habitType: 'build' | 'break' }) {
  const date = localDateToDate(cell.dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <View style={styles.detail} accessibilityLiveRegion="polite" testID="day-detail">
      <Text style={type.headline}>{date}</Text>
      <Text style={type.footnote}>
        {cell.scheduled ? 'Scheduled' : 'Not scheduled'} · {capitalize(describeDayStatus(cell.status, habitType))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipScroller: { marginHorizontal: -GUTTER },
  chips: { gap: spacing.sm, paddingHorizontal: GUTTER },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    maxWidth: 200,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipArchived: { opacity: 0.6 },
  chipIcon: { fontSize: 16 },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  habitHeaderText: { flex: 1, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gap: { gap: spacing.md },
  gapSm: { gap: spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  detail: {
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
  },
});
