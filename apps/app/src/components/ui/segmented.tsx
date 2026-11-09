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
      style={[styles.container, { borderColor: palette.borderStrong }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            // React Native Web drops `checked` for radios; say it in ARIA directly.
            aria-checked={selected}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ hovered }) => [
              styles.segment,
              selected && { backgroundColor: palette.highlight },
              !selected && hovered && { backgroundColor: palette.primarySoft },
            ]}>
            <Text variant="caption" weight="semibold" style={{ color: selected ? palette.onHighlight : palette.textSecondary }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: radius.md, padding: 2, alignSelf: 'flex-start', borderWidth: 1 },
  segment: { minHeight: 30, paddingHorizontal: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
