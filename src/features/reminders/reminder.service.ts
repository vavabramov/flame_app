/**
 * Local reminders via expo-notifications. Every function here is best-effort:
 * failures are reported to the caller but never block habits or check-ins.
 */
import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { type Habit } from '@/features/habits/habit.types';

import { REMINDER_ID_PREFIX, planReminders } from './reminder.plan';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export function configureNotificationHandler(): void {
  if (!remindersSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function toPermission(status: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (Platform.OS === 'ios' && status.ios) {
    const s = status.ios.status;
    if (
      s === IosAuthorizationStatus.AUTHORIZED ||
      s === IosAuthorizationStatus.PROVISIONAL ||
      s === IosAuthorizationStatus.EPHEMERAL
    ) {
      return 'granted';
    }
    return s === IosAuthorizationStatus.NOT_DETERMINED ? 'undetermined' : 'denied';
  }
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported) return 'unavailable';
  try {
    return toPermission(await Notifications.getPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/** Asks only when the user hasn't decided yet. Call this from a reminder-related action. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  const current = await getReminderPermission();
  if (current !== 'undetermined') return current;
  try {
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return toPermission(result);
  } catch {
    return 'unavailable';
  }
}

export function openSystemSettings(): Promise<void> {
  return Linking.openSettings();
}

export type ReminderSyncResult = { scheduled: number; overflow: number; permission: ReminderPermission };

/**
 * Makes the scheduled notifications exactly match the habits: cancels any FLAME
 * reminder that shouldn't exist, then (re)schedules the planned ones with stable
 * identifiers. Running it repeatedly, or after a restart, never duplicates.
 */
export async function syncReminders(
  habits: readonly Habit[],
  remindersEnabled: boolean,
): Promise<ReminderSyncResult> {
  const permission = await getReminderPermission();
  if (!remindersSupported) return { scheduled: 0, overflow: 0, permission };

  const { planned, overflow } =
    permission === 'granted' ? planReminders(habits, remindersEnabled) : { planned: [], overflow: 0 };
  const wanted = new Set(planned.map((r) => r.identifier));

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of existing) {
    if (request.identifier.startsWith(REMINDER_ID_PREFIX) && !wanted.has(request.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }

  for (const reminder of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: { title: reminder.title, body: reminder.body, data: { habitId: reminder.habitId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: reminder.weekday,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
  }

  return { scheduled: planned.length, overflow, permission };
}
