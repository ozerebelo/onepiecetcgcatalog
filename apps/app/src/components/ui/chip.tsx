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
          backgroundColor: selected ? palette.primarySoft : hovered ? palette.surfaceAlt : palette.surface,
          borderColor: selected ? palette.primary : palette.border,
        },
        pressed && { opacity: 0.8 },
      ]}>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant="caption" weight="semibold" style={{ color: selected ? palette.primary : palette.text }}>
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
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
