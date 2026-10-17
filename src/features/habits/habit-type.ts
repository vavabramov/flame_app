/**
 * Habit direction. Both types share the schedule, completion and streak model;
 * only the meaning of a successful day and the copy differ.
 *
 * - build: a successful day means the intended behavior was done.
 * - break: a successful day means the user got through the day without the
 *   unwanted behavior and said so ("Made it today"). Not logging a lapse is
 *   never treated as success; only an explicit check-in counts.
 *   A lapse is a separate event (see habit_lapses) and never a success.
 */
export const HABIT_TYPES = ['build', 'break'] as const;
export type HabitType = (typeof HABIT_TYPES)[number];
export const DEFAULT_HABIT_TYPE: HabitType = 'build';

export function isHabitType(value: unknown): value is HabitType {
  return typeof value === 'string' && (HABIT_TYPES as readonly string[]).includes(value);
}

/** Unknown stored values fall back to build, the pre-categories meaning. */
export function parseHabitType(value: unknown): HabitType {
  return isHabitType(value) ? value : DEFAULT_HABIT_TYPE;
}

export const tracksLapses = (type: HabitType) => type === 'break';

type HabitTypeCopy = {
  label: string;
  description: string;
  namePlaceholder: string;
  /** Primary Today action before checking in. */
  action: string;
  /** Primary Today action after checking in (tap again to undo). */
  actionDone: string;
  /** Status word for a successful day, e.g. in the heatmap. */
  successStatus: string;
  /** "18 of 22 scheduled days …" */
  summaryVerb: string;
  reminderBody: string;
};

export const HABIT_TYPE_COPY: Record<HabitType, HabitTypeCopy> = {
  build: {
    label: 'Build',
    description: 'A habit you want to do consistently.',
    namePlaceholder: 'e.g. Read 10 pages',
    action: 'Complete',
    actionDone: 'Done',
    successStatus: 'completed',
    summaryVerb: 'completed',
    reminderBody: 'A small step today keeps your flame going.',
  },
  break: {
    label: 'Break',
    description: 'A behavior you want to avoid or reduce.',
    namePlaceholder: 'e.g. No phone after 11 pm',
    action: 'Made it today',
    actionDone: 'Made it',
    successStatus: 'made it',
    summaryVerb: 'made it through',
    reminderBody: 'Made it through today? Check in when you’re ready.',
  },
};
