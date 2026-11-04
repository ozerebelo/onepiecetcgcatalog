import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CARD_ASPECT_RATIO, radius, usePalette } from '@/theme';

import { Text } from './ui/text';

interface CardImageProps {
  uri: string | null | undefined;
  /** Shown if the image cannot be loaded, and used as the accessibility label. */
  label: string;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
  rounded?: number;
}

/**
 * A card picture at the real card aspect ratio. If loading fails it retries once
 * (with a cache-busting suffix) before showing the card number and name instead.
 */
export function CardImage({ uri, label, style, priority = 'normal', rounded = radius.md }: CardImageProps) {
  const palette = usePalette();
  // Retry count belongs to a specific uri, so a new uri starts fresh without an effect.
  const [errors, setErrors] = useState<{ uri: string | null | undefined; count: number }>({ uri, count: 0 });
  const attempt = errors.uri === uri ? errors.count : 0;
  const failed = !uri || attempt >= 2;
  const source = uri && attempt === 1 ? `${uri}${uri.includes('?') ? '&' : '?'}retry=1` : uri;

  return (
    <View style={[styles.frame, { backgroundColor: palette.surfaceAlt, borderRadius: rounded }, style]}>
      {failed ? (
        <View style={styles.fallback}>
          <Text variant="caption" tone="secondary" style={styles.fallbackText}>
            {label}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: source ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          recyclingKey={source}
          priority={priority}
          accessibilityLabel={label}
          onError={() => setErrors((e) => ({ uri, count: (e.uri === uri ? e.count : 0) + 1 }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: CARD_ASPECT_RATIO, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  fallbackText: { textAlign: 'center' },
});
