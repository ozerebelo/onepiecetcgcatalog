import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, usePalette } from '@/theme';

import { Text } from './text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional color swatch shown before the label (card colors). */
  dotColor?: string;
}

export function Chip({ label, selected = false, onPress, dotColor }: ChipProps) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed, hovered }) => [
        styles.chip,
        {
          // Selected = highlighted, like marking an entry on a printed list.
          backgroundColor: selected ? palette.highlight : hovered ? palette.surfaceAlt : 'transparent',
          borderColor: selected ? palette.highlight : palette.borderStrong,
        },
        pressed && { opacity: 0.8 },
      ]}>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant="caption" weight="semibold" style={{ color: selected ? palette.onHighlight : palette.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  dot: { width: 9, height: 9, borderRadius: 2 },
});
