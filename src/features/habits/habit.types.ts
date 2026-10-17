import { type LocalDate } from '@/lib/dates';

import { type HabitType } from './habit-type';

export type { HabitType } from './habit-type';

export type Habit = {
  id: string;
  type: HabitType;
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

/** A day the unwanted behavior happened (Break habits). Never counts as a success. */
export type HabitLapse = {
  id: string;
  habitId: string;
  localDate: LocalDate; // YYYY-MM-DD
  loggedAt: string; // ISO timestamp
};

/** What the create/edit form submits. */
export type HabitInput = {
  type: HabitType;
  name: string;
  icon: string;
  color: string;
  scheduleDays: number[];
  reminderTime: string | null;
};
