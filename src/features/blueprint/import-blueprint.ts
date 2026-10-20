/**
 * App-side import of an untrusted blueprint: size limit, JSON parse, strict
 * blueprint validation, mapping, then the app's own habit validation as a second
 * guard. Pure: nothing touches the database until the user confirms.
 */
import { type HabitInput } from '@/features/habits/habit.types';
import { validateHabitInput } from '@/features/habits/habit.validation';

import { blueprintToHabitInput } from './blueprint-to-habit-input';
import { type BlueprintIssue, type BlueprintWarning, type HabitBlueprintV1 } from './blueprint.types';
import { parseBlueprintJson } from './validate-blueprint';

export type ImportPreparation =
  | { ok: true; blueprint: HabitBlueprintV1; input: HabitInput; warnings: BlueprintWarning[] }
  | { ok: false; errors: BlueprintIssue[] };

export function prepareImport(text: string): ImportPreparation {
  if (text.trim() === '') {
    return { ok: false, errors: [{ code: 'invalid_json', path: '', message: 'Paste the exported JSON first.' }] };
  }
  const result = parseBlueprintJson(text);
  if (!result.valid) return { ok: false, errors: result.errors };

  const input = blueprintToHabitInput(result.value);
  const check = validateHabitInput(input);
  if (!check.value) {
    return {
      ok: false,
      errors: [{ code: 'unsupported_value', path: '', message: 'This blueprint doesn’t fit this version of FLAME.' }],
    };
  }
  return { ok: true, blueprint: result.value, input: check.value, warnings: result.warnings };
}
