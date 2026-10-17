import { StyleSheet } from 'react-native';

import { colors } from './colors';

export const type = StyleSheet.create({
  display: {
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '800',
    letterSpacing: -2,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6, color: colors.textPrimary },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3, color: colors.textPrimary },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', color: colors.textPrimary },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400', color: colors.textSecondary },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.textSecondary },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  stat: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});

/** Cap growth of very large numerals so Dynamic Type can't break the layout. */
export const DISPLAY_MAX_FONT_SCALE = 1.2;
export const BODY_MAX_FONT_SCALE = 1.8;
