import type { Color } from '@binder/core';
import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens. Two palettes with the same keys:
 *  - dark  "Grand Line night": deep ink blues, layered surfaces, straw-hat red and treasure gold
 *  - light "Parchment": warm paper tones with the same accents
 * Hero / promo areas use `heroGradient` in both modes for depth.
 */
const dark = {
  background: '#0B0F1A',
  backgroundAlt: '#0F1424',
  surface: '#141A2C',
  surfaceRaised: '#1A2238',
  surfaceAlt: '#212A44',
  border: '#252F4A',
  borderStrong: '#36426A',
  text: '#F4F1EA',
  textSecondary: '#A9B1C7',
  textMuted: '#8790AC',
  primary: '#EF4452',
  primaryPressed: '#D4323F',
  primarySoft: 'rgba(239, 68, 82, 0.14)',
  onPrimary: '#FFFFFF',
  accent: '#F4B942',
  accentSoft: 'rgba(244, 185, 66, 0.14)',
  success: '#3DD68C',
  successSoft: 'rgba(61, 214, 140, 0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.14)',
  overlay: 'rgba(5, 8, 15, 0.74)',
  heroGradient: ['#1E2257', '#121633', '#0B0F1A'] as const,
  heroText: '#F4F1EA',
  heroTextSecondary: '#B9C0D6',
  shadow: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)',
  shadowStrong: '0 2px 6px rgba(0,0,0,0.5), 0 24px 48px rgba(0,0,0,0.45)',
};

export type Palette = { [K in keyof typeof dark]: (typeof dark)[K] extends readonly string[] ? readonly string[] : string };

const light: Palette = {
  background: '#F6F2EA',
  backgroundAlt: '#EFE9DD',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceAlt: '#F1EBDF',
  border: '#E4DCCB',
  borderStrong: '#D2C7B1',
  text: '#151A28',
  textSecondary: '#525A70',
  textMuted: '#6E7487',
  primary: '#D62839',
  primaryPressed: '#B71F2F',
  primarySoft: 'rgba(214, 40, 57, 0.10)',
  onPrimary: '#FFFFFF',
  accent: '#B87A0E',
  accentSoft: 'rgba(184, 122, 14, 0.12)',
  success: '#178A52',
  successSoft: 'rgba(23, 138, 82, 0.10)',
  danger: '#C62828',
  dangerSoft: 'rgba(198, 40, 40, 0.10)',
  overlay: 'rgba(15, 18, 30, 0.68)',
  heroGradient: ['#1E2257', '#151A3D', '#0E1226'],
  heroText: '#F4F1EA',
  heroTextSecondary: '#C3C9DC',
  shadow: '0 1px 2px rgba(21,26,40,0.06), 0 6px 18px rgba(21,26,40,0.08)',
  shadowStrong: '0 2px 6px rgba(21,26,40,0.10), 0 20px 40px rgba(21,26,40,0.16)',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? (dark as Palette) : light;
}

/** In-game card colors, tuned to read on both light and dark backgrounds. */
export const CARD_COLORS: Record<Color, string> = {
  Red: '#E0303F',
  Green: '#2EA866',
  Blue: '#3577E5',
  Purple: '#9150C0',
  Black: '#5A5F6E',
  Yellow: '#E5B419',
};

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 72 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 13, md: 15, lg: 18, xl: 24, xxl: 32, display: 48 } as const;

/** Width/height of a One Piece card (63 × 88 mm). */
export const CARD_ASPECT_RATIO = 63 / 88;

/** Content never grows wider than this on large screens. */
export const MAX_CONTENT_WIDTH = 1200;

/** Wide layouts (two columns, top navigation) start here. */
export const WIDE_BREAKPOINT = 820;

/** Monospace is only for the text areas where card lists are typed (columns of codes line up). */
export const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, monospace' });

/** Digits of equal width, for counts and card numbers that sit in columns or change. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Soft drop shadow (CSS box-shadow syntax works on web, iOS and Android with the new architecture). */
export function elevation(palette: Palette, strong = false): ViewStyle {
  return { boxShadow: strong ? palette.shadowStrong : palette.shadow };
}
