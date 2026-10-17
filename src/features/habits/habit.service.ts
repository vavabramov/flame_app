/**
 * Habit use cases: validation, IDs, timestamps and persistence.
 * Screens call these through the habit store; nothing here touches React.
 */
import { randomUUID } from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';

import { type LocalDate } from '@/lib/dates';

import { CheckInDateError } from './completions';
import * as repo from './habit.repository';
import { type Habit, type HabitCompletion, type HabitInput } from './habit.types';
import { validateHabitInput } from './habit.validation';
import { canToggleCompletion } from '@/features/streaks/streak-calculator';

export class HabitValidationError extends Error {
  constructor(readonly errors: ReturnType<typeof validateHabitInput>['errors']) {
    super(Object.values(errors).join(' '));
    this.name = 'HabitValidationError';
  }
}

function validOrThrow(input: HabitInput): HabitInput {
  const { value, errors } = validateHabitInput(input);
  if (!value) throw new HabitValidationError(errors);
  return value;
}

export async function createHabit(db: SQLiteDatabase, input: HabitInput, now = new Date()): Promise<Habit> {
  const value = validOrThrow(input);
  const timestamp = now.toISOString();
  const habit: Habit = {
    id: randomUUID(),
    ...value,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
  await repo.insertHabit(db, habit);
  return habit;
}

export async function editHabit(
  db: SQLiteDatabase,
  existing: Habit,
  input: HabitInput,
  now = new Date(),
): Promise<Habit> {
  const value = validOrThrow(input);
  const habit: Habit = { ...existing, ...value, updatedAt: now.toISOString() };
  await repo.updateHabit(db, habit);
  return habit;
}

/** Archiving hides the habit but keeps it and every completion. */
export async function setArchived(
  db: SQLiteDatabase,
  existing: Habit,
  archived: boolean,
  now = new Date(),
): Promise<Habit> {
  const timestamp = now.toISOString();
  const habit: Habit = { ...existing, archivedAt: archived ? timestamp : null, updatedAt: timestamp };
  await repo.updateHabit(db, habit);
  return habit;
}

export async function setCompletion(
  db: SQLiteDatabase,
  habitId: string,
  localDate: LocalDate,
  today: LocalDate,
  completed: boolean,
  now = new Date(),
): Promise<void> {
  if (!canToggleCompletion(localDate, today)) throw new CheckInDateError(localDate);
  if (!completed) {
    await repo.deleteCompletion(db, habitId, localDate);
    return;
  }
  const completion: HabitCompletion = {
    id: randomUUID(),
    habitId,
    localDate,
    completedAt: now.toISOString(),
  };
  await repo.insertCompletion(db, completion);
}

export async function loadAll(db: SQLiteDatabase) {
  const [habits, completions] = await Promise.all([repo.listHabits(db), repo.listCompletions(db)]);
  return { habits, completions };
}
