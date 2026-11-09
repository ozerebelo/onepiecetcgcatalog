import { rarityShort } from '@binder/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Pips } from '@/components/ui/pips';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { fetchCard, type PrintingWithSet } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { printingLabel, variantName } from '@/lib/format';
import { notifyError, showToast } from '@/lib/notify';
import { PLAYSET, elevation, fonts, radius, spacing, tabular, usePalette } from '@/theme';

const MAX_COPIES = 99;

/**
 * "+" on a search result: opens a small sheet to add copies of the card — pick the art (printings in
 * the app's card language; the base art is preselected), pick how many, add. Undo takes them all back.
 */
export function QuickAdd({ cardId, name }: { cardId: string; name: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const client = useQueryClient();
  const [language] = useCardLanguage();
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<PrintingWithSet[] | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Same query as the card page, so the printings are often already cached.
      const card = await client.fetchQuery({ queryKey: ['card', cardId], queryFn: () => fetchCard(cardId), staleTime: 5 * 60 * 1000 });
      const printings = (card?.printings ?? []).filter((p) => p.language === language);
      if (printings.length > 0) setChoices(printings);
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={open}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('cardsPage.quickAdd', { name, code: cardId })}
        hitSlop={8}
        style={({ hovered, pressed }) => [
          styles.button,
          { borderColor: palette.text, backgroundColor: pressed ? palette.highlight : hovered ? palette.surfaceAlt : palette.surface },
          busy && styles.busy,
        ]}>
        <Icon name="plus" size={14} />
      </Pressable>
      {choices ? <AddSheet name={name} cardId={cardId} printings={choices} onClose={() => setChoices(null)} /> : null}
    </>
  );
}

/** Pick the art and the number of copies, then add them. */
function AddSheet({
  name,
  cardId,
  printings,
  onClose,
}: {
  name: string;
  cardId: string;
  printings: PrintingWithSet[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const adjust = useAdjustQuantity();
  const { width, height } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState(printings[0].id);
  const [copies, setCopies] = useState(1);
  const owned = useCollectionQuantities({ cardId }).data ?? {};
  // The playset in this language: every art counts, the other language doesn't.
  const ownedCard = printings.reduce((n, p) => n + (owned[p.id] ?? 0), 0);
  const toPlayset = Math.max(0, PLAYSET - ownedCard);
  const selected = printings.find((p) => p.id === selectedId) ?? printings[0];

  const panelWidth = Math.min(width - spacing.lg * 2, 600);
  const columns = panelWidth < 420 ? 3 : 4;
  const gap = spacing.sm;
  // Inner width: the panel minus its 1px borders and the grid's padding.
  const tileWidth = Math.floor((panelWidth - 2 - spacing.lg * 2 - gap * (columns - 1)) / columns);

  const add = () => {
    const printing = selected;
    const count = copies;
    onClose();
    adjust.mutate({ printingId: printing.id, delta: count });
    showToast(
      t('cardsPage.quickAdded', {
        count,
        name,
        code: printingLabel(printing.code, t),
        language: t(`languages.short.${printing.language}`),
      }),
      { label: t('collection.undo'), onPress: () => adjust.mutate({ printingId: printing.id, delta: -count }) },
    );
  };

  const setCount = (n: number) => setCopies(Math.min(MAX_COPIES, Math.max(1, n)));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={onClose} accessibilityLabel={t('common.close')}>
        {/* Presses inside the panel stay in the panel. */}
        <Pressable
          onPress={() => {}}
          accessibilityRole="none"
          style={[
            styles.panel,
            { width: panelWidth, maxHeight: height * 0.9, backgroundColor: palette.surface, borderColor: palette.rule },
            elevation(palette, true),
          ]}>
          <View style={[styles.head, { borderBottomColor: palette.rule }]}>
            <View style={styles.flex}>
              <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
                {t('cardsPage.addTitle', { name })}
              </Text>
              <View style={styles.playsetRow}>
                <Pips owned={ownedCard} size="sm" />
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {cardId} · {t('cardsPage.ownedInLanguage', { count: ownedCard, language: t(`languages.${selected.language}`) })}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8} style={styles.close}>
              <Icon name="x" size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {printings.length > 1 ? (
              <Text variant="label" tone="secondary">
                {t('cardsPage.pickArt')}
              </Text>
            ) : null}
            <View style={[styles.grid, { gap }]} accessibilityRole="radiogroup" accessibilityLabel={t('cardsPage.pickArt')}>
              {printings.map((p) => {
                const have = owned[p.id] ?? 0;
                const variant = variantName(p.variant, p.variant_index, t);
                const isSelected = p.id === selected.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedId(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    aria-checked={isSelected}
                    accessibilityLabel={t('cardsPage.artOption', { art: variant, set: p.set.code, owned: have })}
                    style={({ hovered }) => [
                      styles.tile,
                      { width: tileWidth },
                      // Selected = marked in highlighter, like every selection in the app.
                      isSelected
                        ? { borderColor: palette.highlight, backgroundColor: palette.highlightSoft }
                        : { borderColor: hovered ? palette.border : 'transparent' },
                    ]}>
                    <CardImage uri={p.image_url} label={p.code} rounded={radius.sm} />
                    <Text variant="caption" weight="semibold" numberOfLines={1}>
                      {variant}
                    </Text>
                    <Text variant="mono" tone="muted" numberOfLines={1}>
                      {p.set.code} · {rarityShort(p.rarity)}
                    </Text>
                    <Text variant="caption" tone={have > 0 ? 'primary' : 'muted'} numberOfLines={1}>
                      {have > 0 ? t('cardsPage.youHave', { count: have }) : t('cardsPage.notOwned')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* How many, then one clear action. */}
          <View style={[styles.foot, { borderTopColor: palette.border }]}>
            <View style={styles.copies}>
              <Text variant="label" tone="secondary">
                {t('cardsPage.copies')}
              </Text>
              <View style={styles.stepper}>
                <StepButton icon="minus" label={t('cardsPage.fewer')} disabled={copies <= 1} onPress={() => setCount(copies - 1)} />
                <Text style={[styles.count, tabular, { color: palette.text }]} accessibilityLiveRegion="polite" accessibilityLabel={t('cardsPage.copiesCount', { count: copies })}>
                  {copies}
                </Text>
                <StepButton icon="plus" label={t('cardsPage.more')} disabled={copies >= MAX_COPIES} onPress={() => setCount(copies + 1)} />
              </View>
              {toPlayset > 1 && copies !== toPlayset ? (
                <Pressable onPress={() => setCount(toPlayset)} accessibilityRole="button" hitSlop={6} style={styles.fill}>
                  <Text variant="caption" weight="semibold" style={styles.underline}>
                    {t('cardsPage.toPlayset', { count: toPlayset })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Button title={t('cardsPage.addCopies', { count: copies })} icon="plus" onPress={add} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: 'plus' | 'minus'; label: string; disabled: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ hovered }) => [
        styles.step,
        { borderColor: palette.text, backgroundColor: hovered ? palette.surfaceAlt : palette.surface },
        disabled && styles.busy,
      ]}>
      <Icon name={icon} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.4 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  panel: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', cursor: 'auto' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  playsetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { gap: 2, padding: 4, borderWidth: 2, borderRadius: radius.sm },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  copies: { gap: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 32, textAlign: 'center', fontFamily: fonts.monoBold, fontSize: 20, lineHeight: 26 },
  fill: { paddingTop: 2 },
  underline: { textDecorationLine: 'underline' },
});
