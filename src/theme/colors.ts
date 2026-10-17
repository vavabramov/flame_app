export const colors = {
  background: '#0B0B0E',
  surface: '#17171D',
  elevated: '#202027',
  accent: '#FF8737',
  accentMuted: 'rgba(255, 135, 55, 0.14)',
  accentGlow: 'rgba(255, 135, 55, 0.28)',
  textPrimary: '#F5F5F7',
  textSecondary: '#92929F',
  textTertiary: '#5E5E69',
  success: '#42D6A4',
  successMuted: 'rgba(66, 214, 164, 0.14)',
  danger: '#E5675F',
  dangerMuted: 'rgba(229, 103, 95, 0.14)',
  border: '#26262E',
  borderStrong: '#34343D',
  onAccent: '#1A0D04',
} as const;

/** Fixed palette for habit accents; every color keeps ≥ 4.5:1 contrast on the surface color. */
export const HABIT_COLORS = [
  '#FF8737', // ember
  '#FFC24B', // amber
  '#42D6A4', // mint
  '#3CC8E0', // lagoon
  '#7FA4FF', // sky
  '#B19AFF', // lilac
  '#FF85BE', // rose
  '#FF7B72', // coral
] as const;

export const HABIT_ICONS = [
  '🌱', '💧', '📚', '🏃', '🧘', '💪', '🥗', '😴', '✍️', '🎸',
  '🧠', '🚶', '🦷', '💊', '🧹', '📵', '☀️', '🎨', '💻', '🙏',
] as const;

export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0];
export const DEFAULT_HABIT_ICON = HABIT_ICONS[0];

/** `#RRGGBB` → `rgba(r, g, b, alpha)` for tinted backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
