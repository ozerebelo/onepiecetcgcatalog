import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, usePalette } from '@/theme';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Not named `style` so Buttons stay safe inside `<Link asChild>` (see PressableArea). */
  boxStyle?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = 'primary', loading = false, disabled, boxStyle, ...rest }: ButtonProps) {
  const palette = usePalette();
  const isDisabled = disabled || loading;

  const background = {
    primary: palette.primary,
    secondary: palette.surfaceAlt,
    ghost: 'transparent',
    danger: 'transparent',
  }[variant];
  const textTone = variant === 'primary' ? 'onPrimary' : variant === 'danger' ? 'danger' : variant === 'ghost' ? 'primary' : 'default';

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background },
        variant === 'danger' && { borderWidth: 1, borderColor: palette.danger },
        pressed && { opacity: 0.8 },
        isDisabled && { opacity: 0.5 },
        boxStyle,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.onPrimary : palette.primary} />
      ) : (
        <Text variant="subheading" tone={textTone}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
