import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { fontSize, radius, spacing, usePalette } from '@/theme';

import { Text } from './text';

export type TextFieldProps = ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string | null;
};

/** Labeled text input. `ref` is forwarded to the underlying TextInput (React 19 ref-as-prop). */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const palette = usePalette();
  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="caption" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={palette.textMuted}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.surface,
            borderColor: error ? palette.danger : palette.border,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
});
