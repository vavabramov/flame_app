import { type LocalDate } from '@/lib/dates';

import { type HabitTemplate } from './habit-template';
import { type HabitType } from './habit-type';

export type { HabitTemplate } from './habit-template';
export type { HabitType } from './habit-type';

export type Habit = {
  id: string;
  type: HabitType;
  /** Specialized template, or null for an ordinary habit. */
  template: HabitTemplate | null;
  /** Read More: daily minutes target. Guidance only; never affects check-ins or streaks. */
  targetMinutes: number | null;
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

/** Read More: what was read on one local date. Separate from the day's check-in. */
export type HabitDayMetric = {
  id: string;
  habitId: string;
  localDate: LocalDate; // YYYY-MM-DD
  minutes: number; // whole, ≥ 0
  pages: number | null; // whole, ≥ 0, optional
  recordedAt: string; // ISO timestamp of the first save
  updatedAt: string; // ISO timestamp of the latest save
};

/** What the create/edit form submits. */
export type HabitInput = {
  type: HabitType;
  template: HabitTemplate | null;
  targetMinutes: number | null;
  name: string;
  icon: string;
  color: string;
  scheduleDays: number[];
  reminderTime: string | null;
};
