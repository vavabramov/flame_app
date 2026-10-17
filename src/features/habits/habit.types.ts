import { type LocalDate } from '@/lib/dates';

export type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Weekdays, 0 = Sunday … 6 = Saturday. Sorted, unique, never empty. */
  scheduleDays: number[];
  /** Local wall-clock time `HH:mm`, or null for no reminder. */
  reminderTime: string | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  archivedAt: string | null; // ISO timestamp
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  localDate: LocalDate; // YYYY-MM-DD
  completedAt: string; // ISO timestamp
};

/** What the create/edit form submits. */
export type HabitInput = {
  name: string;
  icon: string;
  color: string;
  scheduleDays: number[];
  reminderTime: string | null;
};
