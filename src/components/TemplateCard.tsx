import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, withAlpha } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

type Props = {
  icon: string;
  title: string;
  description: string;
  applied: boolean;
  onToggle: () => void;
};

/** A single "start from a template" card at the top of the new-habit form. */
export function TemplateCard({ icon, title, description, applied, onToggle }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>Start from a template</Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: applied }}
        accessibilityLabel={applied ? `${title} template applied. Double tap to remove it.` : `Use the ${title} template`}
        style={({ pressed }) => [
          styles.card,
          applied && { borderColor: colors.accent, backgroundColor: withAlpha(colors.accent, 0.08) },
          pressed && { opacity: 0.85 },
        ]}>
        <Text style={styles.icon} maxFontSizeMultiplier={1}>
          {icon}
        </Text>
        <View style={styles.text}>
          <Text style={type.headline} maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
          <Text style={type.footnote} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
            {description}
          </Text>
        </View>
        <Text style={[styles.action, applied && { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
          {applied ? 'Remove' : 'Use'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: { fontSize: 26 },
  text: { flex: 1, gap: spacing.xxs },
  action: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
