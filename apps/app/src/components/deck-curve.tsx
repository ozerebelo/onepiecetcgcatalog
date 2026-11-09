import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { CheckRow } from '@/lib/api';
import { fonts, spacing, tabular, usePalette } from '@/theme';

const MAX_COST = 10;
const BAR_HEIGHT = 72;

/**
 * The deck's cost curve, as a player reads it: cards at each cost from 0 to 10 (the leader has none).
 * Each bar is split in the app's own marks: highlighter for the copies you own, red pen for the
 * copies still missing. Tap or hover a bar for its numbers; the decklist below is the full table.
 */
export function CostCurve({ rows, counters }: { rows: CheckRow[]; counters?: Record<string, number | null> }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const [active, setActive] = useState<number | null>(null);

  const costs = Array.from({ length: MAX_COST + 1 }, (_, cost) => {
    const at = rows.filter((r) => r.category !== 'Leader' && r.cost != null && Math.min(r.cost, MAX_COST) === cost);
    return {
      cost,
      total: at.reduce((n, r) => n + r.needed, 0),
      owned: at.reduce((n, r) => n + Math.min(r.have, r.needed), 0),
      missing: at.reduce((n, r) => n + r.missing, 0),
    };
  });
  const peak = Math.max(1, ...costs.map((c) => c.total));
  const shown = active == null ? null : costs[active];

  // Counter values across the deck (+2000, +1000, none): the other number players count.
  const counterLine = counters
    ? (() => {
        const tally = new Map<number, number>();
        for (const r of rows) {
          if (r.category !== 'Character') continue;
          const value = counters[r.card_id] ?? 0;
          tally.set(value, (tally.get(value) ?? 0) + r.needed);
        }
        return [...tally.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([value, count]) => (value > 0 ? t('decks.curve.counter', { value, count }) : t('decks.curve.noCounter', { count })))
          .join(' · ');
      })()
    : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="subheading" style={styles.flex}>
          {t('decks.curve.title')}
        </Text>
        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.key, { backgroundColor: palette.highlight, borderColor: palette.text }]} />
          <Text variant="caption" tone="secondary">
            {t('decks.curve.owned')}
          </Text>
          <View style={[styles.key, { backgroundColor: palette.dangerSoft, borderColor: palette.danger }]} />
          <Text variant="caption" tone="secondary">
            {t('decks.curve.missing')}
          </Text>
        </View>
      </View>

      <View style={[styles.plot, { borderBottomColor: palette.rule }]}>
        {costs.map((c) => {
          const height = (c.total / peak) * BAR_HEIGHT;
          const ownedH = c.total ? (c.owned / c.total) * height : 0;
          const missingH = height - ownedH;
          const isActive = active === c.cost;
          return (
            <Pressable
              key={c.cost}
              accessibilityRole="button"
              accessibilityLabel={t('decks.curve.bar', { cost: c.cost, total: c.total, missing: c.missing })}
              onPress={() => setActive(isActive ? null : c.cost)}
              onHoverIn={() => setActive(c.cost)}
              onHoverOut={() => setActive(null)}
              style={[styles.column, isActive && { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.count, tabular, { color: c.total ? palette.text : palette.textMuted }]}>{c.total || ''}</Text>
              <View style={styles.bar}>
                {missingH > 0 ? (
                  <View
                    style={[
                      styles.segment,
                      styles.top,
                      { height: Math.max(missingH, 3), backgroundColor: palette.dangerSoft, borderColor: palette.danger },
                    ]}
                  />
                ) : null}
                {ownedH > 0 ? (
                  <View
                    style={[
                      styles.segment,
                      missingH > 0 ? styles.gap : styles.top,
                      { height: Math.max(ownedH, 3), backgroundColor: palette.highlight, borderColor: palette.text },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {costs.map((c) => (
          <Text key={c.cost} style={[styles.tick, tabular, { color: palette.textSecondary }]}>
            {c.cost === MAX_COST ? `${c.cost}+` : c.cost}
          </Text>
        ))}
      </View>

      <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
        {shown
          ? t('decks.curve.detail', { cost: shown.cost, total: shown.total, owned: shown.owned, missing: shown.missing })
          : counterLine}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  key: { width: 10, height: 10, borderWidth: 1, borderRadius: 2, marginLeft: spacing.sm },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 2, gap: 2 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: spacing.xs, borderRadius: 3, minHeight: BAR_HEIGHT + 22 },
  count: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 14, marginBottom: 2 },
  bar: { width: '62%', maxWidth: 28, justifyContent: 'flex-end' },
  segment: { width: '100%', borderWidth: 1 },
  top: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  gap: { marginTop: 2 },
  axis: { flexDirection: 'row', gap: 2 },
  tick: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, lineHeight: 14 },
});
