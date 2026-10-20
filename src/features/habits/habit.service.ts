/**
 * Habit use cases: validation, IDs, timestamps and persistence.
 * Screens call these through the habit store; nothing here touches React.
 */
import { randomUUID } from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';

import { type LocalDate } from '@/lib/dates';

import { CheckInDateError } from './completions';
import * as repo from './habit.repository';
import { tracksReading } from './habit-template';
import { tracksLapses } from './habit-type';
import { type Habit, type HabitCompletion, type HabitDayMetric, type HabitInput, type HabitLapse } from './habit.types';
import { validateHabitInput } from './habit.validation';
import { type ReadingEntry, isValidReadingEntry } from '@/features/reading/reading.validation';
import { canToggleCompletion } from '@/features/streaks/streak-calculator';

/** A day can be a success or a lapse, never both. */
export class DayConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DayConflictError';
  }
}

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
  await db.withTransactionAsync(async () => {
    if (await repo.hasLapse(db, habitId, localDate)) {
      throw new DayConflictError('A lapse is logged for today. Undo it first to check in.');
    }
    await repo.insertCompletion(db, completion);
  });
}

/** Logs or removes today's lapse for a Break habit. A lapse is never stored as a completion. */
export async function setLapse(
  db: SQLiteDatabase,
  habit: Habit,
  localDate: LocalDate,
  today: LocalDate,
  logged: boolean,
  now = new Date(),
): Promise<void> {
  if (!canToggleCompletion(localDate, today)) throw new CheckInDateError(localDate);
  if (!logged) {
    await repo.deleteLapse(db, habit.id, localDate);
    return;
  }
  if (!tracksLapses(habit.type)) throw new Error('Lapses can only be logged for Break habits.');
  const lapse: HabitLapse = { id: randomUUID(), habitId: habit.id, localDate, loggedAt: now.toISOString() };
  await db.withTransactionAsync(async () => {
    if (await repo.hasCompletion(db, habit.id, localDate)) {
      throw new DayConflictError('Today is already checked in. Undo it first to log a lapse.');
    }
    await repo.insertLapse(db, lapse);
  });
}

/**
 * Saves today's reading for a Read More habit, or corrects it if already saved.
 * Independent of the check-in: it never creates or removes a completion.
 */
export async function saveReading(
  db: SQLiteDatabase,
  habit: Habit,
  localDate: LocalDate,
  today: LocalDate,
  entry: ReadingEntry,
  now = new Date(),
): Promise<HabitDayMetric> {
  if (!canToggleCompletion(localDate, today)) throw new CheckInDateError(localDate);
  if (!tracksReading(habit.template)) throw new Error('Reading can only be logged for a Read More habit.');
  if (!isValidReadingEntry(entry)) throw new Error('Minutes and pages must be whole numbers, 0 or more.');

  const timestamp = now.toISOString();
  const existing = await repo.getDayMetric(db, habit.id, localDate);
  const metric: HabitDayMetric = {
    id: existing?.id ?? randomUUID(),
    habitId: habit.id,
    localDate,
    minutes: entry.minutes,
    pages: entry.pages,
    recordedAt: existing?.recordedAt ?? timestamp,
    updatedAt: timestamp,
  };
  await repo.upsertDayMetric(db, metric);
  return metric;
}

export async function loadAll(db: SQLiteDatabase) {
  const [habits, completions, lapses, dayMetrics] = await Promise.all([
    repo.listHabits(db),
    repo.listCompletions(db),
    repo.listLapses(db),
    repo.listDayMetrics(db),
  ]);
  return { habits, completions, lapses, dayMetrics };
}
