import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, DISPLAY_MAX_FONT_SCALE, type } from '@/theme/typography';

import { Icon } from './Icon';

type Props = {
  /** Longest current streak among active habits, or null when none is running. */
  leader: { streak: number; name: string; icon: string } | null;
  completedToday: number;
  scheduledToday: number;
};

export function StreakHero({ leader, completedToday, scheduledToday }: Props) {
  const lit = leader !== null && leader.streak > 0;
  const allDone = scheduledToday > 0 && completedToday === scheduledToday;
  const progress = scheduledToday === 0 ? 0 : completedToday / scheduledToday;

  let progressLabel: string;
  if (scheduledToday === 0) progressLabel = 'Nothing scheduled today. Enjoy the rest.';
  else if (allDone) progressLabel = `All ${scheduledToday} done today. Nicely kept.`;
  else progressLabel = `${completedToday} of ${scheduledToday} completed`;

  return (
    <View style={[styles.hero, lit && styles.heroLit]}>
      <View style={styles.top}>
        <View style={[styles.flame, lit ? styles.flameLit : styles.flameIdle]}>
          <Icon name="flame.fill" size={34} color={lit ? colors.accent : colors.textSecondary} fallback="🔥" />
        </View>

        {lit ? (
          <View
            style={styles.streakText}
            accessible
            accessibilityLabel={`Longest active streak: ${leader.streak} in a row, ${leader.name}`}>
            <Text style={type.display} maxFontSizeMultiplier={DISPLAY_MAX_FONT_SCALE}>
              {leader.streak}
            </Text>
            <Text style={type.callout} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE} numberOfLines={2}>
              in a row · {leader.icon} {leader.name}
            </Text>
          </View>
        ) : (
          <View style={styles.streakText}>
            <Text style={type.title} maxFontSizeMultiplier={1.4}>
              Your consistency starts today
            </Text>
            <Text style={type.callout} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
              Check in once and your first streak is lit.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.progressBlock}>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Today's progress"
          accessibilityValue={{ min: 0, max: scheduledToday, now: completedToday, text: progressLabel }}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: allDone ? colors.success : colors.accent },
            ]}
          />
        </View>
        <Text
          style={[type.footnote, allDone && { color: colors.success }]}
          maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
          {progressLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  heroLit: {
    borderColor: 'rgba(255, 135, 55, 0.35)',
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flame: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  flameLit: { backgroundColor: colors.accentMuted },
  flameIdle: { backgroundColor: colors.elevated },
  streakText: { flex: 1, gap: spacing.xxs },
  progressBlock: { gap: spacing.sm },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.elevated, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
