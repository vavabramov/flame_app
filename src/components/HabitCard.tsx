import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Habit } from '@/features/habits/habit.types';
import { colors, withAlpha } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

import { CompletionButton } from './CompletionButton';
import { HabitIcon } from './HabitIcon';
import { Icon } from './Icon';

type Props = {
  habit: Habit;
  completed: boolean;
  currentStreak: number;
  onToggle: () => void;
};

/** A Today row. The whole card is one tap target that checks in, or undoes today's check-in. */
export function HabitCard({ habit, completed, currentStreak, onToggle }: Props) {
  const streakLabel =
    currentStreak > 0 ? `${currentStreak} in a row` : completed ? 'Streak started' : 'Start a streak today';

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={`${habit.name}. ${streakLabel}.`}
      accessibilityHint={completed ? 'Double tap to undo today’s check-in' : 'Double tap to check in for today'}
      style={({ pressed }) => [
        styles.card,
        completed && { backgroundColor: withAlpha(habit.color, 0.08), borderColor: withAlpha(habit.color, 0.35) },
        pressed && styles.pressed,
      ]}>
      <HabitIcon icon={habit.icon} color={habit.color} />

      <View style={styles.text}>
        <Text style={type.headline} numberOfLines={2} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
          {habit.name}
        </Text>
        <View style={styles.streakRow}>
          {currentStreak > 0 ? (
            <Icon name="flame.fill" size={13} color={colors.accent} fallback="🔥" />
          ) : null}
          <Text
            style={[type.footnote, currentStreak > 0 && styles.streakActive]}
            maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
            {streakLabel}
          </Text>
        </View>
      </View>

      <CompletionButton completed={completed} color={habit.color} />
    </Pressable>
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
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  text: { flex: 1, gap: spacing.xxs },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  streakActive: { color: colors.textPrimary },
});
