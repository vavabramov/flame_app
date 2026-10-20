import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HabitIcon } from '@/components/HabitIcon';
import { HabitTypeBadge } from '@/components/HabitTypeSelector';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useHabitStore } from '@/features/habits/habit-store';
import { tracksReading } from '@/features/habits/habit-template';
import { HABIT_TYPE_COPY, type HabitType } from '@/features/habits/habit-type';
import { type Habit } from '@/features/habits/habit.types';
import { describeSchedule, parseReminderTime } from '@/features/habits/habit.validation';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

function reminderLabel(time: string | null): string | null {
  const parsed = time ? parseReminderTime(time) : null;
  if (!parsed) return null;
  return new Date(2000, 0, 1, parsed.hour, parsed.minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HabitsScreen() {
  const { activeHabits, archivedHabits, stats, setHabitArchived } = useHabitStore();
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<'all' | HabitType>('all');
  const hasBothTypes = new Set(activeHabits.map((h) => h.type)).size > 1;
  const visibleHabits = hasBothTypes && filter !== 'all' ? activeHabits.filter((h) => h.type === filter) : activeHabits;
  const openNew = () => router.push('/habits/new');

  const restore = async (habit: Habit) => {
    try {
      await setHabitArchived(habit.id, false);
    } catch (error) {
      Alert.alert('Couldn’t restore habit', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen
      title="Habits"
      action={
        activeHabits.length > 0 ? (
          <Button label="New" onPress={openNew} icon="plus" iconFallback="+" compact variant="secondary" />
        ) : null
      }>
      {activeHabits.length === 0 ? (
        <EmptyState
          icon="list.bullet"
          iconFallback="≡"
          title="No active habits"
          message={
            archivedHabits.length > 0
              ? 'Create a new habit, or restore one from the archive below.'
              : 'Habits you create appear here. Start with one you can do on most days.'
          }
          actionLabel="Create a habit"
          onAction={openNew}
        />
      ) : (
        <View style={styles.list}>
          {hasBothTypes ? (
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'build', label: HABIT_TYPE_COPY.build.label },
                { value: 'break', label: HABIT_TYPE_COPY.break.label },
              ]}
              accessibilityLabel="Filter habits"
            />
          ) : null}
          {visibleHabits.map((habit) => {
            const reminder = reminderLabel(habit.reminderTime);
            const streak = stats.get(habit.id)?.currentStreak ?? 0;
            return (
              <Pressable
                key={habit.id}
                onPress={() => router.push({ pathname: '/habits/[id]', params: { id: habit.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${habit.name}, ${HABIT_TYPE_COPY[habit.type].label}, ${describeSchedule(habit.scheduleDays)}${reminder ? `, reminder at ${reminder}` : ''}`}
                accessibilityHint="Opens the habit to edit or archive it"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <HabitIcon icon={habit.icon} color={habit.color} />
                <View style={styles.rowText}>
                  <Text style={type.headline} numberOfLines={1} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
                    {habit.name}
                  </Text>
                  <View style={styles.badges}>
                    <HabitTypeBadge habitType={habit.type} />
                    {tracksReading(habit.template) ? <Text style={type.footnote}>📖 Read More</Text> : null}
                  </View>
                  <Text style={type.footnote} numberOfLines={2} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
                    {describeSchedule(habit.scheduleDays)}
                    {reminder ? ` · ${reminder}` : ''}
                    {streak > 0 ? ` · ${streak} in a row` : ''}
                  </Text>
                </View>
                <Icon name="chevron.right" size={14} color={colors.textTertiary} fallback="›" />
              </Pressable>
            );
          })}
        </View>
      )}

      {archivedHabits.length > 0 ? (
        <View style={styles.archive}>
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            style={styles.archiveToggle}>
            <Text style={type.caption}>Archived ({archivedHabits.length})</Text>
            <Icon
              name={showArchived ? 'chevron.up' : 'chevron.down'}
              size={12}
              color={colors.textSecondary}
              fallback={showArchived ? '˄' : '˅'}
            />
          </Pressable>
          {showArchived ? (
            <>
              <Text style={type.footnote}>Archived habits keep their full history and best streak.</Text>
              {archivedHabits.map((habit) => (
                <View key={habit.id} style={[styles.row, styles.archivedRow]}>
                  <HabitIcon icon={habit.icon} color={habit.color} size={36} />
                  <Text style={[type.body, styles.rowText]} numberOfLines={1}>
                    {habit.name}
                  </Text>
                  <Button label="Restore" onPress={() => restore(habit)} compact variant="secondary" />
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  rowText: { flex: 1, gap: spacing.xxs },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  archive: { gap: spacing.sm, marginTop: spacing.md },
  archiveToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  archivedRow: { paddingVertical: spacing.md, opacity: 0.85 },
});
