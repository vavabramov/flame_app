import { type SQLiteDatabase } from 'expo-sqlite';

/**
 * Ordered schema migrations. The applied version is stored in `PRAGMA user_version`.
 * Never edit a shipped migration: append a new one so existing data is kept.
 */
export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        schedule_days TEXT NOT NULL,
        reminder_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS habit_completions (
        id TEXT PRIMARY KEY NOT NULL,
        habit_id TEXT NOT NULL REFERENCES habits(id),
        local_date TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        UNIQUE (habit_id, local_date)
      );

      CREATE INDEX IF NOT EXISTS idx_completions_habit_date
        ON habit_completions(habit_id, local_date);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  // Connection-level settings; foreign_keys can't be changed inside a transaction.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${currentVersion} is newer than this app (v${LATEST_SCHEMA_VERSION}). Update the app.`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      // Integer from our own constant list, not user input.
      await txn.execAsync(`PRAGMA user_version = ${Number(migration.version)}`);
    });
  }
}
