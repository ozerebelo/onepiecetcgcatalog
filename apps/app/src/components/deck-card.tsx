import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { DeckSummary } from '@/lib/api';
import { CARD_COLORS, radius, spacing, usePalette } from '@/theme';

import { CardImage } from './card-image';
import { Badge, ProgressBar } from './ui/panel';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

/** A saved deck: leader art, name, colors and how much of it the user owns. */
export function DeckCard({ deck }: { deck: DeckSummary }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const pct = deck.card_count ? deck.owned_count / deck.card_count : 0;
  const complete = deck.card_count > 0 && deck.owned_count >= deck.card_count;

  return (
    <Link href={{ pathname: '/deck/[id]', params: { id: deck.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${deck.name}, ${t('decks.ownedOf', { owned: deck.owned_count, total: deck.card_count })}`}
        boxStyle={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, boxShadow: palette.shadow }]}
        activeStyle={{ borderColor: palette.borderStrong, transform: [{ translateY: -2 }] }}>
        <View style={styles.art}>
          <CardImage uri={deck.leader_image_url} label={deck.leader_name ?? deck.name} rounded={radius.md} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="subheading" numberOfLines={1} style={styles.flex}>
              {deck.name}
            </Text>
            {deck.is_built ? <Badge label={t('decks.built')} icon="package" /> : null}
          </View>
          <View style={styles.leaderRow}>
            {(deck.leader_colors ?? []).map((c) => (
              <View key={c} style={[styles.dot, { backgroundColor: CARD_COLORS[c] }]} />
            ))}
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
              {deck.leader_name ?? t('decks.noLeader')}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <ProgressBar value={pct} tone={complete ? 'success' : 'primary'} height={6} />
          </View>
          <Text variant="caption" tone={complete ? 'success' : 'secondary'} weight="medium">
            {complete ? t('decks.complete') : t('decks.ownedOf', { owned: deck.owned_count, total: deck.card_count })}
          </Text>
        </View>
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    flexBasis: 300,
  },
  art: { width: 64 },
  body: { flex: 1, gap: spacing.xs, justifyContent: 'center', minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  progressRow: { marginTop: spacing.xs },
  flex: { flex: 1 },
});
