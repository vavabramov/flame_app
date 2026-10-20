import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HabitForm } from '@/components/HabitForm';
import { useHabitStore } from '@/features/habits/habit-store';
import { colors } from '@/theme/colors';
import { GUTTER, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, stats, updateHabit, setHabitArchived, reminders, settings, requestReminders } = useHabitStore();
  const habit = habits.find((h) => h.id === id);

  if (!habit) {
    return (
      <View style={styles.missing}>
        <EmptyState
          icon="questionmark.circle"
          iconFallback="?"
          title="Habit not found"
          message="It may have been removed. Your other habits are unaffected."
        />
        <Button label="Close" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  const archived = habit.archivedAt !== null;
  const best = stats.get(habit.id)?.bestStreak ?? 0;

  const confirmArchive = () => {
    Alert.alert(
      `Archive “${habit.name}”?`,
      'It leaves Today and its reminders stop. Its history and best streak are kept, and you can restore it from Habits › Archived.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await setHabitArchived(habit.id, true);
              router.back();
            } catch (error) {
              Alert.alert('Couldn’t archive habit', error instanceof Error ? error.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const restore = async () => {
    try {
      await setHabitArchived(habit.id, false);
    } catch (error) {
      Alert.alert('Couldn’t restore habit', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <HabitForm
      key={habit.id}
      title={archived ? 'Archived habit' : 'Edit habit'}
      submitLabel="Save"
      initial={{
        type: habit.type,
        template: habit.template,
        targetMinutes: habit.targetMinutes,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        scheduleDays: habit.scheduleDays,
        reminderTime: habit.reminderTime,
      }}
      onSubmit={async (input) => {
        await updateHabit(habit.id, input);
        router.back();
      }}
      onCancel={() => router.back()}
      reminderPermission={reminders.permission}
      remindersEnabledGlobally={settings.remindersEnabled}
      onRequestReminderPermission={requestReminders}
      footer={
        <View style={styles.footer}>
          <Text style={type.footnote}>
            Changing the schedule recalculates streaks for the whole history{best > 0 ? ` (best so far: ${best})` : ''}.
            Past check-ins are never deleted.
          </Text>
          {archived ? (
            <Button label="Restore habit" onPress={restore} variant="secondary" icon="arrow.uturn.backward" iconFallback="↺" />
          ) : (
            <Button label="Archive habit" onPress={confirmArchive} variant="destructive" icon="archivebox" iconFallback="▣" />
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: colors.background, padding: GUTTER, justifyContent: 'center', gap: spacing.lg },
  footer: { gap: spacing.md, marginTop: spacing.sm },
});
