import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text } from 'react-native';

export type IconName = Extract<SymbolViewProps['name'], string>;

type Props = {
  name: IconName;
  size?: number;
  color: string;
  /** Plain-text glyph for platforms without SF Symbols (web, Android). */
  fallback?: string;
  weight?: SymbolViewProps['weight'];
};

/** SF Symbol on iOS with a text fallback elsewhere. Decorative: hidden from screen readers. */
export function Icon({ name, size = 20, color, fallback = '•', weight = 'semibold' }: Props) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no"
      fallback={
        <Text style={{ color, fontSize: size * 0.8, lineHeight: size, textAlign: 'center', width: size }}>
          {fallback}
        </Text>
      }
    />
  );
}
