import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fonts, fontSize, tabular, usePalette, type FontWeight, type Palette } from '@/theme';

/**
 * App type scale (12 / 14 / 16 / 18 / 24), one family.
 *  - title: the page's h1 (24)        - heading: a section or panel title (18)
 *  - subheading: a row's name (16)    - body (14) / caption (12)
 *  - label: a quiet field / column label (12, sentence case)
 *  - figure: numbers and card codes, tabular figures
 */
type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'figure';
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'accent' | 'danger' | 'success' | 'onPrimary';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Weight override (spreads the right font face for the platform; never set fontWeight directly). */
  weight?: Exclude<FontWeight, 'black'>;
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
  return <RNText style={[styles[variant], weight ? fonts[weight] : null, { color: toneColor(palette, tone) }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  title: { ...fonts.bold, fontSize: fontSize.xxl, lineHeight: 30, letterSpacing: -0.4 },
  heading: { ...fonts.semibold, fontSize: fontSize.xl, lineHeight: 24, letterSpacing: -0.2 },
  subheading: { ...fonts.medium, fontSize: fontSize.lg, lineHeight: 22 },
  body: { ...fonts.regular, fontSize: fontSize.md, lineHeight: 20 },
  caption: { ...fonts.regular, fontSize: fontSize.xs, lineHeight: 16 },
  label: { ...fonts.medium, fontSize: fontSize.xs, lineHeight: 16 },
  figure: { ...fonts.medium, ...tabular, fontSize: fontSize.xs, lineHeight: 16 },
});
