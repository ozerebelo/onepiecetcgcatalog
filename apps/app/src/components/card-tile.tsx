import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, usePalette } from '@/theme';

import { CardImage } from './card-image';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

interface CardTileProps {
  href: Href;
  imageUrl: string;
  code: string;
  name: string;
  width: number;
  /** Small pill in the image corner, e.g. "4 arts" or "P2". */
  badge?: string | null;
  footer?: ReactNode;
}

/** Grid tile: card image, number and name. Navigates to `href` when pressed. */
export function CardTile({ href, imageUrl, code, name, width, badge, footer }: CardTileProps) {
  const palette = usePalette();
  return (
    <Link href={href} asChild>
      <PressableArea accessibilityRole="link" accessibilityLabel={`${name}, ${code}`} boxStyle={[styles.tile, { width }]}>
        <View>
          <CardImage uri={imageUrl} label={`${code} ${name}`} />
          {badge ? (
            <View style={[styles.badge, { backgroundColor: palette.overlay }]}>
              <Text variant="label" style={styles.badgeText}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="mono" tone="secondary" numberOfLines={1}>
          {code}
        </Text>
        <Text variant="caption" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {footer}
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 2, marginBottom: spacing.md },
  name: { fontWeight: '600' },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: { color: '#fff', textTransform: 'none', letterSpacing: 0 },
});
