import { type SQLiteDatabase } from 'expo-sqlite';

export type AppSettings = {
  onboardingCompleted: boolean;
  hapticsEnabled: boolean;
  /** Master switch for all habit reminders. Per-habit times are kept when off. */
  remindersEnabled: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingCompleted: false,
  hapticsEnabled: true,
  remindersEnabled: true,
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

export async function loadSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if ((KEYS as string[]).includes(key)) settings[key as keyof AppSettings] = value === 'true';
  }
  return settings;
}

export async function saveSettings(db: SQLiteDatabase, patch: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(patch).filter(([key]) => (KEYS as string[]).includes(key));
  if (entries.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        String(Boolean(value)),
      );
    }
  });
}
