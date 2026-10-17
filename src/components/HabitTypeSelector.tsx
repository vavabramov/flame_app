import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HABIT_TYPES, HABIT_TYPE_COPY, type HabitType } from '@/features/habits/habit-type';
import { colors, withAlpha } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

import { Icon, type IconName } from './Icon';

export const HABIT_TYPE_ICON: Record<HabitType, { name: IconName; fallback: string }> = {
  build: { name: 'arrow.up.right', fallback: '↗' },
  break: { name: 'nosign', fallback: '⊘' },
};

/** Two compact cards: Build or Break. */
export function HabitTypeSelector({
  value,
  onChange,
  accent,
}: {
  value: HabitType;
  onChange: (type: HabitType) => void;
  accent: string;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {HABIT_TYPES.map((habitType) => {
        const selected = habitType === value;
        const copy = HABIT_TYPE_COPY[habitType];
        return (
          <Pressable
            key={habitType}
            onPress={() => onChange(habitType)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${copy.label}. ${copy.description}`}
            style={[styles.option, selected && { borderColor: accent, backgroundColor: withAlpha(accent, 0.1) }]}>
            <View style={styles.titleRow}>
              <Icon
                name={HABIT_TYPE_ICON[habitType].name}
                fallback={HABIT_TYPE_ICON[habitType].fallback}
                size={14}
                color={selected ? accent : colors.textSecondary}
              />
              <Text style={[type.headline, !selected && styles.dim]} maxFontSizeMultiplier={1.4}>
                {copy.label}
              </Text>
            </View>
            <Text style={type.footnote} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
              {copy.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small, low-key label for lists. */
export function HabitTypeBadge({ habitType }: { habitType: HabitType }) {
  return (
    <View style={styles.badge} accessible accessibilityLabel={`${HABIT_TYPE_COPY[habitType].label} habit`}>
      <Icon
        name={HABIT_TYPE_ICON[habitType].name}
        fallback={HABIT_TYPE_ICON[habitType].fallback}
        size={10}
        color={colors.textSecondary}
      />
      <Text style={styles.badgeText} maxFontSizeMultiplier={1.4}>
        {HABIT_TYPE_COPY[habitType].label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dim: { color: colors.textSecondary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
});
