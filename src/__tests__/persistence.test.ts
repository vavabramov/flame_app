/**
 * @jest-environment node
 *
 * Runs the real migrations, repository and service SQL against SQLite
 * (Node's built-in `node:sqlite`) through a small adapter that implements the
 * subset of expo-sqlite's async API the app uses.
 */
/// <reference types="node" />
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { type SQLiteDatabase } from 'expo-sqlite';

import { LATEST_SCHEMA_VERSION, MIGRATIONS, migrateDatabase } from '@/db/migrations';
import * as repo from '@/features/habits/habit.repository';
import * as service from '@/features/habits/habit.service';
import { loadSettings, saveSettings } from '@/features/settings/settings.repository';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

type Params = unknown[];
const flatten = (params: Params) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);

function adapt(raw: DatabaseSync): SQLiteDatabase {
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: Params) => {
      const result = raw.prepare(sql).run(...(flatten(params) as never[]));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async (sql: string, ...params: Params) => raw.prepare(sql).all(...(flatten(params) as never[])),
    getFirstAsync: async (sql: string, ...params: Params) =>
      raw.prepare(sql).get(...(flatten(params) as never[])) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) =>
      db.withTransactionAsync(() => task(db)),
  };
  return db as unknown as SQLiteDatabase;
}

let dir: string;
let path: string;
let raw: DatabaseSync;
let db: SQLiteDatabase;

const open = async () => {
  raw = new DatabaseSync(path);
  db = adapt(raw);
  await migrateDatabase(db);
};
const reopen = async () => {
  raw.close();
  await open();
};

const input = { type: 'build' as const, template: null, targetMinutes: null, name: 'Read', icon: '📚', color: '#FF8737', scheduleDays: [1, 3, 5], reminderTime: '08:00' };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'flame-db-'));
  path = join(dir, `${randomUUID()}.db`);
  await open();
});

afterEach(() => {
  raw.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('migrations', () => {
  it('migrates a v1 database to the current schema, keeping data and defaulting habits to build', async () => {
    raw.close();
    rmSync(path, { force: true });
    raw = new DatabaseSync(path);
    db = adapt(raw);
    // Recreate the original v1 schema with one habit and one completion.
    await db.execAsync(MIGRATIONS[0].sql);
    await db.execAsync('PRAGMA user_version = 1');
    await db.runAsync(
      `INSERT INTO habits (id, name, icon, color, schedule_days, reminder_time, created_at, updated_at, archived_at)
       VALUES ('old', 'Read', '📚', '#FF8737', '[1,3,5]', '08:00', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', NULL)`,
    );
    await db.runAsync(
      "INSERT INTO habit_completions (id, habit_id, local_date, completed_at) VALUES ('c', 'old', '2024-01-03', 'x')",
    );

    await migrateDatabase(db);

    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: LATEST_SCHEMA_VERSION });
    const [habit] = await repo.listHabits(db);
    expect(habit).toMatchObject({ id: 'old', type: 'build', name: 'Read', scheduleDays: [1, 3, 5], reminderTime: '08:00' });
    expect(await repo.listCompletions(db)).toHaveLength(1);
    expect(await repo.listLapses(db)).toHaveLength(0);
  });


  it('creates the schema, records its version and is safe to re-run', async () => {
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: LATEST_SCHEMA_VERSION });
    await migrateDatabase(db);
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    expect(tables.map((t) => t.name).sort()).toEqual(['habit_completions', 'habit_day_metrics', 'habit_lapses', 'habits', 'settings']);
  });

  it('enforces foreign keys', async () => {
    await expect(
      repo.insertCompletion(db, { id: 'c1', habitId: 'missing', localDate: '2024-01-01', completedAt: 'x' }),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuses to open a database from a newer app version', async () => {
    await db.execAsync(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(migrateDatabase(db)).rejects.toThrow(/newer than this app/);
  });
});

describe('habits and completions', () => {
  it('persists a habit across a restart', async () => {
    const created = await service.createHabit(db, { ...input, name: '  Read  ' });
    await reopen();
    const [loaded] = await repo.listHabits(db);
    expect(loaded).toEqual(created);
    expect(loaded.name).toBe('Read');
    expect(loaded.scheduleDays).toEqual([1, 3, 5]);
  });

  it('rejects invalid input without writing', async () => {
    await expect(service.createHabit(db, { ...input, name: ' ' })).rejects.toThrow(service.HabitValidationError);
    expect(await repo.listHabits(db)).toHaveLength(0);
  });

  it('stores one completion per habit per day, and undo removes it', async () => {
    const habit = await service.createHabit(db, input);
    const today = '2024-01-10';
    await service.setCompletion(db, habit.id, today, today, true);
    await service.setCompletion(db, habit.id, today, today, true);
    await reopen();
    expect(await repo.listCompletions(db)).toHaveLength(1);

    // The UNIQUE constraint also holds for direct inserts.
    await repo.insertCompletion(db, { id: 'dupe', habitId: habit.id, localDate: today, completedAt: 'x' });
    expect(await repo.listCompletions(db)).toHaveLength(1);

    await service.setCompletion(db, habit.id, today, today, false);
    expect(await repo.listCompletions(db)).toHaveLength(0);
  });

  it('refuses check-ins for other days', async () => {
    const habit = await service.createHabit(db, input);
    await expect(service.setCompletion(db, habit.id, '2024-01-11', '2024-01-10', true)).rejects.toThrow(
      /only allowed for today/,
    );
    expect(await repo.listCompletions(db)).toHaveLength(0);
  });

  it('archiving keeps the habit and its history, and restoring brings it back', async () => {
    const habit = await service.createHabit(db, input);
    await service.setCompletion(db, habit.id, '2024-01-10', '2024-01-10', true);
    const archived = await service.setArchived(db, habit, true);
    await reopen();

    const [stored] = await repo.listHabits(db);
    expect(stored.archivedAt).toBe(archived.archivedAt);
    expect(await repo.listCompletions(db)).toHaveLength(1);

    await service.setArchived(db, stored, false);
    expect((await repo.listHabits(db))[0].archivedAt).toBeNull();
  });

  it('editing updates fields but keeps creation date and history', async () => {
    const habit = await service.createHabit(db, input);
    await service.setCompletion(db, habit.id, '2024-01-10', '2024-01-10', true);
    await service.editHabit(db, habit, { ...input, name: 'Read more', scheduleDays: [0, 6], reminderTime: null });
    await reopen();
    const [stored] = await repo.listHabits(db);
    expect(stored).toMatchObject({ name: 'Read more', scheduleDays: [0, 6], reminderTime: null, createdAt: habit.createdAt });
    expect(await repo.listCompletions(db)).toHaveLength(1);
  });

  it('stores user text safely through parameters', async () => {
    await service.createHabit(db, { ...input, name: "Robert'); DROP TABLE habits;--" });
    const [stored] = await repo.listHabits(db);
    expect(stored.name).toBe("Robert'); DROP TABLE habits;--");
  });
});

describe('habit types and lapses', () => {
  const today = '2024-01-10';

  it('persists the selected type, including after an edit', async () => {
    const habit = await service.createHabit(db, { ...input, type: 'break', name: 'No doomscrolling' });
    await reopen();
    expect((await repo.listHabits(db))[0].type).toBe('break');
    await service.editHabit(db, habit, { ...input, type: 'build' });
    await reopen();
    expect((await repo.listHabits(db))[0].type).toBe('build');
  });

  it('reads an unknown stored type as build', async () => {
    await service.createHabit(db, input);
    await db.runAsync("UPDATE habits SET type = 'something-else'");
    expect((await repo.listHabits(db))[0].type).toBe('build');
  });

  it('stores a lapse apart from completions, one per day, and undo removes it', async () => {
    const habit = await service.createHabit(db, { ...input, type: 'break' });
    await service.setLapse(db, habit, today, today, true);
    await service.setLapse(db, habit, today, today, true);
    await reopen();
    expect(await repo.listLapses(db)).toHaveLength(1);
    expect(await repo.listCompletions(db)).toHaveLength(0);
    await service.setLapse(db, habit, today, today, false);
    expect(await repo.listLapses(db)).toHaveLength(0);
  });

  it('never stores a success and a lapse for the same day', async () => {
    const habit = await service.createHabit(db, { ...input, type: 'break' });
    await service.setLapse(db, habit, today, today, true);
    await expect(service.setCompletion(db, habit.id, today, today, true)).rejects.toThrow(service.DayConflictError);
    await service.setLapse(db, habit, today, today, false);
    await service.setCompletion(db, habit.id, today, today, true);
    await expect(service.setLapse(db, habit, today, today, true)).rejects.toThrow(service.DayConflictError);
    expect(await repo.listCompletions(db)).toHaveLength(1);
    expect(await repo.listLapses(db)).toHaveLength(0);
  });

  it('only Break habits can log lapses, and only for today', async () => {
    const build = await service.createHabit(db, input);
    await expect(service.setLapse(db, build, today, today, true)).rejects.toThrow(/Break habits/);
    const brk = await service.createHabit(db, { ...input, type: 'break' });
    await expect(service.setLapse(db, brk, '2024-01-11', today, true)).rejects.toThrow(/only allowed for today/);
  });

  it('archiving a Break habit keeps its successes and lapses', async () => {
    const habit = await service.createHabit(db, { ...input, type: 'break' });
    await service.setLapse(db, habit, today, today, true);
    await service.setCompletion(db, habit.id, '2024-01-11', '2024-01-11', true);
    await service.setArchived(db, habit, true);
    await reopen();
    expect(await repo.listLapses(db)).toHaveLength(1);
    expect(await repo.listCompletions(db)).toHaveLength(1);
  });
});

describe('Read More reading records', () => {
  const today = '2024-01-10';
  const readMore = { ...input, template: 'read_more' as const, targetMinutes: 15 };

  it('migrates a v2 database to v3, keeping habits, check-ins and lapses', async () => {
    raw.close();
    rmSync(path, { force: true });
    raw = new DatabaseSync(path);
    db = adapt(raw);
    await db.execAsync(MIGRATIONS[0].sql);
    await db.execAsync(MIGRATIONS[1].sql);
    await db.execAsync('PRAGMA user_version = 2');
    await db.runAsync(
      `INSERT INTO habits (id, type, name, icon, color, schedule_days, reminder_time, created_at, updated_at, archived_at)
       VALUES ('b', 'break', 'No scrolling', '📵', '#FF8737', '[0,1,2,3,4,5,6]', NULL, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', NULL)`,
    );
    await db.runAsync("INSERT INTO habit_completions (id, habit_id, local_date, completed_at) VALUES ('c', 'b', '2024-01-02', 'x')");
    await db.runAsync("INSERT INTO habit_lapses (id, habit_id, local_date, logged_at) VALUES ('l', 'b', '2024-01-03', 'x')");

    await migrateDatabase(db);

    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 });
    const [habit] = await repo.listHabits(db);
    expect(habit).toMatchObject({ id: 'b', type: 'break', name: 'No scrolling', template: null, targetMinutes: null });
    expect(await repo.listCompletions(db)).toHaveLength(1);
    expect(await repo.listLapses(db)).toHaveLength(1);
    expect(await repo.listDayMetrics(db)).toHaveLength(0);
  });

  it('persists the template and target', async () => {
    await service.createHabit(db, readMore);
    await reopen();
    expect((await repo.listHabits(db))[0]).toMatchObject({ template: 'read_more', targetMinutes: 15 });
  });

  it('creates, reads and corrects one record per day, across restarts', async () => {
    const habit = await service.createHabit(db, readMore);
    const first = await service.saveReading(db, habit, today, today, { minutes: 12, pages: null }, new Date('2024-01-10T08:00:00Z'));
    await reopen();
    expect(await repo.getDayMetric(db, habit.id, today)).toMatchObject({ minutes: 12, pages: null });

    const corrected = await service.saveReading(db, habit, today, today, { minutes: 25, pages: 18 }, new Date('2024-01-10T21:00:00Z'));
    await reopen();
    const rows = await repo.listDayMetrics(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.id, minutes: 25, pages: 18, recordedAt: first.recordedAt, updatedAt: corrected.updatedAt });
  });

  it('never duplicates, even when two saves race for the same day', async () => {
    const habit = await service.createHabit(db, readMore);
    await Promise.all([
      service.saveReading(db, habit, today, today, { minutes: 10, pages: null }),
      service.saveReading(db, habit, today, today, { minutes: 10, pages: null }),
    ]);
    expect(await repo.listDayMetrics(db)).toHaveLength(1);
    // The UNIQUE constraint also holds for direct upserts with a new id.
    await repo.upsertDayMetric(db, {
      id: 'other', habitId: habit.id, localDate: today, minutes: 30, pages: 2, recordedAt: 'x', updatedAt: 'y',
    });
    const rows = await repo.listDayMetrics(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].minutes).toBe(30);
  });

  it('keeps separate records per local date', async () => {
    const habit = await service.createHabit(db, readMore);
    await service.saveReading(db, habit, '2023-12-31', '2023-12-31', { minutes: 5, pages: null });
    await service.saveReading(db, habit, '2024-01-01', '2024-01-01', { minutes: 6, pages: null });
    expect((await repo.listDayMetrics(db)).map((r) => r.localDate)).toEqual(['2023-12-31', '2024-01-01']);
  });

  it('is independent of the check-in', async () => {
    const habit = await service.createHabit(db, readMore);
    await service.saveReading(db, habit, today, today, { minutes: 30, pages: null });
    expect(await repo.listCompletions(db)).toHaveLength(0);
    await service.setCompletion(db, habit.id, today, today, true);
    await service.setCompletion(db, habit.id, today, today, false);
    expect(await repo.getDayMetric(db, habit.id, today)).toMatchObject({ minutes: 30 });
  });

  it('only allows today, only Read More habits, and only valid numbers', async () => {
    const habit = await service.createHabit(db, readMore);
    await expect(service.saveReading(db, habit, '2024-01-11', today, { minutes: 5, pages: null })).rejects.toThrow(/only allowed for today/);
    await expect(service.saveReading(db, habit, '2024-01-09', today, { minutes: 5, pages: null })).rejects.toThrow(/only allowed for today/);
    await expect(service.saveReading(db, habit, today, today, { minutes: -1, pages: null })).rejects.toThrow(/whole numbers/);
    const plain = await service.createHabit(db, input);
    await expect(service.saveReading(db, plain, today, today, { minutes: 5, pages: null })).rejects.toThrow(/Read More/);
    expect(await repo.listDayMetrics(db)).toHaveLength(0);
  });

  it('rejects negative values at the database level too', async () => {
    const habit = await service.createHabit(db, readMore);
    await expect(
      repo.upsertDayMetric(db, { id: 'n', habitId: habit.id, localDate: today, minutes: -5, pages: null, recordedAt: 'x', updatedAt: 'x' }),
    ).rejects.toThrow(/CHECK/);
  });

  it('archiving keeps reading history', async () => {
    const habit = await service.createHabit(db, readMore);
    await service.saveReading(db, habit, today, today, { minutes: 20, pages: 4 });
    await service.setArchived(db, habit, true);
    await reopen();
    expect(await repo.listDayMetrics(db)).toHaveLength(1);
  });
});

describe('settings', () => {
  it('defaults, saves and survives a restart', async () => {
    expect((await loadSettings(db)).onboardingCompleted).toBe(false);
    await saveSettings(db, { onboardingCompleted: true, hapticsEnabled: false });
    await reopen();
    expect(await loadSettings(db)).toEqual({
      onboardingCompleted: true,
      hapticsEnabled: false,
      flameAnimation: true,
      remindersEnabled: true,
    });
  });
});
