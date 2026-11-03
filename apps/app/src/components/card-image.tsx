import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CARD_ASPECT_RATIO, radius, usePalette } from '@/theme';

import { Text } from './ui/text';

interface CardImageProps {
  uri: string;
  /** Shown if the image cannot be loaded, and used as the accessibility label. */
  label: string;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
}

/** A card picture at the real card aspect ratio, with a text fallback when the image fails. */
export function CardImage({ uri, label, style, priority = 'normal' }: CardImageProps) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.frame, { backgroundColor: palette.surfaceAlt }, style]}>
      {failed ? (
        <View style={styles.fallback}>
          <Text variant="caption" tone="secondary" style={styles.fallbackText}>
            {label}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          priority={priority}
          accessibilityLabel={label}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: CARD_ASPECT_RATIO, borderRadius: radius.md, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  fallbackText: { textAlign: 'center' },
});
