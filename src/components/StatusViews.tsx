import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { GUTTER, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

import { Button } from './Button';
import { Icon } from './Icon';

export function LoadingView() {
  return (
    <View style={styles.fill} accessibilityLabel="Loading your habits">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.fill}>
      <Icon name="exclamationmark.triangle.fill" size={32} color={colors.danger} fallback="!" />
      <Text style={[type.title, styles.center]}>We couldn&apos;t open your data</Text>
      <Text style={[type.callout, styles.center]}>
        Your habits are stored on this device and haven&apos;t been changed. Try again, and if it keeps
        happening, restart the app.
      </Text>
      <Text style={[type.footnote, styles.center]} selectable>
        {message}
      </Text>
      <Button label="Try again" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: GUTTER,
    backgroundColor: colors.background,
  },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.md },
});
