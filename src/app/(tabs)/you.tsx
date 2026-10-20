import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ReminderPermissionNotice } from '@/components/ReminderPermissionNotice';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { useHabitStore } from '@/features/habits/habit-store';
import { type ReminderPermission } from '@/features/reminders/reminder.service';
import { type AppSettings } from '@/features/settings/settings.repository';
import { MILESTONES, milestoneProgress } from '@/features/streaks/milestones';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

const PERMISSION_LABEL: Record<ReminderPermission, string> = {
  granted: 'Allowed',
  denied: 'Off in iOS Settings',
  undetermined: 'Not asked yet',
  unavailable: 'Unavailable on this device',
};

export default function YouScreen() {
  const {
    habits,
    activeHabits,
    completions,
    stats,
    settings,
    reminders,
    updateSettings,
    refreshReminderPermission,
    requestReminders,
  } = useHabitStore();

  // The user may have changed notification permission in iOS Settings.
  useFocusEffect(
    useCallback(() => {
      refreshReminderPermission();
    }, [refreshReminderPermission]),
  );

  let totalCheckIns = 0;
  for (const dates of completions.values()) totalCheckIns += dates.size;
  let bestEver = 0;
  for (const summary of stats.values()) bestEver = Math.max(bestEver, summary.bestStreak);
  const milestones = milestoneProgress(totalCheckIns);
  const remindersCount = activeHabits.filter((h) => h.reminderTime !== null).length;

  const setSetting = async (patch: Partial<AppSettings>) => {
    try {
      await updateSettings(patch);
    } catch (error) {
      Alert.alert('Couldn’t save setting', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen title="You">
      <View style={styles.tiles}>
        <StatTile label="Check-ins" value={String(totalCheckIns)} detail="all time" accent={colors.accent} />
        <StatTile label="Best streak" value={String(bestEver)} detail="any habit" />
      </View>

      <Section title="Milestones">
        <Card style={styles.gap}>
          <View style={styles.milestones}>
            {MILESTONES.map((m) => {
              const reached = milestones.reached.includes(m);
              return (
                <View
                  key={m}
                  style={[styles.milestone, reached && styles.milestoneReached]}
                  accessible
                  accessibilityLabel={`${m} check-ins, ${reached ? 'reached' : 'not reached yet'}`}>
                  <Icon
                    name={reached ? 'flame.fill' : 'flame'}
                    size={18}
                    color={reached ? colors.accent : colors.textTertiary}
                    fallback="🔥"
                  />
                  <Text style={[styles.milestoneValue, reached && { color: colors.textPrimary }]}>{m}</Text>
                </View>
              );
            })}
          </View>
          <Text style={type.footnote}>
            {milestones.next === null
              ? 'Every milestone reached. Keep the flame going.'
              : `${milestones.remaining} more check-in${milestones.remaining === 1 ? '' : 's'} to reach ${milestones.next}. Check-ins across all habits count.`}
          </Text>
        </Card>
      </Section>

      <Section title="Reminders">
        <Card style={styles.gap}>
          <Row
            label="Reminders"
            detail={settings.remindersEnabled ? `${remindersCount} habit${remindersCount === 1 ? '' : 's'} with a reminder` : 'Paused for all habits'}>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={(remindersEnabled) => setSetting({ remindersEnabled })}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
              accessibilityLabel="Reminders"
            />
          </Row>
          <Row label="Notification permission" detail={PERMISSION_LABEL[reminders.permission]} />
          {settings.remindersEnabled && remindersCount > 0 ? (
            <ReminderPermissionNotice
              permission={reminders.permission}
              remindersEnabledGlobally={settings.remindersEnabled}
              onRequest={requestReminders}
            />
          ) : null}
          {reminders.overflow > 0 ? (
            <Text style={[type.footnote, { color: colors.danger }]}>
              iOS allows 64 scheduled reminders per app. {reminders.overflow} weekly reminder
              {reminders.overflow === 1 ? '' : 's'} couldn’t be scheduled. Remove some reminder days to fit.
            </Text>
          ) : null}
          {reminders.error ? <Text style={[type.footnote, { color: colors.danger }]}>{reminders.error}</Text> : null}
          <Text style={type.footnote}>Set a reminder time for each habit in its edit screen.</Text>
        </Card>
      </Section>

      <Section title="Preferences">
        <Card style={styles.gap}>
          <Row label="Haptic feedback" detail="A light tap when you check in">
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={(hapticsEnabled) => setSetting({ hapticsEnabled })}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
              accessibilityLabel="Haptic feedback"
            />
          </Row>
          <Row label="Animated flame" detail="A gently moving flame on Today, even with Reduce Motion on">
            <Switch
              value={settings.flameAnimation}
              onValueChange={(flameAnimation) => setSetting({ flameAnimation })}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
              accessibilityLabel="Animated flame"
            />
          </Row>
        </Card>
      </Section>

      <Section title="About">
        <Card style={styles.gap}>
          <Row label="FLAME" detail={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`} />
          <Text style={type.footnote}>
            Your habits stay on this device. There’s no account and no tracking. {habits.length} habit
            {habits.length === 1 ? '' : 's'} stored.
          </Text>
          <Text style={type.footnote}>
            A streak counts scheduled days in a row. Days a habit isn’t scheduled never break it, and today
            only counts against you once it’s over.
          </Text>
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.caption} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, detail, children }: { label: string; detail?: string; children?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={type.body}>{label}</Text>
        {detail ? <Text style={type.footnote}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: spacing.md },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  rowText: { flex: 1, gap: spacing.xxs },
  milestones: { flexDirection: 'row', gap: spacing.sm },
  milestone: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
  },
  milestoneReached: { backgroundColor: colors.accentMuted },
  milestoneValue: { fontSize: 17, fontWeight: '700', color: colors.textTertiary, fontVariant: ['tabular-nums'] },
});
