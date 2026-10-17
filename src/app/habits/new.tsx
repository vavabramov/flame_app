import { router } from 'expo-router';

import { HabitForm } from '@/components/HabitForm';
import { DEFAULT_HABIT_TYPE } from '@/features/habits/habit-type';
import { useHabitStore } from '@/features/habits/habit-store';
import { ALL_DAYS } from '@/features/habits/habit.validation';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/theme/colors';

export default function NewHabitScreen() {
  const { createHabit, reminders, settings, requestReminders } = useHabitStore();

  return (
    <HabitForm
      title="New habit"
      submitLabel="Save"
      initial={{
        type: DEFAULT_HABIT_TYPE,
        name: '',
        icon: DEFAULT_HABIT_ICON,
        color: DEFAULT_HABIT_COLOR,
        scheduleDays: [...ALL_DAYS],
        reminderTime: null,
      }}
      onSubmit={async (input) => {
        await createHabit(input);
        router.back();
      }}
      onCancel={() => router.back()}
      reminderPermission={reminders.permission}
      remindersEnabledGlobally={settings.remindersEnabled}
      onRequestReminderPermission={requestReminders}
    />
  );
}
