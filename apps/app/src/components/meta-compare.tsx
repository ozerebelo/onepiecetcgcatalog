import { diffDecklists, type DeckItem } from '@binder/core';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useMeta } from '@/hooks/use-meta';
import { spacing, tabular, usePalette } from '@/theme';

/**
 * On your own deck page: how your list differs from the meta consensus for the same leader.
 * Hidden when that leader has no meta lists.
 */
export function MetaCompare({ leaderId, rows }: { leaderId: string | null | undefined; rows: (DeckItem & { name: string | null })[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const meta = useMeta();
  const leader = meta.leaders.find((l) => l.leader === leaderId);
  if (!leader) return null;

  const diff = diffDecklists(rows, leader.consensus);
  const names = new Map<string, string>(rows.map((r) => [r.card_id, r.name ?? r.card_id]));
  const name = (id: string) => meta.cards.data?.[id]?.name ?? names.get(id) ?? id;
  const total = leader.consensus.reduce((n, i) => n + i.quantity, 0);

  return (
    <View style={styles.section}>
      <Text variant="subheading">{t('meta.compareTitle')}</Text>
      <Text variant="caption" tone="secondary">
        {t('meta.compareFrom', { count: leader.lists.length })}
      </Text>
      {diff.add.length === 0 && diff.cut.length === 0 ? (
        <Text>{t('meta.compareSame')}</Text>
      ) : (
        <>
          <Text weight="medium">{t('meta.compareShared', { shared: diff.shared, total })}</Text>
          <View style={styles.columns}>
            <DiffColumn title={t('meta.compareAdd')} sign="+" items={diff.add} name={name} color={palette.text} />
            <DiffColumn title={t('meta.compareCut')} sign="−" items={diff.cut} name={name} color={palette.textSecondary} />
          </View>
        </>
      )}
      <Link href={{ pathname: '/meta/leader/[id]', params: { id: leader.leader } }} asChild>
        <Button title={t('meta.compareOpen')} variant="outline" size="sm" trailingIcon="arrow-right" boxStyle={styles.open} />
      </Link>
    </View>
  );
}

function DiffColumn({ title, sign, items, name, color }: { title: string; sign: string; items: DeckItem[]; name: (id: string) => string; color: string }) {
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
              {name(item.card_id)}
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
