import { BANLIST, legality, STANDARD, type Language } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { CostBadge } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { useOwnedByCard } from '@/hooks/use-collection';
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from '@/hooks/use-wishlist';
import { fetchDecksUsingCard, fetchSameNameCards, type CardDetail } from '@/lib/api';
import { formatReleaseDate } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { CARD_ASPECT_RATIO, radius, spacing, usePalette } from '@/theme';

/**
 * Where the card can be played, from its block icon: Standard (current block window) or Extra only.
 * Banned cards (and cards banned together with another) say so, whatever their block.
 */
export function LegalityBadge({ block, cardId }: { block: number | null; cardId: string }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const banned = BANLIST.banned.includes(cardId);
  const partners = BANLIST.pairs.flatMap(([a, b]) => (a === cardId ? [b] : b === cardId ? [a] : []));
  const status = legality(block);
  if (status === 'unknown' && !banned) return null;
  const until = formatReleaseDate(STANDARD.until, i18n.language, 'long');
  const asOf = formatReleaseDate(BANLIST.asOf, i18n.language, 'long');
  const color = banned ? palette.danger : status === 'standard' ? palette.text : palette.textSecondary;
  return (
    <View style={styles.legalityWrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[
          styles.legality,
          banned
            ? { borderColor: palette.danger }
            : status === 'standard'
              ? { borderColor: palette.text }
              : { borderColor: palette.borderStrong, borderStyle: 'dashed' },
        ]}>
        <Text variant="caption" weight="semibold" style={{ color }}>
          {status === 'unknown' ? '' : `${t('legality.block', { block })} · `}
          {banned ? t('legality.banned') : status === 'standard' ? t('legality.standard') : t('legality.extraOnly')}
        </Text>
      </Pressable>
      {open ? (
        <Text variant="caption" tone="secondary" style={styles.legalityNote}>
          {banned
            ? t('legality.bannedNote', { date: asOf })
            : status === 'standard'
              ? t('legality.standardNote', { blocks: STANDARD.blocks.join(', '), until })
              : t('legality.extraNote', { blocks: STANDARD.blocks.join(', ') })}
          {partners.length > 0 ? ` ${t('legality.pairNote', { cards: partners.join(', '), date: asOf })}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

/** The card image; tap to see it full size. */
export function ZoomableCardImage({ uri, label }: { uri: string; label: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  // As large as the window allows, at the card's own proportions.
  const zoomWidth = Math.min(width - spacing.lg * 2, (height - 96) * CARD_ASPECT_RATIO, 640);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('card.zoom', { card: label })} style={styles.zoomable}>
        <CardImage uri={uri} label={label} priority="high" />
        <View style={[styles.zoomHint, { backgroundColor: palette.overlay }]} pointerEvents="none">
          <Icon name="maximize-2" size={14} color="#fff" />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.zoomBackdrop, { backgroundColor: palette.overlay }]} onPress={() => setOpen(false)} accessibilityLabel={t('common.close')}>
          <Image source={{ uri }} style={{ width: zoomWidth, aspectRatio: CARD_ASPECT_RATIO, borderRadius: radius.lg }} contentFit="contain" accessibilityLabel={label} />
          <Text variant="caption" style={styles.zoomClose}>
            {t('card.zoomClose')}
          </Text>
        </Pressable>
      </Modal>
    </>
  );
}

/** "Also named Yamato": the other cards with this name, in the app's card language. */
export function SameNameCards({ card, language }: { card: CardDetail; language: Language }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const byCard = useOwnedByCard();
  const related = useQuery({
    queryKey: ['same-name', card.id],
    queryFn: () => fetchSameNameCards(card),
    staleTime: 60 * 60 * 1000,
  });
  const cards = (related.data ?? [])
    .map((c) => {
      // Its base art in this language, else any art in it.
      const printing =
        c.printings.find((p) => p.language === language && p.variant === 'base') ?? c.printings.find((p) => p.language === language);
      return printing ? { ...c, image: printing.image_url } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (cards.length === 0) return null;

  return (
    <View style={[styles.block, { borderTopColor: palette.rule }]}>
      <Text variant="heading">{t('card.alsoNamed', { name: card.name, count: cards.length })}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {cards.map((c) => (
          <Link key={c.id} href={{ pathname: '/card/[id]', params: { id: c.id } }} asChild>
            <PressableArea accessibilityRole="link" accessibilityLabel={`${c.name}, ${c.id}`} boxStyle={styles.mini}>
              <CardImage uri={c.image} label={c.id} rounded={radius.sm} />
              <View style={styles.miniMeta}>
                <CostBadge colors={c.colors} value={c.cost} life={c.category === 'Leader'} size="sm" />
                <Text variant="mono" numberOfLines={1} style={styles.flex}>
                  {c.id}
                </Text>
              </View>
              {user ? <Pips owned={byCard[c.id] ?? 0} size="sm" /> : null}
            </PressableArea>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

/** Which of your decks use this card, and whether your copies (in this language) cover each one. */
export function InYourDecks({ cardId, owned }: { cardId: string; owned: number }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const decks = useQuery({
    queryKey: ['decks', user?.id ?? 'anon', 'using', cardId],
    queryFn: () => fetchDecksUsingCard(cardId),
    enabled: Boolean(user),
  });
  if (!user || !decks.data || decks.data.length === 0) return null;
  const most = Math.max(...decks.data.map((d) => d.quantity));
  const total = decks.data.reduce((n, d) => n + d.quantity, 0);

  return (
    <View style={[styles.block, { borderTopColor: palette.rule }]}>
      <Text variant="heading">{t('card.inYourDecks', { count: decks.data.length })}</Text>
      <Text variant="caption" tone="secondary">
        {decks.data.length > 1 ? t('card.inYourDecksSummary', { most, total, owned }) : t('card.inYourDeckSummary', { most, owned })}
      </Text>
      <View>
        {decks.data.map((d) => {
          const missing = Math.max(0, d.quantity - owned);
          return (
            <Link key={d.id} href={{ pathname: '/deck/[id]', params: { id: d.id } }} asChild>
              <PressableArea
                accessibilityRole="link"
                accessibilityLabel={`${d.name}, ×${d.quantity}`}
                boxStyle={[styles.deckRow, { borderBottomColor: palette.border }]}
                activeStyle={{ backgroundColor: palette.primarySoft }}>
                <Text weight="semibold" numberOfLines={1} style={styles.flex}>
                  {d.name}
                </Text>
                <Pips owned={Math.min(owned, d.quantity)} need={d.quantity} size="sm" />
                <Text variant="mono" style={[styles.deckStatus, { color: missing ? palette.danger : palette.textSecondary }]}>
                  {missing ? t('decks.missing', { count: missing }) : t('decks.own', { count: d.quantity })}
                </Text>
              </PressableArea>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  legalityWrap: { gap: 4 },
  legality: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.sm, minHeight: 30, justifyContent: 'center' },
  legalityNote: { maxWidth: 420 },
  zoomable: { width: '100%' },
  zoomHint: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  zoomBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  zoomClose: { color: '#fff' },
  block: { gap: spacing.sm, borderTopWidth: 2, paddingTop: spacing.md },
  strip: { gap: spacing.md, paddingBottom: spacing.xs },
  mini: { width: 104, gap: 4 },
  miniMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth },
  deckStatus: { minWidth: 76, textAlign: 'right' },
  want: { alignSelf: 'flex-start' },
});

/** Put the selected printing on (or off) your wishlist. */
export function WantButton({ printingId }: { printingId: string }) {
  const { t } = useTranslation();
  const wishlist = useWishlist();
  const add = useAddToWishlist();
  const remove = useRemoveFromWishlist();
  const wanted = (wishlist.data ?? []).some((w) => w.printing_id === printingId);
  return (
    <Button
      title={wanted ? t('wishlist.onList') : t('wishlist.want')}
      icon="bookmark"
      variant={wanted ? 'secondary' : 'outline'}
      size="sm"
      loading={add.isPending || remove.isPending}
      accessibilityState={{ selected: wanted }}
      onPress={() => (wanted ? remove.mutate(printingId) : add.mutate(printingId))}
      boxStyle={styles.want}
    />
  );
}
