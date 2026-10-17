import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

type Props = { label: string; value: string; detail?: string; accent?: string };

export function StatTile({ label, value, detail, accent }: Props) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}>
      <Text style={type.caption} maxFontSizeMultiplier={1.4} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[type.stat, accent ? { color: accent } : null]} maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
      {detail ? (
        <Text style={type.footnote} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '45%',
    gap: spacing.xs,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
