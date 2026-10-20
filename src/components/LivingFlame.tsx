/**
 * A small, calm, animated flame: soft outer glow, main flame and an inner
 * highlight, each on its own loop so the motion feels organic.
 *
 * - Runs entirely on the UI thread (Reanimated shared values); no React state
 *   updates per frame.
 * - Deterministic: fixed durations and easing, no randomness.
 * - Small amplitude: rotation ±3°, stretch ≤ 7%.
 * - Static when `animate` is false (screen not focused, or the user turned the
 *   animated flame off in You › Preferences).
 * - Plays even with iOS Reduce Motion on: Reanimated would otherwise skip every
 *   animation, and the in-app switch is the explicit way to turn it off.
 * - Fixed footprint: the glow is drawn outside the box without affecting layout.
 * - Decorative: hidden from screen readers; label the surrounding element.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
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
  /** Run the loops. Pass false when the screen isn't visible or animation is off. */
  animate?: boolean;
};

const HIGHLIGHT = '#FFC24B';
const ease = Easing.inOut(Easing.sin);
const ALWAYS = ReduceMotion.Never;

/** Loop a shared value between its current value and `to`, starting after `delay` ms. */
function loop(duration: number, to: number, delay = 0) {
  return withDelay(
    delay,
    withRepeat(withTiming(to, { duration, easing: ease, reduceMotion: ALWAYS }), -1, true, undefined, ALWAYS),
    ALWAYS,
  );
}

export function LivingFlame({ size = 72, isActive = true, animate = true }: Props) {
  const glow = useSharedValue(0); // 0 → 1 drives glow opacity and scale
  const sway = useSharedValue(-1); // -1 → 1 drives rotation
  const stretch = useSharedValue(0); // 0 → 1 drives vertical scale
  const flicker = useSharedValue(0); // 0 → 1 drives the inner highlight

  useEffect(() => {
    const values = [glow, sway, stretch, flicker];
    if (!animate) {
      values.forEach((v) => cancelAnimation(v));
      glow.set(withTiming(0.5, { duration: 300, reduceMotion: ALWAYS }));
      sway.set(withTiming(0, { duration: 300, reduceMotion: ALWAYS }));
      stretch.set(withTiming(0, { duration: 300, reduceMotion: ALWAYS }));
      flicker.set(withTiming(0.5, { duration: 300, reduceMotion: ALWAYS }));
      return;
    }
    // Staggered, non-multiple durations so the layers never sync up.
    glow.set(loop(2800, 1));
    sway.set(loop(2300, 1, 150));
    stretch.set(loop(1700, 1, 400));
    flicker.set(loop(1300, 1, 250));
    return () => values.forEach((v) => cancelAnimation(v));
  }, [animate, glow, sway, stretch, flicker]);

  // Idle embers move half as much.
  const amplitude = isActive ? 1 : 0.5;

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.get() * 0.45,
    transform: [{ scale: 0.92 + glow.get() * 0.16 }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${sway.get() * 3 * amplitude}deg` },
      { scaleY: 1 + stretch.get() * 0.07 * amplitude },
      { scaleX: 1 - stretch.get() * 0.025 * amplitude },
    ],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + flicker.get() * 0.45,
    transform: [
      { rotate: `${-sway.get() * 2 * amplitude}deg` },
      { scaleY: 0.9 + flicker.get() * 0.16 * amplitude },
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
