import { StyleSheet, Text, View } from 'react-native';

import { type ReadingSummary } from '@/features/reading/reading-summary';
import { localDateToDate } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { BODY_MAX_FONT_SCALE, type } from '@/theme/typography';

import { Card } from './Card';

const pagesText = (pages: number | null) => (pages === null ? '—' : String(pages));

/** Read More totals and recent entries. Shows an empty state rather than zeros when nothing is logged. */
export function ReadingSummaryCard({ summary, target }: { summary: ReadingSummary; target: number | null }) {
  return (
    <Card style={styles.card}>
      <Text style={type.caption} accessibilityRole="header">
        Reading
      </Text>

      {!summary.hasData ? (
        <View style={styles.gapSm}>
          <Text style={type.headline}>No reading logged yet</Text>
          <Text style={type.callout}>
            Tap “Log reading” on Today to record minutes{target !== null ? ` toward your ${target}-minute target` : ''}.
            Pages are optional.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.totals}>
            <Total label="Last 30 days" minutes={summary.last30.minutes} pages={summary.last30.pages} days={summary.last30.daysLogged} />
            <Total label="All time" minutes={summary.allTime.minutes} pages={summary.allTime.pages} days={summary.allTime.daysLogged} />
          </View>

          <View style={styles.gapSm}>
            <Text style={type.caption}>Recent</Text>
            {summary.recent.map((r) => (
              <View
                key={r.localDate}
                style={styles.row}
                accessible
                accessibilityLabel={`${formatDate(r.localDate)}: ${r.minutes} minutes${r.pages !== null ? `, ${r.pages} pages` : ''}`}>
                <Text style={type.callout}>{formatDate(r.localDate)}</Text>
                <Text style={[type.body, styles.value]}>
                  {r.minutes} min{r.pages !== null ? ` · ${r.pages} p` : ''}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

function Total({ label, minutes, pages, days }: { label: string; minutes: number; pages: number | null; days: number }) {
  return (
    <View
      style={styles.total}
      accessible
      accessibilityLabel={`${label}: ${minutes} minutes, ${pages === null ? 'no pages recorded' : `${pages} pages`}, ${days} days logged`}>
      <Text style={type.footnote}>{label}</Text>
      <Text style={type.stat} maxFontSizeMultiplier={1.4}>
        {minutes}
        <Text style={type.footnote}> min</Text>
      </Text>
      <Text style={type.footnote} maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}>
        {pagesText(pages)} pages · {days} {days === 1 ? 'day' : 'days'}
      </Text>
    </View>
  );
}

const formatDate = (date: string) =>
  localDateToDate(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  gapSm: { gap: spacing.xs },
  totals: { flexDirection: 'row', gap: spacing.md },
  total: { flex: 1, gap: spacing.xxs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.elevated },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', minHeight: 28 },
  value: { fontVariant: ['tabular-nums'] },
});
