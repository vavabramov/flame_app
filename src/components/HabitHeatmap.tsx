/**
 * Presentational activity grid: weeks as columns, Monday → Sunday as rows.
 * Receives prepared cells (see build-habit-heatmap.ts) and reports taps.
 * Statuses differ by shape as well as color, so color isn't the only cue.
 */
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { type HabitDayStatus } from '@/features/streaks/calendar';
import { type HabitDayCell, type HabitHeatmap as HeatmapData } from '@/features/progress/build-habit-heatmap';
import { colors, withAlpha } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

export const CELL = 14;
const GAP = 3;
const PITCH = CELL + GAP;
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export const LAPSE_COLOR = '#C27A8C';

/** Visual treatment per status. Shared with the legend. */
export function cellStyle(status: HabitDayStatus, color: string): ViewStyle {
  switch (status) {
    case 'completed':
      return { backgroundColor: color };
    case 'lapse':
      return { borderWidth: 2.5, borderColor: LAPSE_COLOR, backgroundColor: withAlpha(LAPSE_COLOR, 0.15) };
    case 'missed':
      return { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface };
    case 'open':
      return { borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' };
    case 'unscheduled':
      return { backgroundColor: colors.elevated, transform: [{ scale: 0.55 }] };
    case 'not-started':
      return { backgroundColor: colors.elevated, opacity: 0.35, transform: [{ scale: 0.55 }] };
    case 'future':
      return { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border };
  }
}

type Props = {
  heatmap: HeatmapData;
  color: string;
  selectedDate: string | null;
  onSelect: (cell: HabitDayCell) => void;
};

export function HabitHeatmap({ heatmap, color, selectedDate, onSelect }: Props) {
  const scroller = useRef<ScrollView>(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.weekdays} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.monthSpacer} />
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={[styles.weekdayText, { height: PITCH }]} maxFontSizeMultiplier={1.1}>
            {label}
          </Text>
        ))}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Open on the most recent weeks.
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.gridContent}>
        <View>
          <View style={styles.months} importantForAccessibility="no-hide-descendants">
            {heatmap.monthLabels.map((m) => (
              <Text key={`${m.column}-${m.label}`} style={[styles.monthText, { left: m.column * PITCH }]} maxFontSizeMultiplier={1.1}>
                {m.label}
              </Text>
            ))}
          </View>
          <View style={styles.columns}>
            {heatmap.columns.map((column) => (
              <View key={column[0].dateKey} style={styles.column}>
                {column.map((cell) => {
                  const selected = cell.dateKey === selectedDate;
                  return (
                    <Pressable
                      key={cell.dateKey}
                      onPress={() => onSelect(cell)}
                      accessibilityRole="button"
                      accessibilityLabel={cell.accessibleLabel}
                      accessibilityState={{ selected }}
                      hitSlop={1}
                      style={styles.slot}>
                      <View
                        style={[
                          styles.cell,
                          cellStyle(cell.status, color),
                          selected && styles.selected,
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const LEGEND: { status: HabitDayStatus; label: (successLabel: string) => string }[] = [
  { status: 'completed', label: (s) => s },
  { status: 'missed', label: () => 'No check-in' },
  { status: 'lapse', label: () => 'Lapse' },
  { status: 'unscheduled', label: () => 'Not scheduled' },
  { status: 'future', label: () => 'Upcoming' },
];

export function HeatmapLegend({
  color,
  successLabel,
  showLapses,
}: {
  color: string;
  successLabel: string;
  showLapses: boolean;
}) {
  return (
    <View style={styles.legend}>
      {LEGEND.filter((item) => showLapses || item.status !== 'lapse').map((item) => (
        <View key={item.status} style={styles.legendItem}>
          <View style={[styles.cell, cellStyle(item.status, color)]} />
          <Text style={type.footnote}>{item.label(successLabel)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row' },
  weekdays: { marginRight: spacing.xs },
  monthSpacer: { height: 18 },
  weekdayText: { fontSize: 10, lineHeight: PITCH, color: colors.textSecondary, width: 26 },
  gridContent: { paddingRight: spacing.xs },
  months: { height: 18, position: 'relative' },
  monthText: { position: 'absolute', top: 0, fontSize: 11, color: colors.textSecondary },
  columns: { flexDirection: 'row' },
  column: { width: PITCH },
  slot: { width: PITCH, height: PITCH, alignItems: 'center', justifyContent: 'center' },
  cell: { width: CELL, height: CELL, borderRadius: 3.5 },
  // Full size when selected, even for the smaller unscheduled cells.
  selected: { borderWidth: 2, borderColor: colors.textPrimary, opacity: 1, transform: [{ scale: 1 }] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
