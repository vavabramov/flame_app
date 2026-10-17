/**
 * SQLite access for habits and completions. All statements are parameterized.
 * Callers pass plain typed objects; rows never leave this module.
 */
import { type SQLiteDatabase } from 'expo-sqlite';

import { type LocalDate } from '@/lib/dates';

import { type Habit, type HabitCompletion } from './habit.types';
import { ALL_DAYS, normalizeScheduleDays } from './habit.validation';

type HabitRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  schedule_days: string;
  reminder_time: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CompletionRow = {
  id: string;
  habit_id: string;
  local_date: string;
  completed_at: string;
};

/** Stored as a JSON array. Unreadable values fall back to every day rather than crashing. */
export function parseScheduleDays(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    const days = Array.isArray(parsed) ? normalizeScheduleDays(parsed) : [];
    return days.length > 0 ? days : [...ALL_DAYS];
  } catch {
    return [...ALL_DAYS];
  }
}

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    scheduleDays: parseScheduleDays(row.schedule_days),
    reminderTime: row.reminder_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function toCompletion(row: CompletionRow): HabitCompletion {
  return {
    id: row.id,
    habitId: row.habit_id,
    localDate: row.local_date,
    completedAt: row.completed_at,
  };
}

/** All habits, archived included, oldest first (a stable, predictable order). */
export async function listHabits(db: SQLiteDatabase): Promise<Habit[]> {
  const rows = await db.getAllAsync<HabitRow>('SELECT * FROM habits ORDER BY created_at ASC, id ASC');
  return rows.map(toHabit);
}

export async function insertHabit(db: SQLiteDatabase, habit: Habit): Promise<void> {
  await db.runAsync(
    `INSERT INTO habits (id, name, icon, color, schedule_days, reminder_time, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    habit.id,
    habit.name,
    habit.icon,
    habit.color,
    JSON.stringify(habit.scheduleDays),
    habit.reminderTime,
    habit.createdAt,
    habit.updatedAt,
    habit.archivedAt,
  );
}

export async function updateHabit(db: SQLiteDatabase, habit: Habit): Promise<void> {
  await db.runAsync(
    `UPDATE habits
     SET name = ?, icon = ?, color = ?, schedule_days = ?, reminder_time = ?, updated_at = ?, archived_at = ?
     WHERE id = ?`,
    habit.name,
    habit.icon,
    habit.color,
    JSON.stringify(habit.scheduleDays),
    habit.reminderTime,
    habit.updatedAt,
    habit.archivedAt,
    habit.id,
  );
}

export async function listCompletions(db: SQLiteDatabase): Promise<HabitCompletion[]> {
  const rows = await db.getAllAsync<CompletionRow>(
    'SELECT * FROM habit_completions ORDER BY local_date ASC',
  );
  return rows.map(toCompletion);
}

/** Idempotent: the UNIQUE (habit_id, local_date) constraint ignores a second insert. */
export async function insertCompletion(db: SQLiteDatabase, completion: HabitCompletion): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO habit_completions (id, habit_id, local_date, completed_at)
     VALUES (?, ?, ?, ?)`,
    completion.id,
    completion.habitId,
    completion.localDate,
    completion.completedAt,
  );
}

export async function deleteCompletion(db: SQLiteDatabase, habitId: string, localDate: LocalDate): Promise<void> {
  await db.runAsync('DELETE FROM habit_completions WHERE habit_id = ? AND local_date = ?', habitId, localDate);
}
