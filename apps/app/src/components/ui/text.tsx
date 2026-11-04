import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fonts, fontSize, usePalette, type Palette } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'mono' | 'eyebrow';
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'accent' | 'danger' | 'success' | 'onPrimary' | 'hero' | 'heroSecondary';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Body-font weight override (custom fonts use one family per weight, not fontWeight). */
  weight?: Weight;
};

const toneColor = (palette: Palette, tone: Tone) =>
  ({
    default: palette.text,
    secondary: palette.textSecondary,
    muted: palette.textMuted,
    primary: palette.primary,
    accent: palette.accent,
    danger: palette.danger,
    success: palette.success,
    onPrimary: palette.onPrimary,
    hero: palette.heroText,
    heroSecondary: palette.heroTextSecondary,
  })[tone];

export function Text({ variant = 'body', tone = 'default', weight, style, ...rest }: TextProps) {
  const palette = usePalette();
  return (
    <RNText
      style={[styles[variant], weight ? { fontFamily: fonts[weight] } : null, { color: toneColor(palette, tone) }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: fontSize.display, lineHeight: 52, letterSpacing: -1.2 },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, lineHeight: 38, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.displayMedium, fontSize: fontSize.xl, lineHeight: 30, letterSpacing: -0.3 },
  subheading: { fontFamily: fonts.semibold, fontSize: fontSize.md, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: fontSize.md, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 18 },
  // Field and column labels: quiet, sentence case (no tiny tracked capitals).
  label: { fontFamily: fonts.semibold, fontSize: fontSize.xs, lineHeight: 16 },
  // A short tag above a title (set code, product kind): coloured, sentence case.
  eyebrow: { fontFamily: fonts.semibold, fontSize: fontSize.sm, lineHeight: 18, letterSpacing: 0.2 },
  // Card numbers and counts: the text face with equal-width digits (not a code font).
  mono: { fontFamily: fonts.medium, fontSize: fontSize.xs, lineHeight: 16, letterSpacing: 0.2, fontVariant: ['tabular-nums'] },
});
