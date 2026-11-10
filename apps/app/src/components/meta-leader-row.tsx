import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { LeaderMeta } from '@/hooks/use-meta';
import type { MetaCardInfo } from '@/lib/api';
import { radius, spacing, tabular, usePalette } from '@/theme';

import { CardImage } from './card-image';
import { usePlacementLabel } from './meta-placement';
import { ProgressBar } from './ui/panel';
import { PressableArea } from './ui/pressable-area';
import { ColorMark, ringColors, useCardColor } from './ui/tcg';
import { Text } from './ui/text';

/**
 * One leader in the meta ranking: its rank, art, how much of the meta it holds, its results and how much
 * of its consensus list you own.
 */
export function MetaLeaderRow({
  rank,
  leader,
  info,
  maxShare,
  signedIn,
  hideRank = false,
}: {
  rank: number;
  leader: LeaderMeta;
  info: MetaCardInfo | undefined;
  maxShare: number;
  signedIn: boolean;
  /** Leave the rank number out (lists that aren't in rank order, e.g. Home's "closest to"). */
  hideRank?: boolean;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const cardColor = useCardColor();
  const placement = usePlacementLabel();
  const colors = info?.colors ?? [];
  const name = info?.name ?? leader.leader;
  const share = Math.round(leader.share * 100);
  const best = leader.best ? placement(leader.best, null) : null;
  const ready = leader.missing === 0;

  return (
    <Link href={{ pathname: '/meta/leader/[id]', params: { id: leader.leader } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={[
          hideRank ? name : `${rank}. ${name}`,
          t('meta.leaderLists', { count: leader.lists.length, share }),
          leader.wins ? t('meta.wins', { count: leader.wins }) : null,
          signedIn ? t('meta.ownedOf', { have: leader.have, needed: leader.needed }) : null,
        ]
          .filter(Boolean)
          .join(', ')}
        boxStyle={[styles.row, { borderBottomColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.primarySoft }}>
{hideRank ? null : (
                  <Text variant="mono" weight="semibold" style={[styles.rank, tabular, { color: palette.textSecondary }]}>
          {rank}
        </Text>
        )}
        <View style={[styles.art, colors.length ? [styles.frame, ringColors(colors.map(cardColor))] : null]}>
          <CardImage uri={info?.image_url} label={leader.leader} rounded={radius.sm} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <ColorMark colors={colors} />
            <Text weight="semibold" numberOfLines={1} style={styles.flex}>
              {name}
            </Text>
          </View>
          <View style={styles.shareRow}>
            <View style={styles.flex}>
              <ProgressBar value={maxShare ? leader.share / maxShare : 0} height={6} />
            </View>
            <Text variant="caption" weight="semibold" style={[styles.share, tabular]}>
              {share}%
            </Text>
          </View>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {[leader.leader, t('meta.lists', { count: leader.lists.length }), leader.wins ? t('meta.wins', { count: leader.wins }) : best ? t('meta.best', { place: best }) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {signedIn ? (
          <View style={styles.own}>
            <Text variant="mono" weight="semibold" style={{ color: ready ? palette.text : palette.danger }}>
              {ready ? t('meta.ready') : t('meta.missing', { count: leader.missing })}
            </Text>
            <Text variant="caption" tone="secondary" style={tabular}>
              {leader.have}/{leader.needed}
            </Text>
          </View>
        ) : null}
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 24, textAlign: 'right', fontSize: 16 },
  art: { width: 44 },
  frame: { width: 50, padding: 1, borderWidth: 2, borderRadius: radius.sm + 2 },
  body: { flex: 1, gap: 4, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  share: { width: 40, textAlign: 'right' },
  own: { width: 78, alignItems: 'flex-end', gap: 2 },
  flex: { flex: 1, minWidth: 0 },
});
