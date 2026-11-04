import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { printingLabel } from '@/lib/format';
import { radius, spacing, usePalette } from '@/theme';

import { CardImage } from './card-image';
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
  /** Owned copies; shows a "×N" badge in the top-right corner when > 0. */
  quantity?: number;
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
      <View style={[styles.imageWrap, { boxShadow: palette.shadow }, dimmed && styles.dimmed]}>
        <CardImage uri={imageUrl} label={`${code} ${name}`} />
        {badge ? (
          <View style={[styles.badge, styles.bottomRight, { backgroundColor: palette.overlay }]}>
            <Text variant="label" style={styles.badgeText}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {quantity > 0 ? (
        <View style={[styles.badge, styles.topRight, { backgroundColor: palette.primary }]}>
          <Text variant="label" style={styles.badgeText}>
            ×{quantity}
          </Text>
        </View>
      ) : null}
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
  lift: { transform: [{ translateY: -3 }] },
  imageWrap: { borderRadius: radius.md },
  dimmed: { opacity: 0.32 },
  meta: { gap: 1, paddingHorizontal: 2 },
  badge: { position: 'absolute', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  bottomRight: { right: 6, bottom: 6 },
  topRight: { right: 6, top: 6 },
  topLeft: { position: 'absolute', left: 6, top: 6 },
  badgeText: { color: '#fff', textTransform: 'none', letterSpacing: 0 },
});
