import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fontSize, monoFont, usePalette, type Palette } from '@/theme';

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'mono';
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'danger' | 'success' | 'onPrimary';

export type TextProps = RNTextProps & { variant?: Variant; tone?: Tone };

const toneColor = (palette: Palette, tone: Tone) =>
  ({
    default: palette.text,
    secondary: palette.textSecondary,
    muted: palette.textMuted,
    primary: palette.primary,
    danger: palette.danger,
    success: palette.success,
    onPrimary: palette.onPrimary,
  })[tone];

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const palette = usePalette();
  return <RNText style={[styles[variant], { color: toneColor(palette, tone) }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xl, lineHeight: 32, fontWeight: '800' },
  heading: { fontSize: fontSize.lg, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: fontSize.md, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: fontSize.md, lineHeight: 22 },
  caption: { fontSize: fontSize.sm, lineHeight: 18 },
  label: { fontSize: fontSize.xs, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  mono: { fontSize: fontSize.xs, lineHeight: 16, fontFamily: monoFont },
});
