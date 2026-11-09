import { rarityShort } from '@binder/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { fetchCard, type PrintingWithSet } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { printingLabel, variantName } from '@/lib/format';
import { notifyError, showToast } from '@/lib/notify';
import { elevation, radius, spacing, usePalette } from '@/theme';

/**
 * "+" on a search result. A card with one printing in the app's card language is added at once;
 * with several (alt arts, reprints) it opens a picker of those arts. Every add says what was added
 * and offers Undo.
 */
export function QuickAdd({ cardId, name }: { cardId: string; name: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const client = useQueryClient();
  const adjust = useAdjustQuantity();
  const [language] = useCardLanguage();
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<PrintingWithSet[] | null>(null);

  const add = (printing: PrintingWithSet) => {
    setChoices(null);
    adjust.mutate({ printingId: printing.id, delta: 1 });
    showToast(
      t('cardsPage.quickAdded', { name, code: printingLabel(printing.code, t), language: t(`languages.short.${printing.language}`) }),
      { label: t('collection.undo'), onPress: () => adjust.mutate({ printingId: printing.id, delta: -1 }) },
    );
  };

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Same query as the card page, so the printings are often already cached.
      const card = await client.fetchQuery({ queryKey: ['card', cardId], queryFn: () => fetchCard(cardId), staleTime: 5 * 60 * 1000 });
      const printings = (card?.printings ?? []).filter((p) => p.language === language);
      if (printings.length === 1) add(printings[0]);
      else if (printings.length > 1) setChoices(printings);
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
      {choices ? <ArtPicker name={name} cardId={cardId} printings={choices} onPick={add} onClose={() => setChoices(null)} /> : null}
    </>
  );
}

/** The arts of one card in the current language: tap one to add a copy. */
function ArtPicker({
  name,
  cardId,
  printings,
  onPick,
  onClose,
}: {
  name: string;
  cardId: string;
  printings: PrintingWithSet[];
  onPick: (printing: PrintingWithSet) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { width, height } = useWindowDimensions();
  const owned = useCollectionQuantities({ cardId }).data ?? {};
  const panelWidth = Math.min(width - spacing.lg * 2, 600);
  const columns = panelWidth < 420 ? 3 : 4;
  const gap = spacing.sm;
  // Inner width: the panel minus its 1px borders and the grid's padding.
  const tileWidth = Math.floor((panelWidth - 2 - spacing.lg * 2 - gap * (columns - 1)) / columns);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={onClose} accessibilityLabel={t('common.close')}>
        {/* Presses inside the panel stay in the panel. */}
        <Pressable
          onPress={() => {}}
          accessibilityRole="none"
          style={[
            styles.panel,
            { width: panelWidth, maxHeight: height * 0.85, backgroundColor: palette.surface, borderColor: palette.rule },
            elevation(palette, true),
          ]}>
          <View style={[styles.head, { borderBottomColor: palette.rule }]}>
            <View style={styles.flex}>
              <Text variant="heading" accessibilityRole="header">
                {t('cardsPage.pickArt')}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {name} · {cardId}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8} style={styles.close}>
              <Icon name="x" size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.grid, { gap }]}>
            {printings.map((p) => {
              const have = owned[p.id] ?? 0;
              const variant = variantName(p.variant, p.variant_index, t);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => onPick(p)}
                  accessibilityRole="button"
                  accessibilityLabel={t('cardsPage.addArt', { art: variant, set: p.set.code, owned: have })}
                  style={({ hovered, pressed }) => [
                    styles.tile,
                    { width: tileWidth, borderColor: pressed || hovered ? palette.text : 'transparent' },
                    pressed && { backgroundColor: palette.highlightSoft },
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.5 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  panel: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', cursor: 'auto' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2 },
  flex: { flex: 1, minWidth: 0 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg },
  tile: { gap: 2, padding: 4, borderWidth: 1.5, borderRadius: radius.sm },
});
