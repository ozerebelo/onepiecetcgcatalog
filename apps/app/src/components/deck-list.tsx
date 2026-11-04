import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { DeckSummary } from '@/lib/api';
import { CARD_COLORS, WIDE_BREAKPOINT, radius, spacing, tabular, usePalette } from '@/theme';

import { CardImage } from './card-image';
import { Badge, ProgressBar } from './ui/panel';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

/**
 * Saved decks as a list: leader, name, one status mark, and how much of the deck the binder holds
 * (right-aligned tabular figures over a thin bar). Phones fold each row into two lines.
 */
export function DeckList({ decks }: { decks: DeckSummary[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const wide = useWindowDimensions().width >= WIDE_BREAKPOINT;

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {wide ? (
        <View style={styles.header}>
          <Text variant="label" tone="secondary" style={styles.identity}>
            {t('decks.columns.deck')}
          </Text>
          <Text variant="label" tone="secondary" style={styles.status}>
            {t('decks.columns.status')}
          </Text>
          <Text variant="label" tone="secondary" style={[styles.owned, styles.right]}>
            {t('decks.columns.owned')}
          </Text>
        </View>
      ) : null}
      {decks.map((deck, i) => {
        const complete = deck.card_count > 0 && deck.owned_count >= deck.card_count;
        const missing = Math.max(0, deck.card_count - deck.owned_count);
        const status = deck.is_built ? (
          <Badge label={t('decks.built')} />
        ) : complete ? (
          <Badge label={t('decks.complete')} tone="success" />
        ) : (
          <Badge label={t('decks.missingCount', { count: missing })} tone="danger" />
        );
        return (
          <Link key={deck.id} href={{ pathname: '/deck/[id]', params: { id: deck.id } }} asChild>
            <PressableArea
              accessibilityRole="link"
              accessibilityLabel={`${deck.name}, ${t('decks.ownedOf', { owned: deck.owned_count, total: deck.card_count })}`}
              boxStyle={[styles.row, i > 0 || wide ? { borderTopWidth: 1, borderTopColor: palette.border } : null]}
              activeStyle={{ backgroundColor: palette.backgroundAlt }}>
              <View style={[styles.identity, styles.identityRow]}>
                <View style={styles.thumb}>
                  <CardImage uri={deck.leader_image_url} label={deck.leader_name ?? deck.name} rounded={radius.xs} />
                </View>
                <View style={styles.flex}>
                  <Text variant="subheading" numberOfLines={1}>
                    {deck.name}
                  </Text>
                  <View style={styles.leader}>
                    {(deck.leader_colors ?? []).map((c) => (
                      <View key={c} style={[styles.dot, { backgroundColor: CARD_COLORS[c] }]} />
                    ))}
                    <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
                      {deck.leader_name ?? t('decks.noLeader')}
                    </Text>
                  </View>
                  {!wide ? <View style={styles.inlineStatus}>{status}</View> : null}
                </View>
              </View>
              {wide ? <View style={styles.status}>{status}</View> : null}
              <View style={[styles.owned, styles.ownedCell]}>
                <Text weight="medium" style={[tabular, styles.right]}>
                  {deck.owned_count}
                  <Text tone="secondary" style={tabular}>{` / ${deck.card_count}`}</Text>
                </Text>
                <View style={styles.bar}>
                  <ProgressBar value={deck.card_count ? deck.owned_count / deck.card_count : 0} tone={complete ? 'accent' : 'neutral'} height={4} />
                </View>
              </View>
            </PressableArea>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 40, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.lg, minHeight: 76 },
  identity: { flex: 1, minWidth: 0 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 38 },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  inlineStatus: { marginTop: spacing.xs },
  status: { width: 130 },
  owned: { width: 120 },
  ownedCell: { gap: 6 },
  bar: { width: '100%' },
  right: { textAlign: 'right' },
  flex: { flex: 1, minWidth: 0 },
});
