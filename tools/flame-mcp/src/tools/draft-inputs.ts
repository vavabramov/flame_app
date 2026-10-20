import { z } from 'zod';

import { READ_MORE_PROFILE } from '../catalog/index';
import { DRAFT_ID_PATTERN, MAX_DAYS_INPUT, MAX_NAME_INPUT, MAX_TOKEN_INPUT } from '../security/input-limits';

/**
 * The allowlisted Read More parameters. Types and raw sizes are checked here;
 * the blueprint validator then applies the real rules with friendly errors.
 * `.strict()` rejects any other key, so fixed parts can't be overridden.
 */
const params = {
  name: z.string().max(MAX_NAME_INPUT).optional().describe('Habit name, up to 40 characters after trimming.'),
  direction: z
    .enum(['build', 'break'])
    .optional()
    .describe('Read More supports only "build"; "break" is reported as invalid by validation.'),
  scheduleDays: z
    .array(z.number())
    .max(MAX_DAYS_INPUT)
    .optional()
    .describe('Weekdays as whole numbers 0–6, 0 = Sunday … 6 = Saturday, no duplicates.'),
  reminderTime: z.string().max(10).nullable().optional().describe('24-hour "HH:mm", or null for no reminder.'),
  dailyTargetMinutes: z
    .number()
    .nullable()
    .optional()
    .describe('Daily reading target in whole minutes (1–600), or null. Guidance only; never completes the habit.'),
  icon: z.string().max(MAX_TOKEN_INPUT).optional().describe('An icon token from get_templates, e.g. "book-open".'),
  colorToken: z.string().max(MAX_TOKEN_INPUT).optional().describe('A color token from get_templates, e.g. "ember".'),
};

export const draftId = z.string().regex(DRAFT_ID_PATTERN).describe('A draft ID returned by create_draft.');

export const createDraftInput = z
  .object({
    templateId: z.literal(READ_MORE_PROFILE.template.id),
    templateVersion: z.literal(READ_MORE_PROFILE.template.version),
    ...params,
  })
  .strict();

export const updateDraftInput = z
  .object({ draftId, patch: z.object(params).strict().describe('Only the fields to change.') })
  .strict();

export const draftIdInput = z.object({ draftId }).strict();

export const exportDraftInput = z
  .object({ draftId, format: z.literal('json').describe('Only "json" is supported.') })
  .strict();
