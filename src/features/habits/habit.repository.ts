/**
 * SQLite access for habits and completions. All statements are parameterized.
 * Callers pass plain typed objects; rows never leave this module.
 */
import { type SQLiteDatabase } from 'expo-sqlite';

import { type LocalDate } from '@/lib/dates';

import { parseHabitTemplate } from './habit-template';
import { parseHabitType } from './habit-type';
import { type Habit, type HabitCompletion, type HabitDayMetric, type HabitLapse } from './habit.types';
import { ALL_DAYS, normalizeScheduleDays } from './habit.validation';

type HabitRow = {
  id: string;
  type: string;
  template: string | null;
  target_minutes: number | null;
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

type DayMetricRow = {
  id: string;
  habit_id: string;
  local_date: string;
  minutes: number;
  pages: number | null;
  recorded_at: string;
  updated_at: string;
};

type LapseRow = {
  id: string;
  habit_id: string;
  local_date: string;
  logged_at: string;
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
    type: parseHabitType(row.type),
    template: parseHabitTemplate(row.template),
    targetMinutes: row.target_minutes,
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
    `INSERT INTO habits (id, type, template, target_minutes, name, icon, color, schedule_days, reminder_time,
                         created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    habit.id,
    habit.type,
    habit.template,
    habit.targetMinutes,
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
     SET type = ?, template = ?, target_minutes = ?, name = ?, icon = ?, color = ?, schedule_days = ?,
         reminder_time = ?, updated_at = ?, archived_at = ?
     WHERE id = ?`,
    habit.type,
    habit.template,
    habit.targetMinutes,
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

export async function hasCompletion(db: SQLiteDatabase, habitId: string, localDate: LocalDate): Promise<boolean> {
  const row = await db.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM habit_completions WHERE habit_id = ? AND local_date = ?',
    habitId,
    localDate,
  );
  return row !== null;
}

export async function listLapses(db: SQLiteDatabase): Promise<HabitLapse[]> {
  const rows = await db.getAllAsync<LapseRow>('SELECT * FROM habit_lapses ORDER BY local_date ASC');
  return rows.map((row) => ({
    id: row.id,
    habitId: row.habit_id,
    localDate: row.local_date,
    loggedAt: row.logged_at,
  }));
}

export async function hasLapse(db: SQLiteDatabase, habitId: string, localDate: LocalDate): Promise<boolean> {
  const row = await db.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM habit_lapses WHERE habit_id = ? AND local_date = ?',
    habitId,
    localDate,
  );
  return row !== null;
}

/** Idempotent: one lapse per habit per local date. */
export async function insertLapse(db: SQLiteDatabase, lapse: HabitLapse): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO habit_lapses (id, habit_id, local_date, logged_at)
     VALUES (?, ?, ?, ?)`,
    lapse.id,
    lapse.habitId,
    lapse.localDate,
    lapse.loggedAt,
  );
}

export async function deleteLapse(db: SQLiteDatabase, habitId: string, localDate: LocalDate): Promise<void> {
  await db.runAsync('DELETE FROM habit_lapses WHERE habit_id = ? AND local_date = ?', habitId, localDate);
}

function toDayMetric(row: DayMetricRow): HabitDayMetric {
  return {
    id: row.id,
    habitId: row.habit_id,
    localDate: row.local_date,
    minutes: row.minutes,
    pages: row.pages,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
  };
}

export async function listDayMetrics(db: SQLiteDatabase): Promise<HabitDayMetric[]> {
  const rows = await db.getAllAsync<DayMetricRow>('SELECT * FROM habit_day_metrics ORDER BY local_date ASC');
  return rows.map(toDayMetric);
}

export async function getDayMetric(
  db: SQLiteDatabase,
  habitId: string,
  localDate: LocalDate,
): Promise<HabitDayMetric | null> {
  const row = await db.getFirstAsync<DayMetricRow>(
    'SELECT * FROM habit_day_metrics WHERE habit_id = ? AND local_date = ?',
    habitId,
    localDate,
  );
  return row ? toDayMetric(row) : null;
}

/**
 * Inserts the day's record, or updates it in place if one exists for this
 * habit and date (UNIQUE (habit_id, local_date)). Never creates a duplicate.
 * The original id and recorded_at are kept on update.
 */
export async function upsertDayMetric(db: SQLiteDatabase, metric: HabitDayMetric): Promise<void> {
  await db.runAsync(
    `INSERT INTO habit_day_metrics (id, habit_id, local_date, minutes, pages, recorded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (habit_id, local_date) DO UPDATE SET
       minutes = excluded.minutes,
       pages = excluded.pages,
       updated_at = excluded.updated_at`,
    metric.id,
    metric.habitId,
    metric.localDate,
    metric.minutes,
    metric.pages,
    metric.recordedAt,
    metric.updatedAt,
  );
}
