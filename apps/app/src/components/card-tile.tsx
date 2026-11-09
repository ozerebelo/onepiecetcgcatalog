import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { printingLabel } from '@/lib/format';
import { fonts, radius, spacing, usePalette } from '@/theme';

import { CardImage } from './card-image';
import { Pips } from './ui/pips';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

interface CardTileProps {
  /** Navigate on press… */
  href?: Href;
  /** …or run an action on press (collect mode). One of href / onPress is expected. */
  onPress?: () => void;
  imageUrl: string;
  code: string;
  name: string;
  width: number;
  /** Small pill in the bottom-right image corner, e.g. "4 arts" or "SR". */
  badge?: string | null;
  /** Owned copies, shown as playset slots under the card (when the viewer's collection is known). */
  quantity?: number;
  /** Copies of the card across all printings (the playset). When given, the slots count these and mark this printing's own. */
  ownedCard?: number;
  /** Show the playset slots even at 0 (the collection is known, e.g. signed in on a set page). */
  showPips?: boolean;
  /** Fade the card (e.g. not owned, in collect mode). */
  dimmed?: boolean;
  /** Extra control over the top-left image corner (e.g. a remove button). */
  overlay?: ReactNode;
  accessibilityHint?: string;
  /**
   * A control beside the number and name (e.g. quick add). It sits outside the tile's link, so
   * pressing it never opens the card, and it never covers the card's printed cost or power.
   */
  action?: ReactNode;
}

/** Grid tile: card image (lifts on hover), number and name. */
export function CardTile({
  href,
  onPress,
  imageUrl,
  code,
  name,
  width,
  badge,
  quantity = 0,
  ownedCard,
  showPips = false,
  dimmed = false,
  overlay,
  accessibilityHint,
  action,
}: CardTileProps) {
  const { t } = useTranslation();
  const palette = usePalette();
  const codeLabel = printingLabel(code, t);
  const label = quantity > 0 ? `${name}, ${codeLabel}, ×${quantity}` : `${name}, ${codeLabel}`;

  const body = (
    <PressableArea
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={href ? undefined : onPress}
      boxStyle={[styles.tile, action ? null : styles.spaced, { width }]}
      activeStyle={styles.lift}>
      <View style={[styles.imageWrap, dimmed && styles.dimmed]}>
        <CardImage uri={imageUrl} label={`${code} ${name}`} />
        {/* One bottom row, so on narrow tiles the label gives way instead of running over the slots. */}
        {badge || showPips || quantity > 0 || (ownedCard ?? 0) > 0 ? (
          <View style={styles.bottomRow} pointerEvents="none">
            {showPips || quantity > 0 || (ownedCard ?? 0) > 0 ? (
              // Playset slots on a paper label stuck to the card's corner.
              <View style={[styles.pips, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Pips owned={ownedCard ?? quantity} here={ownedCard !== undefined ? quantity : undefined} size="sm" />
              </View>
            ) : null}
            {badge ? (
              <View style={[styles.badge, { backgroundColor: palette.overlay }]}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {overlay ? <View style={styles.topLeft}>{overlay}</View> : null}
      <View style={[styles.meta, action ? styles.metaWithAction : null]}>
        <Text variant="mono" tone="muted" numberOfLines={1}>
          {codeLabel}
        </Text>
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </PressableArea>
  );

  const tile = href ? (
    <Link href={href} asChild>
      {body}
    </Link>
  ) : (
    body
  );
  if (!action) return tile;
  return (
    <View style={[styles.spaced, { width }]}>
      {tile}
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: spacing.xs + 2 },
  spaced: { marginBottom: spacing.lg },
  lift: { transform: [{ translateY: -2 }] },
  imageWrap: { borderRadius: radius.md },
  dimmed: { opacity: 0.3 },
  meta: { gap: 1, paddingHorizontal: 1 },
  metaWithAction: { paddingRight: 40 },
  action: { position: 'absolute', right: 0, bottom: 0 },
  bottomRow: { position: 'absolute', left: 5, right: 5, bottom: 5, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badge: { marginLeft: 'auto', flexShrink: 1, minWidth: 0, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm },
  pips: { flexShrink: 0, paddingHorizontal: 4, paddingVertical: 3, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  topLeft: { position: 'absolute', left: 6, top: 6 },
  badgeText: { color: '#fff', fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 15 },
});
