import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HABIT_TYPE_COPY, tracksLapses } from '@/features/habits/habit-type';
import { formatMinutesProgress } from '@/features/reading/reading-summary';
import { type Habit } from '@/features/habits/habit.types';
import { colors, withAlpha } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

import { CompletionButton } from './CompletionButton';
import { HabitIcon } from './HabitIcon';
import { Icon } from './Icon';

/** Read More only: today's logged reading and how to log or edit it. */
export type HabitCardReading = {
  minutes: number | null;
  pages: number | null;
  target: number | null;
  onLog: () => void;
};

type Props = {
  habit: Habit;
  completed: boolean;
  lapsed: boolean;
  currentStreak: number;
  onToggle: () => void;
  onToggleLapse: () => void;
  /** Present only for Read More habits; other habits render exactly as before. */
  reading?: HabitCardReading;
};

/** A Today row: one-tap check-in, plus a low-key lapse action for Break habits. */
export function HabitCard({ habit, completed, lapsed, currentStreak, onToggle, onToggleLapse, reading }: Props) {
  const copy = HABIT_TYPE_COPY[habit.type];
  const streakLabel =
    currentStreak > 0 ? `${currentStreak} in a row` : completed ? 'Streak started' : 'Start a streak today';

  return (
    <View
      style={[
        styles.card,
        completed && { backgroundColor: withAlpha(habit.color, 0.08), borderColor: withAlpha(habit.color, 0.35) },
      ]}>
      <HabitIcon icon={habit.icon} color={habit.color} />

      <View style={styles.text}>
        <Text style={type.headline} numberOfLines={2} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
          {habit.name}
        </Text>

        {lapsed ? (
          <Text style={type.footnote} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
            Lapse noted. Tomorrow is a fresh start.
          </Text>
        ) : (
          <View style={styles.streakRow}>
            {currentStreak > 0 ? <Icon name="flame.fill" size={13} color={colors.accent} fallback="🔥" /> : null}
            <Text
              style={[type.footnote, currentStreak > 0 && styles.streakActive]}
              maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
              {streakLabel}
            </Text>
          </View>
        )}

        {reading ? <ReadingLine reading={reading} habitName={habit.name} /> : null}

        {tracksLapses(habit.type) && !completed ? (
          <Pressable
            onPress={onToggleLapse}
            accessibilityRole="button"
            accessibilityLabel={lapsed ? `Undo lapse for ${habit.name}` : `Log a lapse for ${habit.name}`}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 12 }}
            style={styles.lapseLink}>
            <Text style={styles.lapseText} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
              {lapsed ? 'Undo' : 'Log a lapse'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {lapsed ? null : (
        <CompletionButton
          completed={completed}
          color={habit.color}
          label={copy.action}
          doneLabel={copy.actionDone}
          accessibilityLabel={`${copy.action}: ${habit.name}. ${streakLabel}.`}
          onPress={onToggle}
        />
      )}
    </View>
  );
}

function ReadingLine({ reading, habitName }: { reading: HabitCardReading; habitName: string }) {
  const logged = reading.minutes !== null;
  const summary = logged
    ? `${formatMinutesProgress(reading.minutes ?? 0, reading.target)}${reading.pages !== null ? ` · ${reading.pages} pages` : ''}`
    : reading.target !== null
      ? `0 / ${reading.target} min`
      : 'No reading logged';
  return (
    <View style={styles.readingRow}>
      <Text style={[type.footnote, logged && styles.streakActive]} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
        📖 {summary}
      </Text>
      <Pressable
        onPress={reading.onLog}
        accessibilityRole="button"
        accessibilityLabel={`${logged ? 'Edit' : 'Log'} today’s reading for ${habitName}`}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 12 }}>
        <Text style={styles.readingLink} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
          {logged ? 'Edit' : 'Log reading'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: spacing.xxs },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  streakActive: { color: colors.textPrimary },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  readingLink: { fontSize: 13, fontWeight: '600', color: colors.accent },
  lapseLink: { alignSelf: 'flex-start', paddingTop: spacing.xxs },
  lapseText: { fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' },
});
