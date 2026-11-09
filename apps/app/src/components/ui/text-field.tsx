import { useState, type ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { fonts, fontSize, radius, spacing, usePalette } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type TextFieldProps = ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
};

/** Labeled text input with focus ring. `ref` is forwarded to the TextInput (React 19 ref-as-prop). */
export function TextField({ label, error, hint, icon, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="caption" weight="semibold" tone="secondary">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          {
            backgroundColor: palette.surface,
            borderColor: error ? palette.danger : focused ? palette.text : palette.borderStrong,
            // A 2px ink ring when focused (1px border + 1px shadow, so nothing shifts).
            boxShadow: focused ? `0 0 0 1px ${error ? palette.danger : palette.text}` : undefined,
          },
        ]}>
        {icon ? <Icon name={icon} size={18} color={palette.textMuted} /> : null}
        <TextInput
          placeholderTextColor={palette.textMuted}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: palette.text }, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minHeight: 46, fontFamily: fonts.regular, fontSize: fontSize.md, outlineStyle: 'none' } as object,
});
