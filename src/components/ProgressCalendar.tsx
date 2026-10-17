import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type CalendarCell, buildMonthGrid } from '@/features/streaks/calendar';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LETTER } from '@/features/habits/habit.validation';
import { type LocalDate, type YearMonth, localDateToDate } from '@/lib/dates';
import { colors, withAlpha } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

import { Icon } from './Icon';

type Props = {
  month: YearMonth;
  today: LocalDate;
  scheduleDays: readonly number[];
  startDate: LocalDate;
  completed: ReadonlySet<LocalDate>;
  color: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onChangeMonth: (delta: -1 | 1) => void;
};

const STATE_LABEL: Record<CalendarCell['state'], string> = {
  completed: 'completed',
  missed: 'not completed',
  today: 'today, open',
  upcoming: 'scheduled',
  off: 'not scheduled',
};

export function ProgressCalendar({
  month,
  today,
  scheduleDays,
  startDate,
  completed,
  color,
  canGoBack,
  canGoForward,
  onChangeMonth,
}: Props) {
  const weeks = buildMonthGrid(month, today, scheduleDays, startDate, completed);
  const title = new Date(month.year, month.month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MonthArrow direction={-1} enabled={canGoBack} onPress={() => onChangeMonth(-1)} />
        <Text style={type.headline} accessibilityRole="header">
          {title}
        </Text>
        <MonthArrow direction={1} enabled={canGoForward} onPress={() => onChangeMonth(1)} />
      </View>

      <View style={styles.row}>
        {WEEKDAY_DISPLAY_ORDER.map((d) => (
          <Text key={d} style={[type.caption, styles.weekday]} maxFontSizeMultiplier={1.2}>
            {WEEKDAY_LETTER[d]}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((cell, i) => (
            <View key={cell?.date ?? `pad-${w}-${i}`} style={styles.cellSlot}>
              {cell ? <DayCell cell={cell} color={color} /> : null}
            </View>
          ))}
        </View>
      ))}

      <View style={styles.legend}>
        <LegendItem swatch={<View style={[styles.legendDot, { backgroundColor: color }]} />} label="Done" />
        <LegendItem swatch={<View style={[styles.legendDot, styles.legendMissed]} />} label="Missed" />
        <LegendItem swatch={<View style={[styles.legendDot, styles.legendToday]} />} label="Today" />
      </View>
    </View>
  );
}

function DayCell({ cell, color }: { cell: CalendarCell; color: string }) {
  const label = `${localDateToDate(cell.date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })}, ${STATE_LABEL[cell.state]}`;

  const circle = [
    styles.day,
    cell.state === 'completed' && { backgroundColor: color },
    cell.state === 'missed' && styles.dayMissed,
    cell.isToday && cell.state !== 'completed' && styles.dayToday,
    cell.isToday && cell.state === 'completed' && { borderColor: colors.textPrimary, borderWidth: 2 },
  ];
  const textColor =
    cell.state === 'completed'
      ? colors.onAccent
      : cell.state === 'off'
        ? colors.textTertiary
        : cell.state === 'upcoming'
          ? colors.textSecondary
          : colors.textPrimary;

  return (
    <View style={circle} accessible accessibilityLabel={label}>
      <Text
        style={[styles.dayText, { color: textColor }, cell.state === 'completed' && styles.dayTextStrong]}
        maxFontSizeMultiplier={1.2}>
        {cell.day}
      </Text>
    </View>
  );
}

function MonthArrow({ direction, enabled, onPress }: { direction: -1 | 1; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={8}
      style={({ pressed }) => [styles.arrow, { opacity: !enabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Icon
        name={direction < 0 ? 'chevron.left' : 'chevron.right'}
        size={16}
        color={colors.textPrimary}
        fallback={direction < 0 ? '‹' : '›'}
      />
    </Pressable>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <View style={styles.legendItem}>
      {swatch}
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cellSlot: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 3 },
  day: {
    width: '100%',
    height: '100%',
    maxWidth: 40,
    maxHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMissed: { backgroundColor: withAlpha(colors.textSecondary, 0.1) },
  dayToday: { borderWidth: 2, borderColor: colors.accent },
  dayText: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  dayTextStrong: { fontWeight: '700' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendMissed: { backgroundColor: withAlpha(colors.textSecondary, 0.25) },
  legendToday: { borderWidth: 2, borderColor: colors.accent },
});
