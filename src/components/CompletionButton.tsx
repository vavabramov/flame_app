import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, withAlpha } from '@/theme/colors';
import { radius, spacing, TOUCH_TARGET } from '@/theme/spacing';

import { Icon } from './Icon';

type Props = {
  completed: boolean;
  color: string;
  /** e.g. "Complete" / "Made it today". */
  label: string;
  /** e.g. "Done" / "Made it". */
  doneLabel: string;
  accessibilityLabel: string;
  onPress: () => void;
};

/** The one-tap check-in control. Tapping again undoes today's check-in. */
export function CompletionButton({ completed, color, label, doneLabel, accessibilityLabel, onPress }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const wasCompleted = useRef(completed);

  useEffect(() => {
    const justCompleted = completed && !wasCompleted.current;
    wasCompleted.current = completed;
    if (!justCompleted || reduceMotion) return;
    scale.set(
      withSequence(withTiming(1.08, { duration: 120 }), withSpring(1, { damping: 10, stiffness: 240 })),
    );
  }, [completed, reduceMotion, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={completed ? 'Double tap to undo today’s check-in' : 'Double tap to check in for today'}
      hitSlop={6}>
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.pill,
            completed
              ? { backgroundColor: color, borderColor: color, shadowColor: color, shadowOpacity: 0.4 }
              : { backgroundColor: withAlpha(color, 0.08), borderColor: withAlpha(color, 0.6) },
            pressed && styles.pressed,
            animated,
          ]}>
          <Icon
            name={completed ? 'checkmark' : 'circle'}
            size={14}
            weight="bold"
            color={completed ? colors.onAccent : color}
            fallback={completed ? '✓' : '○'}
          />
          <Text
            style={[styles.label, { color: completed ? colors.onAccent : colors.textPrimary }]}
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}>
            {completed ? doneLabel : label}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    shadowOpacity: 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: { opacity: 0.8 },
  label: { fontSize: 14, fontWeight: '700' },
});
