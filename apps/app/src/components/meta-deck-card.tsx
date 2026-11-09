import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { MetaDeckProgress } from '@/lib/api';
import { formatReleaseDate } from '@/lib/format';
import { radius, spacing, usePalette } from '@/theme';

import { CardImage } from './card-image';
import { ProgressBar } from './ui/panel';
import { PressableArea } from './ui/pressable-area';
import { ColorMark, ringColors, useCardColor } from './ui/tcg';
import { Text } from './ui/text';

/** "3rd of 512" / "Winner" / "Top cut": where the list finished. */
export function usePlacementLabel() {
  const { t } = useTranslation();
  return (placement: number | null, players: number | null) => {
    if (placement == null) return players ? t('meta.players', { count: players }) : null;
    const place = placement === 1 ? t('meta.winner') : t('meta.place', { ordinal: ordinal(placement) });
    return players ? t('meta.placeOf', { place, players }) : place;
  };
}

function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** A meta deck: leader art, archetype, where it placed, and how much of it you own. */
export function MetaDeckCard({ deck, signedIn }: { deck: MetaDeckProgress; signedIn: boolean }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const cardColor = useCardColor();
  const placement = usePlacementLabel();
  const colors = deck.leader_colors ?? [];
  const complete = deck.needed > 0 && deck.missing === 0;
  const date = formatReleaseDate(deck.event_date, i18n.language, 'short');
  const result = placement(deck.placement, deck.players);

  return (
    <Link href={{ pathname: '/meta/[id]', params: { id: deck.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={[
          deck.archetype,
          deck.event,
          result,
          signedIn ? t('meta.ownedOf', { have: deck.have, needed: deck.needed }) : null,
        ]
          .filter(Boolean)
          .join(', ')}
        boxStyle={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        activeStyle={{ borderColor: palette.borderStrong, transform: [{ translateY: -2 }] }}>
        <View style={[styles.art, colors.length ? [styles.frame, ringColors(colors.map(cardColor))] : null]}>
          <CardImage uri={deck.leader_image} label={deck.leader_card_id} rounded={radius.md} />
        </View>
        <View style={styles.body}>
          <Text variant="subheading" numberOfLines={1}>
            {deck.archetype}
          </Text>
          <View style={styles.leaderRow}>
            <ColorMark colors={colors} />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
              {deck.leader_name} · {deck.leader_card_id}
            </Text>
          </View>
          <Text variant="caption" numberOfLines={2}>
            {[result, deck.event, date].filter(Boolean).join(' · ')}
          </Text>
          {signedIn ? (
            <>
              <View style={styles.progressRow}>
                <ProgressBar value={deck.needed ? deck.have / deck.needed : 0} height={6} />
              </View>
              <Text variant="caption" weight="semibold" style={{ color: complete ? palette.text : palette.danger }}>
                {complete ? t('meta.canBuild') : t('meta.missing', { count: deck.missing })}
                <Text variant="caption" tone="secondary">
                  {' '}
                  · {t('meta.ownedOf', { have: deck.have, needed: deck.needed })}
                </Text>
              </Text>
            </>
          ) : null}
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
  frame: { width: 70, padding: 1, borderWidth: 2, borderRadius: radius.md + 2 },
  body: { flex: 1, gap: 3, justifyContent: 'center', minWidth: 0 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressRow: { marginTop: spacing.xs },
  flex: { flex: 1 },
});
