import { type SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';

import { migrateDatabase } from './migrations';

export const DATABASE_NAME = 'flame.db';

let opening: Promise<SQLiteDatabase> | null = null;

/** Opens the app database once and runs pending migrations. Safe to call repeatedly. */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await openDatabaseAsync(DATABASE_NAME);
      await migrateDatabase(db);
      return db;
    })();
    // Let a later retry try again from scratch.
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}
