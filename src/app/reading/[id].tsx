import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HabitIcon } from '@/components/HabitIcon';
import { useHabitStore } from '@/features/habits/habit-store';
import { useSingleFlight } from '@/lib/use-single-flight';
import { tracksReading } from '@/features/habits/habit-template';
import { type ReadingEntryErrors, parseReadingEntry } from '@/features/reading/reading.validation';
import { colors, withAlpha } from '@/theme/colors';
import { GUTTER, radius, spacing, TOUCH_TARGET } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

const QUICK_MINUTES = [10, 15, 30, 45];

/** Log or correct today's reading (minutes, optional pages) for a Read More habit. */
export default function ReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, today, dayMetrics, stats, saveReadingToday, toggleToday } = useHabitStore();
  const habit = habits.find((h) => h.id === id);
  const existing = habit ? dayMetrics.get(habit.id)?.get(today) : undefined;

  const [minutesText, setMinutesText] = useState(existing ? String(existing.minutes) : '');
  const [pagesText, setPagesText] = useState(existing?.pages != null ? String(existing.pages) : '');
  const [alsoCheckIn, setAlsoCheckIn] = useState(false);
  const [errors, setErrors] = useState<ReadingEntryErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const summary = habit ? stats.get(habit.id) : undefined;
  const canAlsoCheckIn = !!summary?.isScheduledToday && !summary.isCompletedToday && !summary.isLapsedToday;

  // Repeated taps never write twice: only one save runs at a time.
  const save = useSingleFlight(async () => {
    if (!habit) return;
    const { value, errors: found } = parseReadingEntry(minutesText, pagesText);
    setErrors(found);
    if (!value) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveReadingToday(habit.id, value);
      // Checking in stays a separate, explicit choice.
      if (alsoCheckIn && canAlsoCheckIn) toggleToday(habit.id);
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  });

  if (!habit || !tracksReading(habit.template)) {
    return (
      <View style={styles.missing}>
        <EmptyState
          icon="book"
          iconFallback="📖"
          title="Reading isn’t tracked here"
          message="This habit doesn’t use the Read More template."
        />
        <Button label="Close" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <HeaderButton label="Cancel" onPress={() => router.back()} />
        <Text style={type.headline} accessibilityRole="header">
          {existing ? 'Edit today’s reading' : 'Log today’s reading'}
        </Text>
        <HeaderButton label="Save" onPress={save} strong disabled={saving} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.habitRow}>
          <HabitIcon icon={habit.icon} color={habit.color} />
          <View style={styles.flex}>
            <Text style={type.headline} numberOfLines={2}>
              {habit.name}
            </Text>
            {habit.targetMinutes !== null ? (
              <Text style={type.footnote}>Daily target: {habit.targetMinutes} min</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={type.caption}>Minutes read</Text>
          <TextInput
            value={minutesText}
            onChangeText={setMinutesText}
            keyboardType="number-pad"
            autoFocus={!existing}
            placeholder="e.g. 20"
            placeholderTextColor={colors.textTertiary}
            maxLength={4}
            accessibilityLabel="Minutes read"
            style={[styles.input, errors.minutes && styles.inputError]}
            maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
          />
          <View style={styles.chips}>
            {QUICK_MINUTES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMinutesText(String(m))}
                accessibilityRole="button"
                accessibilityLabel={`${m} minutes`}
                style={[styles.chip, minutesText === String(m) && styles.chipSelected]}>
                <Text style={styles.chipText}>{m} min</Text>
              </Pressable>
            ))}
          </View>
          {errors.minutes ? <Text style={[type.footnote, styles.error]}>{errors.minutes}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={type.caption}>Pages (optional)</Text>
          <TextInput
            value={pagesText}
            onChangeText={setPagesText}
            keyboardType="number-pad"
            placeholder="Leave empty if you didn’t count"
            placeholderTextColor={colors.textTertiary}
            maxLength={5}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="Pages read, optional"
            style={[styles.input, errors.pages && styles.inputError]}
            maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
          />
          {errors.pages ? <Text style={[type.footnote, styles.error]}>{errors.pages}</Text> : null}
        </View>

        {canAlsoCheckIn ? (
          <View style={styles.checkInRow}>
            <View style={styles.flex}>
              <Text style={type.body}>Also check in for today</Text>
              <Text style={type.footnote}>Logging minutes alone doesn’t mark the habit done.</Text>
            </View>
            <Switch
              value={alsoCheckIn}
              onValueChange={setAlsoCheckIn}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
              accessibilityLabel="Also check in for today"
            />
          </View>
        ) : null}

        {saveError ? <Text style={[type.footnote, styles.error]}>{saveError}</Text> : null}
        <Text style={type.footnote}>You can correct today’s numbers any time today. Saving again replaces them.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HeaderButton({
  label,
  onPress,
  strong = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={({ pressed }) => [styles.headerButton, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
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
  missing: { flex: 1, backgroundColor: colors.background, padding: GUTTER, justifyContent: 'center', gap: spacing.lg },
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
    gap: spacing.md,
  },
  headerButton: { minHeight: TOUCH_TARGET, minWidth: 64, justifyContent: 'center' },
  content: { padding: GUTTER, gap: spacing.xxl, backgroundColor: colors.background, flexGrow: 1 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  field: { gap: spacing.sm },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: withAlpha(colors.accent, 0.12) },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
