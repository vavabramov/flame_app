import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ProgressCalendar } from '@/components/ProgressCalendar';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { habitStartDate, useHabitStore } from '@/features/habits/habit-store';
import { describeSchedule } from '@/features/habits/habit.validation';
import { type CompletionRate, completionRate } from '@/features/streaks/streak-calculator';
import { type YearMonth, addMonths, compareYearMonths, yearMonthOf } from '@/lib/dates';
import { colors, withAlpha } from '@/theme/colors';
import { GUTTER, radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

const formatRate = ({ rate }: CompletionRate) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);
const rateDetail = ({ completed, scheduled }: CompletionRate) =>
  scheduled === 0 ? 'No scheduled days yet' : `${completed} of ${scheduled} scheduled days`;

export default function ProgressScreen() {
  const { today, activeHabits, archivedHabits, completions, stats } = useHabitStore();
  const habits = [...activeHabits, ...archivedHabits];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(today));

  const habit = habits.find((h) => h.id === selectedId) ?? habits[0];

  if (!habit) {
    return (
      <Screen title="Progress">
        <EmptyState
          icon="calendar"
          iconFallback="▦"
          title="No progress to show yet"
          message="Create a habit and check in. Your calendar and completion rates will build up here."
          actionLabel="Create a habit"
          onAction={() => router.push('/habits/new')}
        />
      </Screen>
    );
  }

  const done = completions.get(habit.id) ?? new Set<string>();
  const summary = stats.get(habit.id);
  const history = { scheduleDays: habit.scheduleDays, startDate: habitStartDate(habit), completedDates: done };
  const week = completionRate(history, today, 7);
  const month30 = completionRate(history, today, 30);

  // The calendar can go back to the first month with any history.
  let earliest = habitStartDate(habit);
  for (const date of done) if (date < earliest) earliest = date;
  const currentMonth = yearMonthOf(today);
  const firstMonth = yearMonthOf(earliest);

  const select = (id: string) => {
    setSelectedId(id);
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
              accessibilityLabel={`${h.name}${h.archivedAt ? ', archived' : ''}`}
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

      <Text style={type.footnote}>
        {describeSchedule(habit.scheduleDays)}
        {habit.archivedAt ? ' · Archived' : ''}
      </Text>

      <View style={styles.tiles}>
        <StatTile label="Current streak" value={String(summary?.currentStreak ?? 0)} detail="in a row" accent={colors.accent} />
        <StatTile label="Best streak" value={String(summary?.bestStreak ?? 0)} detail="all time" />
        <StatTile label="Last 7 days" value={formatRate(week)} detail={rateDetail(week)} />
        <StatTile label="Last 30 days" value={formatRate(month30)} detail={rateDetail(month30)} />
      </View>

      {done.size === 0 ? (
        <Card style={styles.hint}>
          <Text style={type.headline}>No check-ins yet</Text>
          <Text style={type.callout}>Check in on the Today tab and this calendar starts filling in.</Text>
        </Card>
      ) : null}

      <Card>
        <ProgressCalendar
          month={month}
          today={today}
          scheduleDays={habit.scheduleDays}
          startDate={habitStartDate(habit)}
          completed={done}
          color={habit.color}
          canGoBack={compareYearMonths(month, firstMonth) > 0}
          canGoForward={compareYearMonths(month, currentMonth) < 0}
          onChangeMonth={(delta) => setMonth((m) => addMonths(m, delta))}
        />
      </Card>

      <Text style={type.footnote}>
        Rates count only the days this habit is scheduled, starting from the day you created it. Today is
        included once you check in, so an unfinished day never lowers your rate. Future days are never
        counted.
      </Text>
    </Screen>
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  hint: { gap: spacing.xs },
});
