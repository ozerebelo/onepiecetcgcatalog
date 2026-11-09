import { diffDecklists, type DeckItem } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePlacementLabel } from '@/components/meta-deck-card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { fetchMetaListsForLeader } from '@/lib/api';
import { spacing, tabular, usePalette } from '@/theme';

/**
 * On your own deck page: how your list differs from the newest meta list for the same leader.
 * Hidden when there's no meta list for that leader.
 */
export function MetaCompare({ leaderId, rows }: { leaderId: string | null | undefined; rows: (DeckItem & { name: string | null })[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const placement = usePlacementLabel();
  const lists = useQuery({
    queryKey: ['meta', 'leader', leaderId],
    queryFn: () => fetchMetaListsForLeader(leaderId!),
    enabled: Boolean(leaderId),
  });
  const meta = lists.data?.[0];
  if (!meta) return null;

  const diff = diffDecklists(rows, meta.items);
  const names = new Map<string, string>([
    ...meta.items.map((i) => [i.card_id, i.name] as const),
    ...rows.map((r) => [r.card_id, r.name ?? r.card_id] as const),
  ]);
  const total = meta.items.reduce((n, i) => n + i.quantity, 0);
  const result = placement(meta.placement, meta.players);

  return (
    <View style={styles.section}>
      <Text variant="subheading">{t('meta.compareTitle')}</Text>
      <Text variant="caption" tone="secondary">
        {[t('meta.compareFrom', { archetype: meta.archetype, event: meta.event }), result].filter(Boolean).join(' · ')}
      </Text>
      {diff.add.length === 0 && diff.cut.length === 0 ? (
        <Text>{t('meta.compareSame')}</Text>
      ) : (
        <>
          <Text weight="medium">{t('meta.compareShared', { shared: diff.shared, total })}</Text>
          <View style={styles.columns}>
            <DiffColumn title={t('meta.compareAdd')} sign="+" items={diff.add} names={names} color={palette.text} />
            <DiffColumn title={t('meta.compareCut')} sign="−" items={diff.cut} names={names} color={palette.textSecondary} />
          </View>
        </>
      )}
      <Link href={{ pathname: '/meta/[id]', params: { id: meta.id } }} asChild>
        <Button title={t('meta.compareOpen')} variant="outline" size="sm" trailingIcon="arrow-right" boxStyle={styles.open} />
      </Link>
    </View>
  );
}

function DiffColumn({
  title,
  sign,
  items,
  names,
  color,
}: {
  title: string;
  sign: string;
  items: DeckItem[];
  names: Map<string, string>;
  color: string;
}) {
  const palette = usePalette();
  if (items.length === 0) return null;
  return (
    <View style={styles.column}>
      <Text variant="eyebrow" tone="secondary" style={[styles.columnHead, { borderBottomColor: palette.rule }]}>
        {title}
      </Text>
      {items.map((item) => (
        <Link key={item.card_id} href={{ pathname: '/card/[id]', params: { id: item.card_id } }}>
          <View style={styles.line}>
            <Text variant="mono" style={[styles.qty, tabular, { color }]}>
              {sign}
              {item.quantity}
            </Text>
            <Text numberOfLines={1} style={styles.flex}>
              {names.get(item.card_id) ?? item.card_id}
            </Text>
            <Text variant="mono" tone="muted">
              {item.card_id}
            </Text>
          </View>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  column: { flexGrow: 1, flexBasis: 260, minWidth: 0 },
  columnHead: { paddingBottom: spacing.xs, borderBottomWidth: 2, marginBottom: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  qty: { width: 28 },
  flex: { flex: 1, minWidth: 0 },
  open: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
