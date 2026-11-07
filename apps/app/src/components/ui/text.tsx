import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fonts, fontSize, usePalette, type Palette } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'mono' | 'eyebrow';
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'accent' | 'danger' | 'success' | 'onPrimary';
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
  // Headings: IBM Plex Sans Condensed — dense, like a printed label.
  display: { fontFamily: fonts.display, fontSize: fontSize.display, lineHeight: 56, letterSpacing: -1 },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, lineHeight: 38, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displayMedium, fontSize: fontSize.xl, lineHeight: 28, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.semibold, fontSize: fontSize.md, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: fontSize.md, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 18 },
  // Field labels: quiet, sentence case.
  label: { fontFamily: fonts.semibold, fontSize: fontSize.xs, lineHeight: 16 },
  // Column heads and the line above a title: the checklist's printed form (mono, capitals).
  eyebrow: { fontFamily: fonts.monoMedium, fontSize: 11.5, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  // Card numbers and counts: IBM Plex Mono.
  mono: { fontFamily: fonts.monoMedium, fontSize: fontSize.xs, lineHeight: 16 },
});
