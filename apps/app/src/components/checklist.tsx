import type { Color } from '@binder/core';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { CostBadge, RarityTag } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { PLAYSET, spacing, usePalette } from '@/theme';

/** Narrower number column on phones, so names keep their room. */
function useCompact() {
  return useWindowDimensions().width < 520;
}

/**
 * A printed checklist: number · cost · card · rarity · playset slots, one row per printing.
 * The playset belongs to the card, not the printing: base, alt arts and Japanese copies all fill
 * the same four slots, so a full playset gets the highlighter swipe on every one of its rows.
 * The number greys out when you don't own that printing; the name when you own none of the card.
 */
export function ChecklistHeader({ number, card, rarity, playset }: { number: string; card: string; rarity: string; playset: string }) {
  const palette = usePalette();
  const compact = useCompact();
  return (
    <View
      style={[styles.row, compact && styles.rowCompact, styles.header, { borderBottomColor: palette.rule }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text variant="eyebrow" tone="secondary" style={compact ? styles.codeCompact : styles.code}>
        {number}
      </Text>
      <View style={styles.cost} />
      <Text variant="eyebrow" tone="secondary" style={styles.flex}>
        {card}
      </Text>
      <Text variant="eyebrow" tone="secondary" style={compact ? styles.rarityCompact : styles.rarity}>
        {rarity}
      </Text>
      <Text variant="eyebrow" tone="secondary" style={styles.slots}>
        {playset}
      </Text>
    </View>
  );
}

export interface ChecklistRowProps {
  code: string;
  name: string;
  /** e.g. "Alt art 2" — shown after the name. */
  variant?: string | null;
  rarity?: string | null;
  /** Owned copies of this printing, or undefined when the viewer's collection isn't known (signed out). */
  owned?: number;
  /** Owned copies of the card across all its printings (what the playset counts). Defaults to `owned`. */
  ownedCard?: number;
  /** The card's colours and cost (a leader's life when `life`), drawn as the card's cost circle. */
  colors?: readonly Color[] | null;
  cost?: number | null;
  life?: boolean;
  href?: Href;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Extra control at the end of the row (e.g. a remove button in collect mode). */
  trailing?: ReactNode;
}

export function ChecklistRow({
  code,
  name,
  variant,
  rarity,
  owned,
  ownedCard,
  colors,
  cost,
  life,
  href,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  trailing,
}: ChecklistRowProps) {
  const palette = usePalette();
  const compact = useCompact();
  const known = owned !== undefined;
  const total = ownedCard ?? owned ?? 0;
  const has = (owned ?? 0) > 0;
  const hasCard = total > 0;
  const full = total >= PLAYSET;
  const body = (
    <PressableArea
      accessibilityRole={href ? 'link' : onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={href ? undefined : onPress}
      boxStyle={[styles.row, compact && styles.rowCompact, styles.item, { borderBottomColor: palette.border }]}
      activeStyle={{ backgroundColor: palette.primarySoft }}>
      <Text variant="mono" style={[compact ? styles.codeCompact : styles.code, { color: known && !has ? palette.textMuted : palette.text }]} numberOfLines={1}>
        {code}
      </Text>
      <CostBadge colors={colors} value={cost} life={life} size="sm" style={styles.cost} />
      <View style={[styles.flex, styles.nameCell]}>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            { color: known && !hasCard ? palette.textMuted : palette.text },
            // The highlighter swipe: a complete playset, counting every printing of the card.
            full && { backgroundColor: palette.highlightSoft },
          ]}>
          {name}
        </Text>
        {/* The art variant on its own line, so alt arts never truncate into their base card. */}
        {variant ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {variant}
          </Text>
        ) : null}
      </View>
      <RarityTag code={rarity} style={compact ? styles.rarityCompact : styles.rarity} />
      <View style={styles.slots}>{known ? <Pips owned={total} here={ownedCard !== undefined ? (owned ?? 0) : undefined} /> : null}</View>
      {trailing}
    </PressableArea>
  );
  return href ? (
    <Link href={href} asChild>
      {body}
    </Link>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowCompact: { gap: spacing.sm },
  cost: { width: 20, alignItems: 'center' },
  header: { paddingVertical: spacing.sm, borderBottomWidth: 2 },
  item: { minHeight: 44, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { width: 86 },
  codeCompact: { width: 70 },
  flex: { flex: 1 },
  nameCell: { minWidth: 0 },
  name: { fontSize: 15, lineHeight: 22, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 5, marginHorizontal: -5, borderRadius: 2 },
  rarity: { width: 40 },
  rarityCompact: { width: 32 },
  slots: { width: 56, alignItems: 'flex-start' },
});
