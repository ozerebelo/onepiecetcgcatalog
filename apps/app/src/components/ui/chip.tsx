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
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.text : palette.surface,
          borderColor: selected ? palette.text : palette.border,
        },
        pressed && { opacity: 0.75 },
      ]}>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant="caption" style={{ color: selected ? palette.background : palette.text, fontWeight: '600' }}>
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
