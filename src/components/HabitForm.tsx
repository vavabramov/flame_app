import { type ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { READ_MORE_DEFAULT_TARGET, tracksReading } from '@/features/habits/habit-template';
import { HABIT_TYPE_COPY } from '@/features/habits/habit-type';
import { MAX_TARGET_MINUTES } from '@/features/reading/reading.validation';
import { type HabitInput } from '@/features/habits/habit.types';
import {
  ALL_DAYS,
  NAME_MAX_LENGTH,
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_SHORT,
  describeSchedule,
  formatReminderTime,
  parseReminderTime,
  validateHabitInput,
} from '@/features/habits/habit.validation';
import { type ReminderPermission } from '@/features/reminders/reminder.service';
import { HABIT_COLORS, HABIT_ICONS, colors, withAlpha } from '@/theme/colors';
import { GUTTER, radius, spacing, TOUCH_TARGET } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

import { HabitIcon } from './HabitIcon';
import { HabitTypeSelector } from './HabitTypeSelector';
import { Icon } from './Icon';
import { ReminderPermissionNotice } from './ReminderPermissionNotice';

type Props = {
  title: string;
  initial: HabitInput;
  submitLabel: string;
  onSubmit: (input: HabitInput) => Promise<void>;
  onCancel: () => void;
  reminderPermission: ReminderPermission;
  remindersEnabledGlobally: boolean;
  onRequestReminderPermission: () => Promise<ReminderPermission>;
  /** Extra content above the form, e.g. the template picker. */
  header?: ReactNode;
  /** Extra content under the form, e.g. the archive action. */
  footer?: ReactNode;
};

const DEFAULT_REMINDER = '20:00';
const TARGET_STEP = 5;

export function HabitForm({
  title,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  reminderPermission,
  remindersEnabledGlobally,
  onRequestReminderPermission,
  header,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState<HabitInput>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { errors } = validateHabitInput(input);
  const visibleErrors = showErrors ? errors : {};
  const set = (patch: Partial<HabitInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const toggleDay = (day: number) =>
    set({
      scheduleDays: input.scheduleDays.includes(day)
        ? input.scheduleDays.filter((d) => d !== day)
        : [...input.scheduleDays, day],
    });

  const toggleReminder = async (enabled: boolean) => {
    if (!enabled) {
      set({ reminderTime: null });
      return;
    }
    set({ reminderTime: input.reminderTime ?? DEFAULT_REMINDER });
    // Ask for permission only now, when the user has asked for a reminder.
    if (reminderPermission === 'undetermined') await onRequestReminderPermission();
  };

  const submit = async () => {
    setShowErrors(true);
    const { value } = validateHabitInput(input);
    if (!value || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(value);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? spacing.lg : insets.top + spacing.md }]}>
        <HeaderButton label="Cancel" onPress={onCancel} />
        <Text style={type.headline} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        <HeaderButton label={submitLabel} onPress={submit} strong disabled={saving} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <View style={styles.preview}>
          <HabitIcon icon={input.icon} color={input.color} size={64} />
        </View>

        {header}

        <Section label="Direction" error={visibleErrors.type}>
          <HabitTypeSelector value={input.type} onChange={(habitType) => set({ type: habitType })} accent={input.color} />
          {initial.name !== '' && input.type !== initial.type ? (
            <Text style={type.footnote}>
              Past check-ins are kept and count as successful days for the new direction.
            </Text>
          ) : null}
        </Section>

        <Section label="Name" error={visibleErrors.name}>
          <TextInput
            value={input.name}
            onChangeText={(name) => set({ name })}
            placeholder={HABIT_TYPE_COPY[input.type].namePlaceholder}
            placeholderTextColor={colors.textTertiary}
            maxLength={NAME_MAX_LENGTH}
            autoFocus={initial.name === ''}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel="Habit name"
            style={[styles.input, visibleErrors.name && styles.inputError]}
            maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
          />
          <Text style={[type.footnote, styles.counter]}>
            {input.name.trim().length}/{NAME_MAX_LENGTH}
          </Text>
        </Section>

        <Section label="Icon">
          <View style={styles.grid}>
            {HABIT_ICONS.map((icon) => {
              const selected = icon === input.icon;
              return (
                <Pressable
                  key={icon}
                  onPress={() => set({ icon })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Icon ${icon}`}
                  style={[
                    styles.iconOption,
                    selected && { borderColor: input.color, backgroundColor: withAlpha(input.color, 0.14) },
                  ]}>
                  <Text style={styles.iconGlyph} maxFontSizeMultiplier={1}>
                    {icon}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section label="Color">
          <View style={styles.colorRow}>
            {HABIT_COLORS.map((color, index) => {
              const selected = color === input.color;
              return (
                <Pressable
                  key={color}
                  onPress={() => set({ color })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Color ${index + 1} of ${HABIT_COLORS.length}`}
                  style={[styles.colorOption, selected && { borderColor: color }]}>
                  <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section label="Schedule" hint={describeSchedule(input.scheduleDays) || 'No days'} error={visibleErrors.scheduleDays}>
          <View style={styles.dayRow}>
            {WEEKDAY_DISPLAY_ORDER.map((day) => {
              const selected = input.scheduleDays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={WEEKDAY_SHORT[day]}
                  style={[styles.dayOption, selected && { backgroundColor: input.color, borderColor: input.color }]}>
                  <Text
                    style={[styles.dayLabel, selected && { color: colors.onAccent }]}
                    maxFontSizeMultiplier={1.2}>
                    {WEEKDAY_SHORT[day].slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {input.scheduleDays.length !== 7 ? (
            <Pressable
              onPress={() => set({ scheduleDays: [...ALL_DAYS] })}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.linkButton}>
              <Text style={[type.footnote, { color: colors.accent }]}>Every day</Text>
            </Pressable>
          ) : null}
        </Section>

        {tracksReading(input.template) ? (
          <Section label="Daily reading target" hint="Guidance only" error={visibleErrors.targetMinutes}>
            <View style={styles.reminderCard}>
              <View style={styles.reminderRow}>
                <Pressable
                  onPress={() => set({ targetMinutes: Math.max(TARGET_STEP, (input.targetMinutes ?? READ_MORE_DEFAULT_TARGET) - TARGET_STEP) })}
                  accessibilityRole="button"
                  accessibilityLabel="Lower reading target"
                  style={styles.stepperButton}
                  hitSlop={4}>
                  <Icon name="minus" size={14} color={colors.textPrimary} fallback="−" />
                </Pressable>
                <Text style={[styles.time, styles.flexCenter]} accessibilityLabel={`Reading target ${input.targetMinutes ?? READ_MORE_DEFAULT_TARGET} minutes`}>
                  {input.targetMinutes ?? READ_MORE_DEFAULT_TARGET} min
                </Text>
                <Pressable
                  onPress={() => set({ targetMinutes: Math.min(MAX_TARGET_MINUTES, (input.targetMinutes ?? READ_MORE_DEFAULT_TARGET) + TARGET_STEP) })}
                  accessibilityRole="button"
                  accessibilityLabel="Raise reading target"
                  style={styles.stepperButton}
                  hitSlop={4}>
                  <Icon name="plus" size={14} color={colors.textPrimary} fallback="+" />
                </Pressable>
              </View>
              <Text style={type.footnote}>
                Shown as a goal next to the minutes you log. Your check-in and streak stay up to you.
              </Text>
            </View>
          </Section>
        ) : null}

        <Section label="Reminder" error={visibleErrors.reminderTime}>
          <View style={styles.reminderCard}>
            <View style={styles.reminderRow}>
              <View style={styles.flex}>
                <Text style={type.body}>Remind me</Text>
                <Text style={type.footnote}>A gentle nudge on scheduled days.</Text>
              </View>
              <Switch
                value={input.reminderTime !== null}
                onValueChange={toggleReminder}
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
                accessibilityLabel="Daily reminder"
              />
            </View>
            {input.reminderTime !== null ? (
              <TimeStepper value={input.reminderTime} onChange={(reminderTime) => set({ reminderTime })} />
            ) : null}
          </View>
          {input.reminderTime !== null ? (
            <ReminderPermissionNotice
              permission={reminderPermission}
              remindersEnabledGlobally={remindersEnabledGlobally}
              onRequest={onRequestReminderPermission}
            />
          ) : null}
        </Section>

        {saveError ? (
          <Text style={[type.footnote, styles.error]} accessibilityLiveRegion="polite">
            {saveError}
          </Text>
        ) : null}

        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={type.caption}>{label}</Text>
        {hint ? <Text style={type.footnote}>{hint}</Text> : null}
      </View>
      {children}
      {error ? (
        <Text style={[type.footnote, styles.error]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
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

const MINUTE_STEP = 5;

function TimeStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const time = parseReminderTime(value) ?? { hour: 20, minute: 0 };
  const total = time.hour * 60 + time.minute;
  const shift = (minutes: number) => {
    const next = (((total + minutes) % 1440) + 1440) % 1440;
    // Snap to the step so repeated taps stay on round numbers.
    const snapped = Math.round(next / MINUTE_STEP) * MINUTE_STEP % 1440;
    onChange(formatReminderTime(Math.floor(snapped / 60), snapped % 60));
  };
  const display = new Date(2000, 0, 1, time.hour, time.minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.stepper} accessible accessibilityLabel={`Reminder time ${display}`} accessibilityRole="adjustable"
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => shift(event.nativeEvent.actionName === 'increment' ? 15 : -15)}>
      <StepperButtons onMinus={() => shift(-60)} onPlus={() => shift(60)} label="hour" />
      <Text style={styles.time} maxFontSizeMultiplier={1.3}>
        {display}
      </Text>
      <StepperButtons onMinus={() => shift(-MINUTE_STEP)} onPlus={() => shift(MINUTE_STEP)} label="minutes" />
    </View>
  );
}

function StepperButtons({ onMinus, onPlus, label }: { onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={styles.stepperGroup}>
      <Pressable onPress={onMinus} accessibilityLabel={`Earlier ${label}`} style={styles.stepperButton} hitSlop={4}>
        <Icon name="minus" size={14} color={colors.textPrimary} fallback="−" />
      </Pressable>
      <Text style={[type.caption, styles.stepperLabel]}>{label === 'hour' ? 'Hr' : 'Min'}</Text>
      <Pressable onPress={onPlus} accessibilityLabel={`Later ${label}`} style={styles.stepperButton} hitSlop={4}>
        <Icon name="plus" size={14} color={colors.textPrimary} fallback="+" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexCenter: { flex: 1, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerButton: { minHeight: TOUCH_TARGET, minWidth: 64, justifyContent: 'center' },
  content: { padding: GUTTER, gap: spacing.xxl },
  preview: { alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontSize: 17,
  },
  inputError: { borderColor: colors.danger },
  counter: { alignSelf: 'flex-end' },
  error: { color: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconOption: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconGlyph: { fontSize: 24 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorOption: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  dayRow: { flexDirection: 'row', gap: spacing.xs },
  dayOption: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  dayLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  linkButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  reminderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperGroup: { alignItems: 'center', gap: spacing.xs, flexDirection: 'row' },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: { minWidth: 28, textAlign: 'center' },
  time: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});
