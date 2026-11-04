import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, spacing, usePalette } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'hero';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Icon after the label (e.g. arrow-right). */
  trailingIcon?: IconName;
  loading?: boolean;
  /** Not named `style` so Buttons stay safe inside `<Link asChild>` (see PressableArea). */
  boxStyle?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 52 };

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  disabled,
  boxStyle,
  ...rest
}: ButtonProps) {
  const palette = usePalette();
  const isDisabled = disabled || loading;

  const look: Record<Variant, { bg: string; hover: string; fg: string; border?: string }> = {
    primary: { bg: palette.primary, hover: palette.primaryPressed, fg: palette.onPrimary },
    secondary: { bg: palette.surfaceAlt, hover: palette.borderStrong, fg: palette.text },
    outline: { bg: 'transparent', hover: palette.surfaceAlt, fg: palette.text, border: palette.borderStrong },
    ghost: { bg: 'transparent', hover: palette.surfaceAlt, fg: palette.primary },
    danger: { bg: 'transparent', hover: palette.dangerSoft, fg: palette.danger, border: palette.danger },
    hero: { bg: 'rgba(255,255,255,0.10)', hover: 'rgba(255,255,255,0.18)', fg: palette.heroText, border: 'rgba(255,255,255,0.22)' },
  };
  const v = look[variant];
  const iconSize = size === 'sm' ? 15 : 17;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed, hovered }) => [
        styles.base,
        {
          minHeight: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? spacing.md : size === 'lg' ? spacing.xl : spacing.lg,
          backgroundColor: hovered || pressed ? v.hover : v.bg,
        },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        pressed && { transform: [{ scale: 0.98 }] },
        isDisabled && { opacity: 0.5 },
        boxStyle,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={iconSize} color={v.fg} /> : null}
          <Text
            style={{ color: v.fg, fontFamily: fonts.semibold, fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 15 }}
            numberOfLines={1}>
            {title}
          </Text>
          {trailingIcon ? <Icon name={trailingIcon} size={iconSize} color={v.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
