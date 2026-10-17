import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HabitCard } from '@/components/HabitCard';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { StreakHero } from '@/components/StreakHero';
import { useHabitStore } from '@/features/habits/habit-store';
import { localDateToDate } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { spacing, TOUCH_TARGET } from '@/theme/spacing';
import { type } from '@/theme/typography';

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { today, activeHabits, stats, toggleToday, toggleLapseToday } = useHabitStore();

  const scheduled = activeHabits.filter((h) => stats.get(h.id)?.isScheduledToday);
  const resting = activeHabits.length - scheduled.length;
  const completedCount = scheduled.filter((h) => stats.get(h.id)?.isCompletedToday).length;

  let leader: { streak: number; name: string; icon: string } | null = null;
  for (const habit of activeHabits) {
    const streak = stats.get(habit.id)?.currentStreak ?? 0;
    if (streak > 0 && (leader === null || streak > leader.streak)) {
      leader = { streak, name: habit.name, icon: habit.icon };
    }
  }

  const dateLabel = localDateToDate(today).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const openNewHabit = () => router.push('/habits/new');

  return (
    <Screen
      title={greeting(new Date().getHours())}
      subtitle={dateLabel}
      action={
        activeHabits.length > 0 ? (
          <Pressable
            onPress={openNewHabit}
            accessibilityRole="button"
            accessibilityLabel="New habit"
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}>
            <Icon name="plus" size={18} color={colors.textPrimary} fallback="+" />
          </Pressable>
        ) : null
      }>
      {activeHabits.length === 0 ? (
        <>
          <StreakHero leader={null} completedToday={0} scheduledToday={0} />
          <EmptyState
            icon="sparkles"
            iconFallback="✦"
            title="Create your first habit"
            message="Pick something small you want to do regularly. You can choose which days it’s scheduled."
            actionLabel="Create your first habit"
            onAction={openNewHabit}
          />
        </>
      ) : (
        <>
          <StreakHero leader={leader} completedToday={completedCount} scheduledToday={scheduled.length} />

          <View style={styles.sectionHeader}>
            <Text style={type.caption} accessibilityRole="header">
              Today
            </Text>
            {scheduled.length > 0 ? (
              <Text style={type.footnote}>Tap to check in</Text>
            ) : null}
          </View>

          {scheduled.length === 0 ? (
            <Card style={styles.restCard}>
              <Text style={type.headline}>A rest day</Text>
              <Text style={type.callout}>
                None of your habits are scheduled today. Your streaks are safe.
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {scheduled.map((habit) => {
                const summary = stats.get(habit.id);
                return (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    completed={summary?.isCompletedToday ?? false}
                    lapsed={summary?.isLapsedToday ?? false}
                    currentStreak={summary?.currentStreak ?? 0}
                    onToggle={() => toggleToday(habit.id)}
                    onToggleLapse={() => toggleLapseToday(habit.id)}
                  />
                );
              })}
            </View>
          )}

          {resting > 0 && scheduled.length > 0 ? (
            <Text style={[type.footnote, styles.resting]}>
              {resting === 1 ? '1 habit isn’t' : `${resting} habits aren’t`} scheduled today.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  list: { gap: spacing.md },
  restCard: { gap: spacing.xs },
  resting: { textAlign: 'center' },
});
