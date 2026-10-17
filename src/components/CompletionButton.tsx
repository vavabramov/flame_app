import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, withAlpha } from '@/theme/colors';
import { TOUCH_TARGET } from '@/theme/spacing';

import { Icon } from './Icon';

/** The check-in circle. Decorative: the surrounding card is the accessible control. */
export function CompletionButton({ completed, color }: { completed: boolean; color: string }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const wasCompleted = useRef(completed);

  useEffect(() => {
    const justCompleted = completed && !wasCompleted.current;
    wasCompleted.current = completed;
    if (!justCompleted || reduceMotion) return;
    scale.set(
      withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 220 })),
    );
  }, [completed, reduceMotion, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View
      style={[
        styles.circle,
        completed
          ? { backgroundColor: color, borderColor: color, shadowColor: color, shadowOpacity: 0.45 }
          : { backgroundColor: withAlpha(color, 0.06), borderColor: withAlpha(color, 0.55) },
        animated,
      ]}>
      {completed ? (
        <Icon name="checkmark" size={20} weight="bold" color={colors.onAccent} fallback="✓" />
      ) : (
        <View style={[styles.dot, { backgroundColor: withAlpha(color, 0.4) }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
