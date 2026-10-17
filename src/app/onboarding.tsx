import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { useHabitStore } from '@/features/habits/habit-store';
import { colors } from '@/theme/colors';
import { GUTTER, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

const POINTS: { icon: IconName; fallback: string; title: string; body: string }[] = [
  {
    icon: 'checkmark.circle.fill',
    fallback: '✓',
    title: 'Build or break, one tap a day',
    body: 'Read 10 pages, or skip late-night scrolling. Check in when you’ve made it.',
  },
  { icon: 'flame.fill', fallback: '🔥', title: 'Watch your streak grow', body: 'Only the days you schedule count, so rest days never break it.' },
  { icon: 'arrow.counterclockwise', fallback: '↺', title: 'Missed a day? Start again', body: 'Your history and best streak are always kept.' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { updateSettings } = useHabitStore();
  const [saving, setSaving] = useState(false);

  const start = async () => {
    setSaving(true);
    try {
      // The root layout's guard switches to the tabs once this is saved.
      await updateSettings({ onboardingCompleted: true });
    } catch (error) {
      setSaving(false);
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.hero}>
        <View style={styles.flame}>
          <Icon name="flame.fill" size={56} color={colors.accent} fallback="🔥" />
        </View>
        <Text style={[type.caption, styles.brand]}>FLAME</Text>
        <Text style={[type.largeTitle, styles.center]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          Build habits one day at a time
        </Text>
      </View>

      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.title} style={styles.point}>
            <View style={styles.pointIcon}>
              <Icon name={point.icon} size={20} color={colors.accent} fallback={point.fallback} />
            </View>
            <View style={styles.pointText}>
              <Text style={type.headline} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
                {point.title}
              </Text>
              <Text style={type.callout} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
                {point.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Button label="Get started" onPress={start} loading={saving} />
        <Text style={[type.footnote, styles.center]}>No account needed. Your data stays on this iPhone.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: GUTTER, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: spacing.md },
  flame: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: spacing.sm,
  },
  brand: { color: colors.accent, letterSpacing: 4 },
  center: { textAlign: 'center' },
  points: { gap: spacing.xl },
  point: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, gap: spacing.xxs },
  footer: { gap: spacing.md },
});
