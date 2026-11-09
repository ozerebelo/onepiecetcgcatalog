import type { Color, KeywordKind } from '@binder/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import { CARD_COLORS, fonts, usePalette } from '@/theme';

import { Text } from './text';

/**
 * The game's own furniture, drawn in Yonko's ink: the cost circle in the card's colour (a split
 * ring for multicolour cards), a leader's life, the colour of a deck, and rarity codes.
 * Card colours identify cards; they never stand in for the marks (highlighter = owned, red pen = missing).
 */

/** Card colours with the one adjustment dark mode needs (Black would vanish on carbon). */
export function useCardColor() {
  const dark = useColorScheme() === 'dark';
  return (color: Color) => (dark && color === 'Black' ? '#8B91A1' : CARD_COLORS[color]);
}

/** Border colours for a ring split between up to three colours (first colour on top-right). */
export function ringColors(colors: readonly string[]) {
  const [a, b = a, c = b] = colors;
  return { borderTopColor: a, borderRightColor: a, borderBottomColor: b, borderLeftColor: colors.length > 2 ? c : b };
}

const SIZES = { sm: { box: 20, ring: 2.5, font: 10 }, md: { box: 24, ring: 3, font: 12 }, lg: { box: 40, ring: 4, font: 19 } } as const;

/**
 * A card's cost as the card prints it: a number inside a ring of the card's colour(s).
 * Leaders have no cost; pass `life` and the ring becomes a square holding the leader's life.
 */
export function CostBadge({
  colors,
  value,
  life = false,
  size = 'md',
  style,
}: {
  colors: readonly Color[] | null | undefined;
  value: number | null | undefined;
  life?: boolean;
  size?: keyof typeof SIZES;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const cardColor = useCardColor();
  const s = SIZES[size];
  if (value == null) return <View style={[{ width: s.box, height: s.box }, style]} />;
  const ring = colors?.length ? ringColors(colors.map(cardColor)) : { borderColor: palette.borderStrong };
  const names = (colors ?? []).map((c) => t(`colors.${c}`)).join(' / ');
  return (
    <View
      accessibilityLabel={`${t(life ? 'card.life' : 'card.cost')} ${value}${names ? `, ${names}` : ''}`}
      style={[
        styles.badge,
        { width: s.box, height: s.box, borderWidth: s.ring, borderRadius: life ? 4 : s.box / 2, backgroundColor: palette.surface },
        ring,
        style,
      ]}>
      <Text style={[styles.value, { fontSize: s.font, lineHeight: s.font + 2, color: palette.text }]}>{value}</Text>
    </View>
  );
}

/** A deck's or card's colour(s) as one small disc, split for multicolour. */
export function ColorMark({ colors, size = 10 }: { colors: readonly Color[] | null | undefined; size?: number }) {
  const cardColor = useCardColor();
  if (!colors?.length) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2, borderWidth: size / 2 }, ringColors(colors.map(cardColor))]}
    />
  );
}

const HIGH = new Set(['SEC', 'SP', 'TR']);
const MID = new Set(['SR', 'L']);

/**
 * Rarity as a printed code. Chase rarities (Secret, Special, Treasure) are set solid in ink,
 * Super Rares and Leaders get an ink outline, the rest stay plain: rarity reads at a glance.
 */
export function RarityTag({ code, style }: { code: string | null | undefined; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  if (!code) return <View style={style} />;
  const high = HIGH.has(code);
  const mid = MID.has(code);
  return (
    <View style={style}>
      <View
        style={[
          styles.tag,
          high && { backgroundColor: palette.text, borderColor: palette.text },
          mid && { borderColor: palette.text },
          !high && !mid && styles.plain,
        ]}>
        <Text style={[styles.tagText, { color: high ? palette.background : mid ? palette.text : palette.textSecondary }]}>{code}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.monoBold, textAlign: 'center', fontVariant: ['tabular-nums'] },
  mark: {},
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'transparent', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0 },
  plain: { paddingHorizontal: 0 },
  tagText: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
});

/**
 * Keyword labels as the printed card colours them: timing in blue, [Counter] in red, [Trigger] in
 * yellow, abilities (Blocker, Rush…) in orange, [Once Per Turn] in magenta, [DON!! x1] in black.
 * Each pair keeps its text readable (≥4.5:1).
 */
export const KEYWORD_STYLES: Record<KeywordKind, { background: string; color: string }> = {
  timing: { background: '#2459B8', color: '#FFFFFF' },
  counter: { background: '#C42A33', color: '#FFFFFF' },
  trigger: { background: '#F2C230', color: '#141414' },
  ability: { background: '#B4531A', color: '#FFFFFF' },
  limit: { background: '#A3306A', color: '#FFFFFF' },
  don: { background: '#141414', color: '#FFFFFF' },
};

/** A keyword label as a small block (filters, legends). Inside running text use EffectText. */
export function KeywordTag({ kind, label }: { kind: KeywordKind; label: string }) {
  const style = KEYWORD_STYLES[kind];
  return (
    <View style={[keywordStyles.tag, { backgroundColor: style.background }]}>
      <Text style={[keywordStyles.text, { color: style.color }]}>{label}</Text>
    </View>
  );
}

const keywordStyles = StyleSheet.create({
  tag: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start' },
  text: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17 },
});
