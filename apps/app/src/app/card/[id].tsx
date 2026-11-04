import { rarityShort, type VariantKind } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { QuantityStepper } from '@/components/quantity-stepper';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { fetchCard, type CardDetail, type PrintingWithSet } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { CARD_COLORS, fonts, radius, spacing, usePalette } from '@/theme';

const WIDE_BREAKPOINT = 760;

export default function CardScreen() {
  const { id, printing } = useLocalSearchParams<{ id: string; printing?: string }>();
  const { t } = useTranslation();
  const card = useQuery({ queryKey: ['card', id], queryFn: () => fetchCard(id) });

  return (
    <Screen scroll edges={[]}>
      <Stack.Screen options={{ title: id }} />
      {card.isPending ? (
        <LoadingView />
      ) : card.isError ? (
        <ErrorView error={card.error} onRetry={() => card.refetch()} />
      ) : !card.data ? (
        <EmptyView message={t('common.notFound')} />
      ) : (
        <CardDetailView card={card.data} initialPrintingId={printing} />
      )}
    </Screen>
  );
}

function CardDetailView({ card, initialPrintingId }: { card: CardDetail; initialPrintingId?: string }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [selectedId, setSelectedId] = useState(
    card.printings.find((p) => p.id === initialPrintingId)?.id ?? card.printings[0]?.id,
  );
  const selected = card.printings.find((p) => p.id === selectedId) ?? card.printings[0];
  const { user } = useAuth();
  const quantities = useCollectionQuantities({ cardId: card.id });
  const adjust = useAdjustQuantity();
  const owned = quantities.data ?? {};
  const ownedTotal = Object.values(owned).reduce((sum, q) => sum + q, 0);
  const ownedPrintings = Object.keys(owned).length;

  return (
    <View style={[styles.layout, wide && styles.layoutWide]}>
      <View style={[styles.imageColumn, wide && styles.imageColumnWide]}>
        {selected ? (
          <CardImage uri={selected.image_url} label={`${selected.code} ${selected.name}`} priority="high" />
        ) : null}
        {selected ? (
          <Text variant="caption" tone="secondary" style={styles.center}>
            {selected.code} · {selected.set.code} · {t(`rarities.${selected.rarity}`)} ·{' '}
            {t(`languages.short.${selected.language}`)}
          </Text>
        ) : null}
        {selected ? (
          <View style={styles.collectionBox}>
            {user ? (
              <>
                <Text variant="label" tone="secondary">
                  {t('collection.inCollection')}
                </Text>
                <QuantityStepper
                  quantity={owned[selected.id] ?? 0}
                  label={selected.code}
                  onChange={(delta) => adjust.mutate({ printingId: selected.id, delta })}
                />
                {ownedTotal > 0 ? (
                  <Text variant="caption" tone="secondary" style={styles.center}>
                    {t('collection.ownedAcross', { count: ownedTotal, printings: ownedPrintings })}
                  </Text>
                ) : null}
              </>
            ) : (
              <Link href="/auth/sign-in" asChild>
                <PressableArea accessibilityRole="link">
                  <Text variant="caption" tone="primary" style={styles.link}>
                    {t('collection.signInToTrack')}
                  </Text>
                </PressableArea>
              </Link>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.infoColumn}>
        <CardInfo card={card} />
        <View style={styles.section}>
          <Text variant="label" tone="secondary">
            {t('card.printings')} ({card.printings.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.printings}>
            {card.printings.map((p) => (
              <PrintingThumb
                key={p.id}
                printing={p}
                quantity={owned[p.id] ?? 0}
                selected={p.id === selected?.id}
                onPress={() => setSelectedId(p.id)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function CardInfo({ card }: { card: CardDetail }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const hasEnglish = card.name_en != null;
  const [showJapanese, setShowJapanese] = useState(!hasEnglish);
  const effect = showJapanese ? card.effect_ja : card.effect;
  const trigger = showJapanese ? card.trigger_ja : card.trigger;
  const canToggle = hasEnglish && (card.effect_ja != null || card.name_ja != null);

  const stats: { label: string; value: string | null }[] = [
    { label: card.category === 'Leader' ? t('card.life') : t('card.cost'), value: card.cost?.toString() ?? null },
    { label: t('card.power'), value: card.power?.toString() ?? null },
    { label: t('card.counter'), value: card.counter ? `+${card.counter}` : null },
    { label: t('card.attribute'), value: card.attributes.join(' / ') || null },
  ].filter((s) => s.value != null);

  return (
    <View style={styles.info}>
      <View style={styles.titleBlock}>
        <Text variant="title">{card.name}</Text>
        {hasEnglish && card.name_ja ? (
          <Text tone="secondary">{card.name_ja}</Text>
        ) : !hasEnglish ? (
          <Text variant="caption" tone="primary">
            {t('card.japaneseOnly')}
          </Text>
        ) : null}
      </View>

      <View style={styles.tags}>
        <Tag label={t(`categories.${card.category}`)} />
        {card.colors.map((color) => (
          <Tag key={color} label={t(`colors.${color}`)} dotColor={CARD_COLORS[color]} />
        ))}
      </View>

      {stats.length > 0 ? (
        <View style={[styles.stats, { borderColor: palette.border }]}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text variant="label" tone="secondary">
                {s.label}
              </Text>
              <Text variant="subheading">{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {card.types.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label" tone="secondary">
            {t('card.types')}
          </Text>
          <Text>{card.types.join(' / ')}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="label" tone="secondary">
          {t('card.effect')}
        </Text>
        <Text selectable>{effect ?? t('card.noEffect')}</Text>
      </View>

      {trigger ? (
        <View style={styles.section}>
          <Text variant="label" tone="secondary">
            {t('card.trigger')}
          </Text>
          <Text selectable>{trigger}</Text>
        </View>
      ) : null}

      {canToggle ? (
        <Pressable onPress={() => setShowJapanese((v) => !v)} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" tone="primary" style={styles.link}>
            {showJapanese ? t('card.showEnglishText') : t('card.showJapaneseText')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Tag({ label, dotColor }: { label: string; dotColor?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.tag, { backgroundColor: palette.surfaceAlt }]}>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant="caption" style={styles.tagText}>
        {label}
      </Text>
    </View>
  );
}

function useVariantLabel() {
  const { t } = useTranslation();
  return (variant: VariantKind, index: number) => {
    if (variant === 'base') return t('card.variants.base');
    if (index <= 1) return t(`card.variants.${variant}`);
    return t(`card.variants.${variant}N`, { n: index });
  };
}

function PrintingThumb({
  printing,
  quantity,
  selected,
  onPress,
}: {
  printing: PrintingWithSet;
  quantity: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const variantLabel = useVariantLabel();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${printing.code}, ${variantLabel(printing.variant, printing.variant_index)}, ${printing.set.code}${quantity > 0 ? `, ×${quantity}` : ''}`}
      style={[styles.thumb, { borderColor: selected ? palette.primary : 'transparent' }]}>
      <View>
        <CardImage uri={printing.image_url} label={printing.code} />
        {quantity > 0 ? (
          <View style={[styles.ownedBadge, { backgroundColor: palette.primary }]}>
            <Text variant="label" style={styles.ownedBadgeText}>
              ×{quantity}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="mono" numberOfLines={1}>
        {t(`languages.short.${printing.language}`)} · {rarityShort(printing.rarity)}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {variantLabel(printing.variant, printing.variant_index)}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {printing.set.code}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layout: { paddingTop: spacing.lg, gap: spacing.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  imageColumn: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: spacing.sm },
  imageColumnWide: { width: 340, alignSelf: 'flex-start' },
  infoColumn: { flex: 1, gap: spacing.xl, minWidth: 0 },
  center: { textAlign: 'center' },
  info: { gap: spacing.lg },
  titleBlock: { gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.semibold },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { gap: 2 },
  section: { gap: spacing.xs },
  link: { fontFamily: fonts.semibold },
  printings: { gap: spacing.sm, paddingVertical: spacing.xs },
  thumb: { width: 104, gap: 2, padding: 3, borderWidth: 2, borderRadius: radius.md },
  collectionBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  ownedBadge: { position: 'absolute', top: 4, right: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.pill },
  ownedBadgeText: { color: '#fff', textTransform: 'none', letterSpacing: 0 },
});
