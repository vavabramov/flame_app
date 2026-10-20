import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { HabitForm } from '@/components/HabitForm';
import { HabitIcon } from '@/components/HabitIcon';
import { HabitTypeBadge } from '@/components/HabitTypeSelector';
import { type ImportPreparation, prepareImport } from '@/features/blueprint/import-blueprint';
import { useHabitStore } from '@/features/habits/habit-store';
import { type HabitInput } from '@/features/habits/habit.types';
import { describeSchedule, parseReminderTime } from '@/features/habits/habit.validation';
import { useSingleFlight } from '@/lib/use-single-flight';
import { colors } from '@/theme/colors';
import { GUTTER, radius, spacing, TOUCH_TARGET } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

type Ready = Extract<ImportPreparation, { ok: true }>;
const MAX_SHOWN_ERRORS = 8;

/**
 * Import a habit blueprint exported by the FLAME MCP server.
 * Paste → independent validation → preview (Cancel / Edit / Create).
 * Nothing is written until the user taps Create habit (or saves the edit form).
 */
export default function ImportHabitScreen() {
  const { createHabit, reminders, settings, requestReminders } = useHabitStore();
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<Extract<ImportPreparation, { ok: false }>['errors']>([]);
  const [ready, setReady] = useState<Ready | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const check = () => {
    const result = prepareImport(text);
    if (result.ok) {
      setProblems([]);
      setReady(result);
    } else {
      setProblems(result.errors);
      setReady(null);
    }
  };

  // One create per confirmation, however many taps.
  const create = useSingleFlight(async (input: HabitInput) => {
    setCreating(true);
    setCreateError(null);
    try {
      await createHabit(input);
      router.back();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The habit couldn’t be created. Nothing was saved.');
      setCreating(false);
    }
  });

  if (ready && editing) {
    return (
      <HabitForm
        title="Edit before creating"
        submitLabel="Create"
        initial={ready.input}
        onSubmit={(input) => create(input)}
        onCancel={() => setEditing(false)}
        reminderPermission={reminders.permission}
        remindersEnabledGlobally={settings.remindersEnabled}
        onRequestReminderPermission={requestReminders}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <HeaderButton
          label={ready ? 'Back' : 'Cancel'}
          onPress={() => (ready ? setReady(null) : router.back())}
          accessibilityLabel={ready ? 'Back to the pasted JSON' : 'Cancel import'}
        />
        <Text style={type.headline} accessibilityRole="header">
          {ready ? 'Review habit' : 'Import habit'}
        </Text>
        {ready ? <View style={styles.headerButton} /> : <HeaderButton label="Check" onPress={check} strong />}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {ready ? (
          <Preview
            ready={ready}
            creating={creating}
            error={createError}
            onCreate={() => create(ready.input)}
            onEdit={() => setEditing(true)}
            onCancel={() => router.back()}
          />
        ) : (
          <>
            <Text style={type.callout} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
              Paste the habit JSON exported from Claude (the FLAME MCP server). FLAME checks it and shows a preview.
              Nothing is created until you confirm.
            </Text>
            <TextInput
              value={text}
              onChangeText={(value) => {
                setText(value);
                setProblems([]);
              }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder='{ "schemaVersion": "1.0.0", … }'
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Habit JSON"
              style={[styles.input, problems.length > 0 && styles.inputError]}
              maxFontSizeMultiplier={1.2}
            />
            <Button label="Check" onPress={check} disabled={text.trim() === ''} />
            {problems.length > 0 ? (
              <View style={styles.problems} accessibilityLiveRegion="polite">
                <Text style={[type.headline, styles.errorText]}>This can’t be imported</Text>
                {problems.slice(0, MAX_SHOWN_ERRORS).map((p, i) => (
                  <Text key={`${p.path}-${i}`} style={type.footnote}>
                    • {p.message}
                    {p.path ? ` (${p.path})` : ''}
                  </Text>
                ))}
                {problems.length > MAX_SHOWN_ERRORS ? (
                  <Text style={type.footnote}>…and {problems.length - MAX_SHOWN_ERRORS} more.</Text>
                ) : null}
                <Text style={type.footnote}>Nothing was saved. Ask Claude for a fresh export, or fix the JSON.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Preview({
  ready,
  creating,
  error,
  onCreate,
  onEdit,
  onCancel,
}: {
  ready: Ready;
  creating: boolean;
  error: string | null;
  onCreate: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { input, warnings } = ready;
  const time = input.reminderTime ? parseReminderTime(input.reminderTime) : null;
  const reminder = time
    ? new Date(2000, 0, 1, time.hour, time.minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'None';

  return (
    <View style={styles.preview}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <HabitIcon icon={input.icon} color={input.color} />
          <View style={styles.flex}>
            {/* User-provided text is rendered as plain text only. */}
            <Text style={type.title} numberOfLines={2}>
              {input.name}
            </Text>
            <View style={styles.badges}>
              <HabitTypeBadge habitType={input.type} />
              <Text style={type.footnote}>📖 Read More</Text>
            </View>
          </View>
        </View>
        <Row label="Schedule" value={describeSchedule(input.scheduleDays)} />
        <Row label="Daily target" value={input.targetMinutes === null ? 'No target' : `${input.targetMinutes} min`} />
        <Row label="Reminder" value={reminder} />
        <Row label="Tracks" value="Minutes read (required) · Pages (optional)" />
        <Text style={type.footnote}>
          The habit counts as done only when you tap Complete. Reaching the target doesn’t complete it. Your other
          habits and history aren’t changed.
        </Text>
        {warnings.map((w) => (
          <Text key={w.code} style={[type.footnote, styles.warning]}>
            {w.message}
          </Text>
        ))}
      </View>

      {error ? (
        <Text style={[type.footnote, styles.errorText]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label="Create habit" onPress={onCreate} loading={creating} />
      <Button label="Edit details" onPress={onEdit} variant="secondary" disabled={creating} />
      <Button label="Cancel" onPress={onCancel} variant="ghost" disabled={creating} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={type.callout}>{label}</Text>
      <Text style={[type.body, styles.rowValue]}>{value}</Text>
    </View>
  );
}

function HeaderButton({
  label,
  onPress,
  strong = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={10}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Text
        style={[type.body, { color: strong ? colors.accent : colors.textSecondary, fontWeight: strong ? '700' : '400' }]}
        maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: { minHeight: TOUCH_TARGET, minWidth: 64, justifyContent: 'center' },
  content: { padding: GUTTER, gap: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  input: {
    minHeight: 200,
    maxHeight: 360,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.danger },
  problems: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerMuted },
  errorText: { color: colors.danger },
  preview: { gap: spacing.md },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  warning: { color: colors.accent },
});
