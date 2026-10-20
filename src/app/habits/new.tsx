import { router } from 'expo-router';
import { useState } from 'react';

import { HabitForm } from '@/components/HabitForm';
import { TemplateCard } from '@/components/TemplateCard';
import { READ_MORE_TEMPLATE } from '@/features/habits/habit-template';
import { DEFAULT_HABIT_TYPE } from '@/features/habits/habit-type';
import { useHabitStore } from '@/features/habits/habit-store';
import { type HabitInput } from '@/features/habits/habit.types';
import { ALL_DAYS } from '@/features/habits/habit.validation';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/theme/colors';

const BLANK: HabitInput = {
  type: DEFAULT_HABIT_TYPE,
  template: null,
  targetMinutes: null,
  name: '',
  icon: DEFAULT_HABIT_ICON,
  color: DEFAULT_HABIT_COLOR,
  scheduleDays: [...ALL_DAYS],
  reminderTime: null,
};

export default function NewHabitScreen() {
  const { createHabit, reminders, settings, requestReminders } = useHabitStore();
  const [useTemplate, setUseTemplate] = useState(false);

  return (
    <HabitForm
      // Applying or removing the template restarts the form from its defaults.
      key={useTemplate ? 'read_more' : 'blank'}
      title="New habit"
      submitLabel="Save"
      initial={useTemplate ? READ_MORE_TEMPLATE.defaults : BLANK}
      header={
        <TemplateCard
          icon={READ_MORE_TEMPLATE.defaults.icon}
          title={READ_MORE_TEMPLATE.title}
          description={READ_MORE_TEMPLATE.description}
          applied={useTemplate}
          onToggle={() => setUseTemplate((v) => !v)}
        />
      }
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
