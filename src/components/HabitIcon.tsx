import { StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import { radius } from '@/theme/spacing';

export function HabitIcon({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size > 40 ? radius.md : radius.sm },
        { backgroundColor: withAlpha(color, 0.16) },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <Text style={{ fontSize: size * 0.5 }} maxFontSizeMultiplier={1}>
        {icon}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
