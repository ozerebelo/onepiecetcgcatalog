import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, usePalette } from '@/theme';

import { Text } from './text';

export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const palette = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ hovered }) => [
              styles.segment,
              selected && { backgroundColor: palette.surface, borderColor: palette.borderStrong, borderWidth: 1 },
              !selected && hovered && { backgroundColor: palette.border },
            ]}>
            <Text variant="label" tone={selected ? 'default' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  segment: { minHeight: 30, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
});
