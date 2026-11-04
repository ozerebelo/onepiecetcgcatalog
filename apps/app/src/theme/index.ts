import type { Color } from '@binder/core';
import { Platform, useColorScheme, type TextStyle } from 'react-native';

/**
 * Design tokens (v3).
 *
 * App screens follow a "framed sheet" style: a low-chroma stone frame (nav + top bar) holds a white
 * page; surfaces are separated by one tone step or a 1px edge — never a shadow or a gradient. The
 * brand red marks the primary action and the current page; other chroma lives in the data.
 *
 * The landing page uses `poster`: flat fields in the game's own card colours, independent of the
 * light / dark setting.
 */
const light = {
  /** The frame: page ground, navigation, top bar. */
  background: '#F3F2EF',
  /** A quiet step inside a sheet (table header, inset well). */
  backgroundAlt: '#F7F6F4',
  /** The sheet and panels on it. */
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  /** Selected / pressed / hovered rows and segments. */
  surfaceAlt: '#ECEBE8',
  border: '#E6E4DF',
  /** Control outlines (inputs, outlined buttons). */
  borderStrong: '#CFCCC5',
  text: '#1A1A1A',
  textSecondary: '#5F5B52',
  textMuted: '#6B6B6B',
  /** The primary action: the brand's red (deepened to keep a white label at 4.5:1). */
  primary: '#D33A33',
  primaryPressed: '#B52F29',
  primarySoft: '#ECEBE8',
  onPrimary: '#FFFFFF',
  /** The one accent: green, on data (owned, progress) and the selected tab. */
  accent: '#18BC42',
  accentSoft: '#DCFAE5',
  success: '#167A33',
  successSoft: '#DCFAE5',
  successInk: '#04250E',
  danger: '#C4242A',
  dangerSoft: '#FFEDEA',
  dangerInk: '#831C1E',
  overlay: 'rgba(17, 17, 17, 0.6)',
  /** The brand's own red, for the logo mark only. */
  brand: '#ED4B44',
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  background: '#0E0E0E',
  backgroundAlt: '#141414',
  surface: '#161616',
  surfaceRaised: '#1E1E1E',
  surfaceAlt: '#232323',
  border: '#2A2A2A',
  borderStrong: '#444444',
  text: '#F2EFE8',
  textSecondary: '#B4B4B4',
  textMuted: '#949494',
  primary: '#D33A33',
  primaryPressed: '#E04A42',
  primarySoft: '#262626',
  onPrimary: '#FFFFFF',
  accent: '#3FC96A',
  accentSoft: '#172A1D',
  success: '#3FC96A',
  successSoft: '#172A1D',
  successInk: '#3FC96A',
  danger: '#E5566F',
  dangerSoft: '#2C1A20',
  dangerInk: '#F07A8E',
  overlay: 'rgba(0, 0, 0, 0.7)',
  brand: '#ED4B44',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * The landing page's poster fields ("colour chapters"): the game's own card colours at full
 * strength, each with the ink that reads on it. Same in light and dark mode.
 */
export const poster = {
  bone: '#E6E0D2',
  boneStep: '#DCD5C5',
  ink: '#1A1A1A',
  inkSoft: '#5F5B52',
  red: '#ED4B44',
  redDeep: '#7A1714',
  black: '#1A1A1A',
  blackStep: '#262626',
  green: '#18BC42',
  greenDeep: '#0B5A1F',
  yellow: '#F2C21A',
  /** Text on the black field. */
  paper: '#E6E0D2',
} as const;

/** In-game card colors, tuned to read on both light and dark backgrounds. */
export const CARD_COLORS: Record<Color, string> = {
  Red: '#E0303F',
  Green: '#2EA866',
  Blue: '#3577E5',
  Purple: '#9150C0',
  Black: '#5A5F6E',
  Yellow: '#E5B419',
};

// ---------------------------------------------------------------------------
// Type: one family, Epilogue.
// Native platforms register one font family per weight (Epilogue_600SemiBold, …); on web the same
// files are registered as one family, "Epilogue", with real font-weights (see lib/web-setup.ts), so
// the browser sees a single typeface. Always set type through `fonts.*` (spread the style object).
// ---------------------------------------------------------------------------

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'black';

export const NATIVE_FONT_FACES: Record<FontWeight, string> = {
  regular: 'Epilogue_400Regular',
  medium: 'Epilogue_500Medium',
  semibold: 'Epilogue_600SemiBold',
  bold: 'Epilogue_700Bold',
  black: 'Epilogue_900Black',
};

export const CSS_FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '900',
} as const satisfies Record<FontWeight, TextStyle['fontWeight']>;

export const WEB_FONT_FAMILY = 'Epilogue';

function face(weight: FontWeight): TextStyle {
  return Platform.OS === 'web'
    ? { fontFamily: `${WEB_FONT_FAMILY}, system-ui, sans-serif`, fontWeight: CSS_FONT_WEIGHTS[weight] }
    : { fontFamily: NATIVE_FONT_FACES[weight] };
}

export const fonts = {
  regular: face('regular'),
  medium: face('medium'),
  semibold: face('semibold'),
  bold: face('bold'),
  black: face('black'),
} as const;

/** Tabular figures for any number that is compared or updates. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 72 } as const;
/** Soft style: cards 16, inner panels 10, controls pill-shaped. */
export const radius = { xs: 4, sm: 6, md: 10, lg: 16, xl: 20, pill: 999 } as const;
/** App scale: 12 / 14 / 16 / 18 / 24. */
export const fontSize = { xs: 12, sm: 13, md: 14, lg: 16, xl: 18, xxl: 24, display: 32 } as const;

/** Width/height of a One Piece card (63 × 88 mm). */
export const CARD_ASPECT_RATIO = 63 / 88;

/** Content never grows wider than this on large screens. */
export const MAX_CONTENT_WIDTH = 1200;

/** Wide layouts (two columns, side navigation) start here. */
export const WIDE_BREAKPOINT = 820;

/** Monospace is kept for one job: the decklist / import text areas, where columns of codes are typed. */
export const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, monospace' });
