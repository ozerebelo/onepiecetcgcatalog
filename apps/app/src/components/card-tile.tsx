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
  /** Show the playset slots even at 0 (the collection is known, e.g. signed in on a set page). */
  showPips?: boolean;
  /** Fade the card (e.g. not owned, in collect mode). */
  dimmed?: boolean;
  /** Extra control over the top-left image corner (e.g. a remove button). */
  overlay?: ReactNode;
  accessibilityHint?: string;
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
  showPips = false,
  dimmed = false,
  overlay,
  accessibilityHint,
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
      boxStyle={[styles.tile, { width }]}
      activeStyle={styles.lift}>
      <View style={[styles.imageWrap, dimmed && styles.dimmed]}>
        <CardImage uri={imageUrl} label={`${code} ${name}`} />
        {badge ? (
          <View style={[styles.badge, styles.bottomRight, { backgroundColor: palette.overlay }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {showPips || quantity > 0 ? (
          // Playset slots on a paper label stuck to the card's corner.
          <View style={[styles.pips, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Pips owned={quantity} size="sm" />
          </View>
        ) : null}
      </View>
      {overlay ? <View style={styles.topLeft}>{overlay}</View> : null}
      <View style={styles.meta}>
        <Text variant="mono" tone="muted" numberOfLines={1}>
          {codeLabel}
        </Text>
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {name}
        </Text>
      </View>
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
  tile: { gap: spacing.xs + 2, marginBottom: spacing.lg },
  lift: { transform: [{ translateY: -2 }] },
  imageWrap: { borderRadius: radius.md },
  dimmed: { opacity: 0.3 },
  meta: { gap: 1, paddingHorizontal: 1 },
  badge: { position: 'absolute', paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm },
  bottomRight: { right: 5, bottom: 5 },
  pips: { position: 'absolute', left: 5, bottom: 5, paddingHorizontal: 4, paddingVertical: 3, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  topLeft: { position: 'absolute', left: 6, top: 6 },
  badgeText: { color: '#fff', fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 15 },
});
