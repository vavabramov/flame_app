import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { GUTTER, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

type Props = {
  title?: string;
  subtitle?: string;
  /** Rendered on the right of the title row, e.g. an add button. */
  action?: ReactNode;
  children: ReactNode;
};

/**
 * Scrollable tab screen. `contentInsetAdjustmentBehavior="automatic"` lets iOS
 * inset the content for the status bar, notch and native tab bar.
 */
export function Screen({ title, subtitle, action, children }: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {subtitle ? (
              <Text style={type.footnote} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
                {subtitle}
              </Text>
            ) : null}
            <Text style={type.largeTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
              {title}
            </Text>
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  headerText: { flex: 1, gap: spacing.xxs },
});
