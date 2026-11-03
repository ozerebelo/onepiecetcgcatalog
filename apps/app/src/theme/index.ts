import type { Color } from '@binder/core';
import { Platform, useColorScheme } from 'react-native';

const light = {
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEEAE2',
  border: '#DFD9CD',
  text: '#17171C',
  textSecondary: '#5D5966',
  textMuted: '#8A8693',
  primary: '#C8102E',
  primaryPressed: '#A50D26',
  onPrimary: '#FFFFFF',
  accent: '#B7791F',
  danger: '#B42318',
  success: '#1F7A3F',
  overlay: 'rgba(0,0,0,0.45)',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#212733',
  border: '#2C3340',
  text: '#F2F0EA',
  textSecondary: '#A9AEBA',
  textMuted: '#767C89',
  primary: '#E5484D',
  primaryPressed: '#C93A3F',
  onPrimary: '#FFFFFF',
  accent: '#F5B83D',
  danger: '#F97066',
  success: '#47B26B',
  overlay: 'rgba(0,0,0,0.6)',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** In-game card colors, tuned to read on both light and dark backgrounds. */
export const CARD_COLORS: Record<Color, string> = {
  Red: '#D7263D',
  Green: '#2E9E5B',
  Blue: '#2D6CDF',
  Purple: '#8E44AD',
  Black: '#4A4A4F',
  Yellow: '#E0B000',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 32 } as const;

/** Width/height of a One Piece card (63 × 88 mm). */
export const CARD_ASPECT_RATIO = 63 / 88;

/** Content never grows wider than this on large screens. */
export const MAX_CONTENT_WIDTH = 1200;

export const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, monospace' });
