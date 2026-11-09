import { rarityShort, type VariantKind } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { LanguageSwitch } from '@/components/language-switch';
import { QuantityStepper } from '@/components/quantity-stepper';
import { Button } from '@/components/ui/button';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Pips } from '@/components/ui/pips';
import { CostBadge } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { fetchCard, type CardDetail, type PrintingWithSet } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { printingLabel, variantName } from '@/lib/format';
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

function CardDetailView({ card: fullCard, initialPrintingId }: { card: CardDetail; initialPrintingId?: string }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  // Only the printings in the app's card language: English and Japanese are kept apart.
  const [language, setLanguage] = useCardLanguage();
  const otherLanguage = language === 'en' ? 'ja' : 'en';
  const card = useMemo(
    () => ({ ...fullCard, printings: fullCard.printings.filter((p) => p.language === language) }),
    [fullCard, language],
  );
  const [selectedId, setSelectedId] = useState(
    card.printings.find((p) => p.id === initialPrintingId)?.id ?? card.printings[0]?.id,
  );
  const selected = card.printings.find((p) => p.id === selectedId) ?? card.printings[0];
  const { user } = useAuth();
  const quantities = useCollectionQuantities({ cardId: card.id });
  const adjust = useAdjustQuantity();
  const owned = useMemo(
    () => Object.fromEntries(Object.entries(quantities.data ?? {}).filter(([pid]) => pid.startsWith(`${language}:`))),
    [quantities.data, language],
  );
  const ownedTotal = Object.values(owned).reduce((sum, q) => sum + q, 0);
  const ownedPrintings = Object.keys(owned).length;
  const palette = usePalette();

  return (
    <View style={[styles.layout, wide && styles.layoutWide]}>
      <View style={[styles.imageColumn, wide ? styles.imageColumnWide : styles.imageColumnPhone]}>
        {selected ? (
          <CardImage uri={selected.image_url} label={`${selected.code} ${selected.name}`} priority="high" />
        ) : null}
        {selected ? (
          <Text variant="caption" tone="secondary" style={styles.center}>
            {printingLabel(selected.code, t)} · {selected.set.code} · {t(`rarities.${selected.rarity}`)} ·{' '}
            {t(`languages.short.${selected.language}`)}
          </Text>
        ) : null}
        {selected && !user ? (
          <Link href="/auth/sign-in" asChild>
            <PressableArea accessibilityRole="link">
              <Text variant="caption" tone="primary" style={[styles.link, styles.center]}>
                {t('collection.signInToTrack')}
              </Text>
            </PressableArea>
          </Link>
        ) : null}
      </View>

      <View style={styles.infoColumn}>
        <CardInfo card={card} />
        {user ? (
          // The card's playset, any printing (what a deck slot counts).
          <View style={[styles.playset, { borderColor: palette.border }]}>
            <Pips owned={ownedTotal} />
            <Text variant="caption" tone="secondary" style={styles.flex}>
              {ownedTotal > 0
                ? t('collection.ownedAcross', { count: ownedTotal, printings: ownedPrintings, language: t(`languages.${language}`) })
                : t('collection.noneOfThisCard', { language: t(`languages.${language}`) })}
            </Text>
          </View>
        ) : null}
        <View style={styles.section}>
          <View style={styles.printingsHead}>
            <Text variant="label" tone="secondary" style={styles.flex}>
              {t('card.printings')} ({card.printings.length})
            </Text>
            <LanguageSwitch />
          </View>
          {card.printings.length === 0 ? (
            // Some cards exist in only one language (Japanese releases come first).
            <View style={styles.notInLanguage}>
              <Text tone="secondary">{t('card.notInLanguage', { language: t(`languages.${language}`) })}</Text>
              <Button
                title={t('card.showOtherLanguage', { language: t(`languages.${otherLanguage}`) })}
                variant="outline"
                size="sm"
                onPress={() => setLanguage(otherLanguage)}
              />
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.printings}>
            {card.printings.map((p) => (
              <PrintingThumb
                key={p.id}
                printing={p}
                quantity={owned[p.id] ?? 0}
                ownedTotal={ownedTotal}
                selected={p.id === selected?.id}
                onPress={() => setSelectedId(p.id)}
                showPips={Boolean(user)}
              />
            ))}
          </ScrollView>
          {user && selected ? (
            // The stepper sits under the printings it edits, labelled with the selected one.
            <View style={styles.stepperRow}>
              <View style={styles.flex}>
                <Text variant="label" tone="secondary">
                  {t('collection.inCollection')}
                </Text>
                <Text variant="mono" numberOfLines={1}>
                  {printingLabel(selected.code, t)} · {t(`languages.short.${selected.language}`)} · {selected.set.code}
                </Text>
              </View>
              <QuantityStepper
                quantity={owned[selected.id] ?? 0}
                label={selected.code}
                onChange={(delta) => adjust.mutate({ printingId: selected.id, delta })}
              />
            </View>
          ) : null}
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
    { label: t('card.power'), value: card.power?.toString() ?? null },
    { label: t('card.counter'), value: card.counter ? `+${card.counter}` : null },
    { label: t('card.attribute'), value: card.attributes.join(' / ') || null },
  ].filter((s) => s.value != null);

  return (
    <View style={styles.info}>
      {/* The cost circle (a leader's life) in the card's colours, where the card prints it: before the name. */}
      <View style={styles.titleRow}>
        <CostBadge colors={card.colors} value={card.cost} life={card.category === 'Leader'} size="lg" />
        <View style={[styles.titleBlock, styles.flex]}>
          <Text variant="title">{card.name}</Text>
          {hasEnglish && card.name_ja ? (
            <Text tone="secondary">{card.name_ja}</Text>
          ) : !hasEnglish ? (
            <Text variant="caption" tone="primary">
              {t('card.japaneseOnly')}
            </Text>
          ) : null}
        </View>
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
  return (variant: VariantKind, index: number) => variantName(variant, index, t);
}

function PrintingThumb({
  printing,
  quantity,
  ownedTotal,
  selected,
  onPress,
  showPips,
}: {
  printing: PrintingWithSet;
  quantity: number;
  /** Copies across every printing: they all fill the same playset; this printing's are drawn solid. */
  ownedTotal: number;
  selected: boolean;
  onPress: () => void;
  showPips: boolean;
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
      // The selected printing is marked in highlighter (frame and fill), like the rest of the app.
      style={({ hovered }) => [
        styles.thumb,
        selected
          ? { borderColor: palette.highlight, backgroundColor: palette.highlightSoft }
          : { borderColor: 'transparent', backgroundColor: hovered ? palette.primarySoft : 'transparent' },
      ]}>
      <CardImage uri={printing.image_url} label={printing.code} />
      {showPips ? <Pips owned={ownedTotal} here={quantity} size="sm" /> : null}
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
  // Phones: the card shouldn't fill the first screen; its name and playset come right after.
  imageColumnPhone: { maxWidth: 240 },
  flex: { flex: 1 },
  playset: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  printingsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notInLanguage: { gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.sm },
  section: { gap: spacing.xs },
  link: { fontFamily: fonts.semibold },
  printings: { gap: spacing.sm, paddingVertical: spacing.xs },
  thumb: { width: 108, gap: 3, padding: 4, borderWidth: 3, borderRadius: radius.md },
});
