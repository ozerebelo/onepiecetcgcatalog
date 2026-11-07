import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { Text } from '@/components/ui/text';
import { PLAYSET, spacing, usePalette } from '@/theme';

/** Narrower number column on phones, so names keep their room. */
function useCompact() {
  return useWindowDimensions().width < 520;
}

/**
 * A printed checklist: number · card · rarity · playset slots, one row per printing.
 * Rows with a full playset get a highlighter swipe; cards you don't own are greyed.
 */
export function ChecklistHeader({ number, card, rarity, playset }: { number: string; card: string; rarity: string; playset: string }) {
  const palette = usePalette();
  const compact = useCompact();
  return (
    <View style={[styles.row, styles.header, { borderBottomColor: palette.rule }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text variant="eyebrow" tone="secondary" style={compact ? styles.codeCompact : styles.code}>
        {number}
      </Text>
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
  /** Owned copies, or undefined when the viewer's collection isn't known (signed out). */
  owned?: number;
  href?: Href;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Extra control at the end of the row (e.g. a remove button in collect mode). */
  trailing?: ReactNode;
}

export function ChecklistRow({ code, name, variant, rarity, owned, href, onPress, accessibilityLabel, accessibilityHint, trailing }: ChecklistRowProps) {
  const palette = usePalette();
  const compact = useCompact();
  const known = owned !== undefined;
  const has = (owned ?? 0) > 0;
  const full = (owned ?? 0) >= PLAYSET;
  const body = (
    <PressableArea
      accessibilityRole={href ? 'link' : onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={href ? undefined : onPress}
      boxStyle={[styles.row, styles.item, { borderBottomColor: palette.border }]}
      activeStyle={{ backgroundColor: palette.primarySoft }}>
      <Text variant="mono" style={[compact ? styles.codeCompact : styles.code, { color: known && !has ? palette.textMuted : palette.text }]} numberOfLines={1}>
        {code}
      </Text>
      <View style={[styles.flex, styles.nameCell]}>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            { color: known && !has ? palette.textMuted : palette.text },
            // The highlighter swipe: a complete playset.
            full && { backgroundColor: palette.highlightSoft },
          ]}>
          {name}
          {variant ? <Text style={{ color: palette.textSecondary }}>{`  ${variant}`}</Text> : null}
        </Text>
      </View>
      <Text variant="mono" tone="secondary" style={compact ? styles.rarityCompact : styles.rarity} numberOfLines={1}>
        {rarity ?? ''}
      </Text>
      <View style={styles.slots}>{known ? <Pips owned={owned ?? 0} /> : null}</View>
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
  header: { paddingVertical: spacing.sm, borderBottomWidth: 2 },
  item: { minHeight: 44, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { width: 86 },
  codeCompact: { width: 70 },
  flex: { flex: 1 },
  nameCell: { minWidth: 0 },
  name: { fontSize: 15, lineHeight: 22, alignSelf: 'flex-start', paddingHorizontal: 2, marginHorizontal: -2 },
  rarity: { width: 40 },
  rarityCompact: { width: 30 },
  slots: { width: 56, alignItems: 'flex-start' },
});
