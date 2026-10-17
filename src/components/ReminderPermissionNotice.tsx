import { StyleSheet, Text, View } from 'react-native';

import {
  type ReminderPermission,
  openSystemSettings,
} from '@/features/reminders/reminder.service';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

import { Button } from './Button';
import { Icon } from './Icon';

type Props = {
  permission: ReminderPermission;
  remindersEnabledGlobally: boolean;
  onRequest: () => Promise<ReminderPermission>;
};

/** Explains why reminders won't fire and how to fix it. Renders nothing when all is well. */
export function ReminderPermissionNotice({ permission, remindersEnabledGlobally, onRequest }: Props) {
  let message: string | null = null;
  let action: { label: string; onPress: () => void } | null = null;

  if (permission === 'unavailable') {
    message = 'Reminders aren’t available on this device. Everything else works as usual.';
  } else if (permission === 'denied') {
    message = 'Notifications are off for FLAME. Turn them on in Settings › FLAME › Notifications.';
    action = { label: 'Open Settings', onPress: () => void openSystemSettings() };
  } else if (permission === 'undetermined') {
    message = 'FLAME needs permission to send reminders.';
    action = { label: 'Allow notifications', onPress: () => void onRequest() };
  } else if (!remindersEnabledGlobally) {
    message = 'Reminders are paused for all habits. Turn them back on in the You tab.';
  }

  if (!message) return null;
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Icon name="bell.slash.fill" size={16} color={colors.accent} fallback="!" />
        <Text style={[type.footnote, styles.text]}>{message}</Text>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'flex-start',
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  text: { flex: 1, color: colors.textPrimary },
});
