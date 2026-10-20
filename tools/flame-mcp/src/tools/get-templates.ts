import { z } from 'zod';

import { COLOR_TOKENS, ICON_TOKENS, NAME_LIMIT, READ_MORE_DEFAULTS, READ_MORE_PROFILE } from '../catalog/index';

/** Only catalog template IDs are accepted as a filter; unknown keys are rejected. */
export const getTemplatesInput = z
  .object({ templateId: z.enum([READ_MORE_PROFILE.template.id]).optional() })
  .strict();

const minutes = READ_MORE_PROFILE.metrics.reading_minutes;
const pages = READ_MORE_PROFILE.metrics.pages_read;

const READ_MORE = {
  id: READ_MORE_PROFILE.template.id,
  version: READ_MORE_PROFILE.template.version,
  title: 'Read More',
  summary: 'A daily reading habit. Log minutes read each day, and pages if you like.',
  direction: { allowed: [...READ_MORE_PROFILE.directions], note: 'Read More is a Build habit only.' },
  fields: {
    required: ['habit.name', 'habit.schedule.days'],
    optional: ['habit.reminder.localTime', 'metrics.reading_minutes.goal.value', 'presentation.icon', 'presentation.colorToken'],
  },
  defaults: {
    name: READ_MORE_DEFAULTS.name,
    scheduleDays: [...READ_MORE_DEFAULTS.days],
    reminder: READ_MORE_DEFAULTS.reminder,
    dailyTargetMinutes: READ_MORE_DEFAULTS.targetMinutes,
    icon: READ_MORE_DEFAULTS.icon,
    colorToken: READ_MORE_DEFAULTS.colorToken,
  },
  constraints: {
    nameMaxLength: NAME_LIMIT,
    scheduleDays: 'Whole numbers 0–6, 0 = Sunday … 6 = Saturday, at least one, no duplicates.',
    reminderLocalTime: '24-hour HH:mm, 00:00–23:59, or null for no reminder.',
    dailyTargetMinutes: { minimum: minutes.goal.minimum, maximum: minutes.goal.maximum, integer: true, nullable: true },
    icons: Object.keys(ICON_TOKENS),
    colorTokens: Object.keys(COLOR_TOKENS),
  },
  metrics: [
    {
      id: 'reading_minutes',
      moduleId: minutes.moduleId,
      version: minutes.version,
      label: minutes.label,
      required: minutes.required,
      unit: minutes.unit,
      entryMode: minutes.entryMode,
      constraints: { ...minutes.constraints },
    },
    {
      id: 'pages_read',
      moduleId: pages.moduleId,
      version: pages.version,
      label: pages.label,
      required: pages.required,
      unit: pages.unit,
      entryMode: pages.entryMode,
      constraints: { ...pages.constraints },
    },
  ],
  checkIn: {
    ...READ_MORE_PROFILE.checkIn,
    explanation:
      'The habit is completed only when the user checks in. Logging minutes or reaching the target never completes it.',
  },
  streakBehavior:
    'Streaks count scheduled days with a check-in. Unscheduled days never break a streak; a missed scheduled day ends the current streak but keeps the best streak and history.',
  clarifyingQuestions: [
    { id: 'target', question: 'How many minutes a day feels doable?', options: ['10', '15', '20', '30', 'No target'] },
    { id: 'days', question: 'Which days do you want to read?', options: ['Every day', 'Weekdays', 'Weekends', 'Pick days'] },
    { id: 'reminder', question: 'Would you like a daily reminder?', options: ['Yes, pick a time', 'No reminder'] },
  ],
  notes: [
    'Pages are always optional: the field is shown but never required. It cannot be turned off.',
    'Metric labels are fixed and cannot be renamed.',
  ],
  unsupported: [
    'timer or background tracking',
    'weekly quota or reduction goals',
    'Break direction for this template',
    'automatic completion when the target is reached',
    'custom metrics, widgets, labels or summary periods',
    'logging past days (only today)',
  ],
} as const;

export function getTemplates(filter: z.infer<typeof getTemplatesInput> = {}) {
  const templates = [READ_MORE];
  return { templates: filter.templateId ? templates.filter((t) => t.id === filter.templateId) : templates };
}
