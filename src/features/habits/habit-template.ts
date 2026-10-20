/**
 * Specialized habit templates. Only one exists for now: Read More.
 *
 * A template adds structured tracking (reading minutes, optional pages) on top of
 * an ordinary habit. It does not change check-ins or streaks: recording minutes
 * never marks the habit complete, and the minutes target is guidance only.
 */
import { DEFAULT_HABIT_COLOR } from '@/theme/colors';

import { type HabitInput } from './habit.types';

export const HABIT_TEMPLATES = ['read_more'] as const;
export type HabitTemplate = (typeof HABIT_TEMPLATES)[number];

export function isHabitTemplate(value: unknown): value is HabitTemplate {
  return typeof value === 'string' && (HABIT_TEMPLATES as readonly string[]).includes(value);
}

/** Unknown stored values read as "no template", i.e. an ordinary habit. */
export function parseHabitTemplate(value: unknown): HabitTemplate | null {
  return isHabitTemplate(value) ? value : null;
}

export const tracksReading = (template: HabitTemplate | null) => template === 'read_more';

export const READ_MORE_DEFAULT_TARGET = 15;

export const READ_MORE_TEMPLATE = {
  title: 'Read More',
  description: 'Log minutes read each day, and pages if you like.',
  defaults: {
    type: 'build',
    template: 'read_more',
    name: 'Read',
    icon: '📚',
    color: DEFAULT_HABIT_COLOR,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: null,
    targetMinutes: READ_MORE_DEFAULT_TARGET,
  } satisfies HabitInput,
};
