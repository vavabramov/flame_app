/**
 * A small, calm, animated flame: soft outer glow, main flame and an inner
 * highlight, each on its own slow loop so the motion feels organic.
 *
 * - Runs entirely on the UI thread (Reanimated shared values); no React state
 *   updates per frame.
 * - Deterministic: fixed durations and easing, no randomness.
 * - Small amplitude: scale ≤ 1.05, rotation ±2°.
 * - Static when `animate` is false (e.g. screen not focused) or when the user
 *   prefers reduced motion.
 * - Fixed footprint: the glow is drawn outside the box without affecting layout.
 * - Decorative: hidden from screen readers; label the surrounding element.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';

import { Icon } from './Icon';

type Props = {
  /** Width and height of the flame's box, in points. */
  size?: number;
  /** Lit (orange, glowing) when there's an active streak; dim ember otherwise. */
  isActive?: boolean;
  /** Pause the loop, e.g. when the screen isn't visible. */
  animate?: boolean;
};

const HIGHLIGHT = '#FFC24B';
const ease = Easing.inOut(Easing.sin);

/** Loop a shared value between `from` and `to`, starting after `delay` ms. */
function loop(duration: number, to: number, delay = 0) {
  return withDelay(delay, withRepeat(withTiming(to, { duration, easing: ease }), -1, true));
}

export function LivingFlame({ size = 72, isActive = true, animate = true }: Props) {
  const reduceMotion = useReducedMotion();
  const running = animate && !reduceMotion;

  const glow = useSharedValue(0); // 0 → 1 drives glow opacity and scale
  const sway = useSharedValue(-1); // -1 → 1 drives rotation
  const stretch = useSharedValue(0); // 0 → 1 drives vertical scale
  const flicker = useSharedValue(0); // 0 → 1 drives the inner highlight

  useEffect(() => {
    const values = [glow, sway, stretch, flicker];
    if (!running) {
      values.forEach((v) => cancelAnimation(v));
      glow.set(withTiming(0.5, { duration: 400 }));
      sway.set(withTiming(0, { duration: 400 }));
      stretch.set(withTiming(0, { duration: 400 }));
      flicker.set(withTiming(0.5, { duration: 400 }));
      return;
    }
    // Staggered, non-multiple durations so the layers never sync up.
    glow.set(loop(3200, 1));
    sway.set(loop(2600, 1, 150));
    stretch.set(loop(2100, 1, 400));
    flicker.set(loop(1800, 1, 250));
    return () => values.forEach((v) => cancelAnimation(v));
  }, [running, glow, sway, stretch, flicker]);

  // Idle embers move half as much.
  const amplitude = isActive ? 1 : 0.5;

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.get() * 0.3,
    transform: [{ scale: 0.96 + glow.get() * 0.09 }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${sway.get() * 2 * amplitude}deg` },
      { scaleY: 1 + stretch.get() * 0.05 * amplitude },
      { scaleX: 1 - stretch.get() * 0.015 * amplitude },
    ],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + flicker.get() * 0.3,
    transform: [
      { rotate: `${-sway.get() * 1.5 * amplitude}deg` },
      { scale: 0.94 + flicker.get() * 0.08 * amplitude },
    ],
  }));

  const flameSize = Math.round(size * 0.78);
  const coreSize = Math.round(size * 0.36);

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="living-flame">
      {isActive ? (
        <Animated.View
          style={[
            styles.glow,
            { width: size * 1.15, height: size * 1.15, borderRadius: size, shadowRadius: size * 0.35 },
            glowStyle,
          ]}
        />
      ) : null}

      <Animated.View style={[styles.layer, styles.anchorBottom, flameStyle]}>
        <Icon name="flame.fill" size={flameSize} color={isActive ? colors.accent : colors.textTertiary} fallback="🔥" />
      </Animated.View>

      {isActive ? (
        <Animated.View style={[styles.layer, styles.anchorBottom, { bottom: size * 0.1 }, coreStyle]}>
          <Icon name="flame.fill" size={coreSize} color={HIGHLIGHT} fallback="" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    backgroundColor: colors.accentMuted,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end' },
  // Sway and stretch pivot at the base, like a real flame.
  anchorBottom: { transformOrigin: 'bottom' },
});
