/**
 * App-wide habit state. Loads everything from SQLite once, keeps it in memory,
 * derives streak stats, and persists every mutation. Check-ins update the UI
 * first and then persist; a failed write is rolled back and reported.
 */
import * as Haptics from 'expo-haptics';
import { type SQLiteDatabase } from 'expo-sqlite';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { getDatabase } from '@/db/database';
import {
  type ReminderPermission,
  getReminderPermission,
  requestReminderPermission,
  syncReminders,
} from '@/features/reminders/reminder.service';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/features/settings/settings.repository';
import { type StreakSummary, summarizeStreak } from '@/features/streaks/streak-calculator';
import { type LocalDate, toLocalDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';

import { toggleCompletionDate } from './completions';
import * as service from './habit.service';
import { type Habit, type HabitInput } from './habit.types';

type CompletionIndex = Map<string, Set<LocalDate>>;

export type ReminderStatus = {
  permission: ReminderPermission;
  /** Reminders that didn't fit in iOS's 64 pending-notification limit. */
  overflow: number;
  error: string | null;
};

type HabitStore = {
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retry: () => void;
  today: LocalDate;
  habits: Habit[];
  activeHabits: Habit[];
  archivedHabits: Habit[];
  completions: CompletionIndex;
  stats: Map<string, StreakSummary>;
  settings: AppSettings;
  reminders: ReminderStatus;
  createHabit: (input: HabitInput) => Promise<Habit>;
  updateHabit: (id: string, input: HabitInput) => Promise<Habit>;
  setHabitArchived: (id: string, archived: boolean) => Promise<void>;
  toggleToday: (habitId: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  refreshReminderPermission: () => Promise<ReminderPermission>;
  requestReminders: () => Promise<ReminderPermission>;
};

const HabitStoreContext = createContext<HabitStore | null>(null);

/** The local date the habit started being tracked: the day it was created. */
export const habitStartDate = (habit: Habit): LocalDate => toLocalDate(new Date(habit.createdAt));

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function indexCompletions(rows: { habitId: string; localDate: LocalDate }[]): CompletionIndex {
  const index: CompletionIndex = new Map();
  for (const row of rows) {
    const dates = index.get(row.habitId) ?? new Set<LocalDate>();
    dates.add(row.localDate);
    index.set(row.habitId, dates);
  }
  return index;
}

export function HabitStoreProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const [status, setStatus] = useState<HabitStore['status']>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<CompletionIndex>(new Map());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [reminders, setReminders] = useState<ReminderStatus>({
    permission: 'undetermined',
    overflow: 0,
    error: null,
  });

  const dbRef = useRef<SQLiteDatabase | null>(null);
  const habitsRef = useRef(habits);
  const completionsRef = useRef(completions);
  const settingsRef = useRef(settings);
  // Writes run one after another so rapid taps persist in the order they happened.
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());

  const commitHabits = useCallback((next: Habit[]) => {
    habitsRef.current = next;
    setHabits(next);
  }, []);
  const commitCompletions = useCallback((next: CompletionIndex) => {
    completionsRef.current = next;
    setCompletions(next);
  }, []);

  const enqueue = useCallback(<T,>(task: (db: SQLiteDatabase) => Promise<T>): Promise<T> => {
    const run = writeQueue.current.then(() => {
      const db = dbRef.current;
      if (!db) throw new Error('The database is not ready yet.');
      return task(db);
    });
    writeQueue.current = run.catch(() => undefined);
    return run;
  }, []);

  const resyncReminders = useCallback(async () => {
    try {
      const result = await syncReminders(habitsRef.current, settingsRef.current.remindersEnabled);
      setReminders({ permission: result.permission, overflow: result.overflow, error: null });
    } catch (error) {
      setReminders((prev) => ({ ...prev, error: `Reminders couldn't be updated: ${errorMessage(error)}` }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDatabase();
        const [{ habits: loadedHabits, completions: rows }, loadedSettings] = await Promise.all([
          service.loadAll(db),
          loadSettings(db),
        ]);
        if (cancelled) return;
        dbRef.current = db;
        commitHabits(loadedHabits);
        commitCompletions(indexCompletions(rows));
        settingsRef.current = loadedSettings;
        setSettings(loadedSettings);
        setStatus('ready');
        // Reconcile scheduled notifications with stored habits after every launch.
        resyncReminders();
      } catch (error) {
        if (cancelled) return;
        setLoadError(errorMessage(error));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, commitHabits, commitCompletions, resyncReminders]);

  // Permission may have changed in iOS Settings while the app was in the background.
  useEffect(() => {
    if (status !== 'ready') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resyncReminders();
    });
    return () => subscription.remove();
  }, [status, resyncReminders]);

  const retry = useCallback(() => {
    setStatus('loading');
    setLoadError(null);
    setAttempt((n) => n + 1);
  }, []);

  const createHabit = useCallback(
    async (input: HabitInput) => {
      const habit = await enqueue((db) => service.createHabit(db, input));
      commitHabits([...habitsRef.current, habit]);
      resyncReminders();
      return habit;
    },
    [enqueue, commitHabits, resyncReminders],
  );

  const updateHabit = useCallback(
    async (id: string, input: HabitInput) => {
      const existing = habitsRef.current.find((h) => h.id === id);
      if (!existing) throw new Error('This habit no longer exists.');
      const habit = await enqueue((db) => service.editHabit(db, existing, input));
      commitHabits(habitsRef.current.map((h) => (h.id === id ? habit : h)));
      resyncReminders();
      return habit;
    },
    [enqueue, commitHabits, resyncReminders],
  );

  const setHabitArchived = useCallback(
    async (id: string, archived: boolean) => {
      const existing = habitsRef.current.find((h) => h.id === id);
      if (!existing) throw new Error('This habit no longer exists.');
      const habit = await enqueue((db) => service.setArchived(db, existing, archived));
      commitHabits(habitsRef.current.map((h) => (h.id === id ? habit : h)));
      resyncReminders();
    },
    [enqueue, commitHabits, resyncReminders],
  );

  const toggleToday = useCallback(
    (habitId: string) => {
      const previous = completionsRef.current.get(habitId) ?? new Set<LocalDate>();
      const { dates, completed } = toggleCompletionDate(previous, today, today);

      const next = new Map(completionsRef.current);
      next.set(habitId, dates);
      commitCompletions(next);

      if (settingsRef.current.hapticsEnabled && Platform.OS !== 'web') {
        const feedback = completed
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        feedback.catch(() => undefined);
      }

      enqueue((db) => service.setCompletion(db, habitId, today, today, completed)).catch((error) => {
        const rollback = new Map(completionsRef.current);
        const current = new Set(rollback.get(habitId) ?? []);
        if (completed) current.delete(today);
        else current.add(today);
        rollback.set(habitId, current);
        commitCompletions(rollback);
        Alert.alert("Couldn't save your check-in", errorMessage(error));
      });
    },
    [today, enqueue, commitCompletions],
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      await enqueue((db) => saveSettings(db, patch));
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      if ('remindersEnabled' in patch) resyncReminders();
    },
    [enqueue, resyncReminders],
  );

  const refreshReminderPermission = useCallback(async () => {
    const permission = await getReminderPermission();
    setReminders((prev) => ({ ...prev, permission }));
    return permission;
  }, []);

  const requestReminders = useCallback(async () => {
    const permission = await requestReminderPermission();
    setReminders((prev) => ({ ...prev, permission }));
    if (permission === 'granted') await resyncReminders();
    return permission;
  }, [resyncReminders]);

  const value = useMemo<HabitStore>(() => {
    const activeHabits = habits.filter((h) => h.archivedAt === null);
    const archivedHabits = habits.filter((h) => h.archivedAt !== null);
    const stats = new Map<string, StreakSummary>();
    for (const habit of habits) {
      stats.set(
        habit.id,
        summarizeStreak(
          {
            scheduleDays: habit.scheduleDays,
            startDate: habitStartDate(habit),
            completedDates: completions.get(habit.id) ?? [],
          },
          today,
        ),
      );
    }
    return {
      status,
      loadError,
      retry,
      today,
      habits,
      activeHabits,
      archivedHabits,
      completions,
      stats,
      settings,
      reminders,
      createHabit,
      updateHabit,
      setHabitArchived,
      toggleToday,
      updateSettings,
      refreshReminderPermission,
      requestReminders,
    };
  }, [
    status,
    loadError,
    retry,
    today,
    habits,
    completions,
    settings,
    reminders,
    createHabit,
    updateHabit,
    setHabitArchived,
    toggleToday,
    updateSettings,
    refreshReminderPermission,
    requestReminders,
  ]);

  return <HabitStoreContext.Provider value={value}>{children}</HabitStoreContext.Provider>;
}

export function useHabitStore(): HabitStore {
  const store = useContext(HabitStoreContext);
  if (!store) throw new Error('useHabitStore must be used inside HabitStoreProvider');
  return store;
}
