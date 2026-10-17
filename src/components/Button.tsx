import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing, TOUCH_TARGET } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE } from '@/theme/typography';

import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  iconFallback?: string;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
  secondary: { bg: colors.elevated, fg: colors.textPrimary, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  destructive: { bg: colors.dangerMuted, fg: colors.danger, border: 'transparent' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconFallback,
  disabled = false,
  loading = false,
  compact = false,
  style,
  accessibilityHint,
}: Props) {
  const { bg, fg, border } = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={compact ? 8 : 0}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: bg, borderColor: border, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 },
        pressed && !inactive && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={compact ? 15 : 17} color={fg} fallback={iconFallback} /> : null}
          <Text
            maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
            style={[styles.label, compact && styles.labelCompact, { color: fg }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: { minHeight: 52, paddingHorizontal: spacing.xl },
  compact: { minHeight: TOUCH_TARGET - 8, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  pressed: { transform: [{ scale: 0.98 }] },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 17, fontWeight: '600' },
  labelCompact: { fontSize: 15 },
});
