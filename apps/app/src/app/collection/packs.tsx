import { rarityShort, type Rarity, type SetRow } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { LoadingView } from '@/components/ui/state-views';
import { RarityTag } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { fetchSetPrintings, fetchSets, type SetPrinting } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { titleCase, variantName } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { fonts, radius, spacing, tabular, usePalette } from '@/theme';

/** Products you open packs of, newest first. */
const PACK_KINDS = new Set(['booster', 'extra', 'premium']);
const RARITY_ORDER: Rarity[] = ['SecretRare', 'Special', 'TreasureRare', 'SuperRare', 'Leader', 'Rare', 'Uncommon', 'Common', 'Promo'];

interface Logged {
  key: number;
  printing: SetPrinting;
  count: number;
}

/** "OP-01" → "OP01": the prefix of the card numbers printed in a set. */
function cardPrefix(set: Pick<SetRow, 'code'>): string {
  return set.code.replace('-', '');
}

/**
 * The card number typed: "16" → OP01-016 in the chosen set; a full number ("OP05-119") for inserts
 * from other sets. Null when it isn't a card number yet.
 */
function typedCardId(input: string, prefix: string): string | null {
  const text = input.trim().toUpperCase();
  if (/^\d{1,3}$/.test(text)) return `${prefix}-${text.padStart(3, '0')}`;
  const full = /^([A-Z]+\d*)-?(\d{1,3})$/.exec(text);
  return full ? `${full[1]}-${full[2].padStart(3, '0')}` : null;
}

/**
 * Pack-opening mode: pick the set, then type card numbers as you open your packs — Enter adds a copy.
 * The card's arts in this set are shown as you type (base preselected), copies can be raised before
 * adding, and everything logged this session is listed with an undo per line.
 */
export default function PacksScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams<{ set?: string }>();
  const [language] = useCardLanguage();
  const adjust = useAdjustQuantity();
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const sets = useQuery({ queryKey: ['sets', language], queryFn: () => fetchSets(language) });
  const packSets = useMemo(
    () => (sets.data ?? []).filter((s) => PACK_KINDS.has(s.kind)).sort((a, b) => b.sort_order - a.sort_order),
    [sets.data],
  );
  const [chosenId, setChosenId] = useState<string | null>(params.set ?? null);
  const set = (sets.data ?? []).find((s) => s.id === chosenId) ?? packSets[0];
  // The set you came with leads the row, so it's visible without scrolling.
  const setChips = useMemo(() => {
    const preset = (sets.data ?? []).find((s) => s.id === params.set);
    return preset ? [preset, ...packSets.filter((s) => s.id !== preset.id)] : packSets;
  }, [sets.data, packSets, params.set]);

  const printings = useQuery({
    queryKey: ['set-printings', set?.id],
    queryFn: () => fetchSetPrintings(set!.id),
    enabled: Boolean(set),
  });
  const owned = useCollectionQuantities({ setId: set?.id }).data ?? {};

  const [text, setText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [log, setLog] = useState<Logged[]>([]);
  const nextKey = useRef(1);

  const prefix = set ? cardPrefix(set) : '';
  const cardId = typedCardId(text, prefix);
  const matches = useMemo(
    () => (cardId ? (printings.data ?? []).filter((p) => p.card_id === cardId) : []),
    [cardId, printings.data],
  );
  const selected = matches.find((p) => p.id === selectedId) ?? matches[0];

  const total = log.reduce((n, l) => n + l.count, 0);
  const byRarity = RARITY_ORDER.map((r) => ({
    rarity: r,
    count: log.filter((l) => l.printing.rarity === r).reduce((n, l) => n + l.count, 0),
  })).filter((r) => r.count > 0);

  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;

  const add = () => {
    if (!selected) return;
    adjust.mutate({ printingId: selected.id, delta: copies });
    setLog((list) => [{ key: nextKey.current++, printing: selected, count: copies }, ...list]);
    setText('');
    setSelectedId(null);
    setCopies(1);
    input.current?.focus();
  };

  const undo = (entry: Logged) => {
    adjust.mutate({ printingId: entry.printing.id, delta: -entry.count });
    setLog((list) => list.filter((l) => l.key !== entry.key));
  };

  const chooseSet = (id: string) => {
    setChosenId(id);
    setText('');
    setSelectedId(null);
    input.current?.focus();
  };

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Stack.Screen options={{ title: t('packs.title') }} />
      <View style={styles.header}>
        <Text variant="title">{t('packs.title')}</Text>
        <Text tone="secondary">{t('packs.subtitle')}</Text>
      </View>

      {/* Which set the packs are from */}
      <View style={styles.section}>
        <Text variant="label" tone="secondary">
          {t('packs.set')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sets}>
          {setChips.map((s) => (
            <Chip key={s.id} label={s.code} accessibilityLabel={`${s.code} ${titleCase(s.name)}`} selected={s.id === set?.id} onPress={() => chooseSet(s.id)} />
          ))}
        </ScrollView>
        {set ? (
          <Text weight="semibold">
            {set.code} · {titleCase(set.name)}
          </Text>
        ) : null}
      </View>

      {/* Card number entry */}
      <View style={[styles.entry, { borderTopColor: palette.rule }]}>
        <Text variant="label" tone="secondary">
          {t('packs.number')}
        </Text>
        <View style={[styles.numberBox, { borderColor: palette.text, backgroundColor: palette.surface }]}>
          <Text style={[styles.prefix, { color: palette.textSecondary }]}>{prefix}-</Text>
          <TextInput
            ref={input}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setSelectedId(null);
            }}
            onSubmitEditing={add}
            blurOnSubmit={false}
            autoFocus
            autoCorrect={false}
            autoCapitalize="characters"
            inputMode="numeric"
            returnKeyType="done"
            placeholder="016"
            placeholderTextColor={palette.textMuted}
            accessibilityLabel={t('packs.numberLabel', { prefix })}
            style={[styles.numberInput, { color: palette.text }]}
          />
        </View>

        {cardId && printings.isSuccess && matches.length === 0 ? (
          <Text tone="secondary">{t('packs.noMatch', { code: cardId })}</Text>
        ) : null}

        {matches.length > 0 && selected ? (
          <View style={styles.match}>
            <Text variant="heading">
              {selected.card?.name ?? selected.name} <Text variant="mono" tone="secondary">{cardId}</Text>
            </Text>
            <View style={styles.arts} accessibilityRole="radiogroup">
              {matches.map((p) => {
                const isSelected = p.id === selected.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedId(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    aria-checked={isSelected}
                    accessibilityLabel={`${variantName(p.variant, p.variant_index, t)}, ${t('packs.youHave', { count: owned[p.id] ?? 0 })}`}
                    style={[
                      styles.art,
                      isSelected ? { borderColor: palette.highlight, backgroundColor: palette.highlightSoft } : { borderColor: 'transparent' },
                    ]}>
                    <CardImage uri={p.image_url} label={p.code} rounded={radius.sm} />
                    <Text variant="caption" weight="semibold" numberOfLines={1}>
                      {variantName(p.variant, p.variant_index, t)}
                    </Text>
                    <View style={styles.artMeta}>
                      <RarityTag code={rarityShort(p.rarity)} />
                      <Text variant="caption" tone="secondary" style={tabular}>
                        ×{owned[p.id] ?? 0}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.addRow}>
              <View style={styles.stepper}>
                <StepButton icon="minus" label={t('cardsPage.fewer')} disabled={copies <= 1} onPress={() => setCopies((c) => Math.max(1, c - 1))} />
                <Text style={[styles.count, tabular, { color: palette.text }]} accessibilityLabel={t('cardsPage.copiesCount', { count: copies })}>
                  {copies}
                </Text>
                <StepButton icon="plus" label={t('cardsPage.more')} disabled={copies >= 99} onPress={() => setCopies((c) => Math.min(99, c + 1))} />
              </View>
              <Button title={t('cardsPage.addCopies', { count: copies })} icon="plus" onPress={add} />
            </View>
          </View>
        ) : null}
      </View>

      {/* What this session logged */}
      <View style={[styles.section, styles.logSection, { borderTopColor: palette.rule }]}>
        <Text variant="heading">{t('packs.session', { count: total })}</Text>
        {byRarity.length > 0 ? (
          <View style={styles.rarities}>
            {byRarity.map((r) => (
              <View key={r.rarity} style={styles.rarity}>
                <RarityTag code={rarityShort(r.rarity)} />
                <Text variant="mono" style={tabular}>
                  {r.count}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text tone="secondary">{t('packs.empty')}</Text>
        )}
        <View>
          {log.map((entry) => (
            <View key={entry.key} style={[styles.logRow, { borderBottomColor: palette.border }]}>
              <Text variant="mono" style={styles.logCode}>
                {entry.printing.card_id}
              </Text>
              <View style={styles.flex}>
                <Text weight="semibold" numberOfLines={1}>
                  {entry.printing.card?.name ?? entry.printing.name}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {variantName(entry.printing.variant, entry.printing.variant_index, t)}
                </Text>
              </View>
              <RarityTag code={rarityShort(entry.printing.rarity)} />
              <Text variant="mono" style={[styles.logCount, tabular]}>
                ×{entry.count}
              </Text>
              <Pressable onPress={() => undo(entry)} accessibilityRole="button" accessibilityLabel={t('packs.undoLine', { code: entry.printing.card_id })} hitSlop={6} style={styles.undo}>
                <Text variant="caption" weight="semibold" style={styles.underline}>
                  {t('collection.undo')}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </Screen>
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
        disabled && { opacity: 0.4 },
      ]}>
      <Icon name={icon} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingTop: spacing.md },
  section: { gap: spacing.sm, paddingTop: spacing.lg },
  sets: { gap: spacing.xs },
  entry: { gap: spacing.md, borderTopWidth: 2, marginTop: spacing.lg, paddingTop: spacing.md },
  numberBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: radius.md, paddingHorizontal: spacing.md, maxWidth: 320 },
  prefix: { fontFamily: fonts.monoBold, fontSize: 28, lineHeight: 36 },
  numberInput: { flex: 1, minWidth: 0, fontFamily: fonts.monoBold, fontSize: 28, lineHeight: 36, paddingVertical: spacing.sm, outlineStyle: 'none' } as object,
  match: { gap: spacing.md },
  arts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  art: { width: 104, gap: 2, padding: 4, borderWidth: 2, borderRadius: radius.sm },
  artMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 32, textAlign: 'center', fontFamily: fonts.monoBold, fontSize: 20, lineHeight: 26 },
  logSection: { borderTopWidth: 2, marginTop: spacing.xl, paddingTop: spacing.md },
  rarities: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  rarity: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  logCode: { width: 76 },
  flex: { flex: 1, minWidth: 0 },
  logCount: { minWidth: 28, textAlign: 'right' },
  undo: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  underline: { textDecorationLine: 'underline' },
});
