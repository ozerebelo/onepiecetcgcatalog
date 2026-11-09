import type { Color } from '@binder/core';
import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens for Playset: a printed checklist, marked up by hand.
 *  - light "Paper": paper white, black ink, hairline rules
 *  - dark  "Carbon": warm near-black with paper-coloured ink
 * Marks have meaning in both: highlighter yellow = owned / selected, red pen = missing / needed.
 * There is no green: completion and confirmation are said in ink, never in a third mark colour.
 * Buttons are ink (black on paper, paper on carbon). No gradients; depth comes from rules, not shadows.
 */
const light = {
  background: '#F6F6F2',
  backgroundAlt: '#EEEEE8',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceAlt: '#EDEDE7',
  border: '#DFDFD8',
  borderStrong: '#BDBDB4',
  /** Printed rule: thick line above sections and table headers. */
  rule: '#141414',
  text: '#141414',
  textSecondary: '#54544E',
  textMuted: '#66665F',
  /** Outline of an empty playset slot (≥3:1 on paper and surfaces). */
  slot: '#85857D',
  primary: '#141414',
  primaryPressed: '#000000',
  primarySoft: 'rgba(20, 20, 20, 0.07)',
  onPrimary: '#FFFFFF',
  /** Highlighter: fills behind owned things and selected chips (text on it is always `onHighlight`). */
  highlight: '#FFE14A',
  highlightSoft: 'rgba(255, 225, 74, 0.45)',
  onHighlight: '#141414',
  /** Text-safe version of the highlight (labels, icons). */
  accent: '#7A5C00',
  accentSoft: 'rgba(255, 225, 74, 0.35)',
  success: '#141414',
  successSoft: 'rgba(20, 20, 20, 0.07)',
  /** Red pen: missing cards, needed copies, errors. */
  danger: '#D2261C',
  dangerSoft: 'rgba(210, 38, 28, 0.08)',
  overlay: 'rgba(12, 12, 12, 0.72)',
  shadow: '0 1px 0 rgba(20, 20, 20, 0.05)',
  shadowStrong: '0 1px 2px rgba(20, 20, 20, 0.08), 0 12px 32px rgba(20, 20, 20, 0.10)',
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  background: '#121211',
  backgroundAlt: '#181817',
  surface: '#1C1C1A',
  surfaceRaised: '#232321',
  surfaceAlt: '#282825',
  border: '#31312E',
  borderStrong: '#4A4A45',
  rule: '#F1F1EA',
  text: '#F1F1EA',
  textSecondary: '#B5B5AB',
  textMuted: '#96968D',
  slot: '#75756E',
  primary: '#F1F1EA',
  primaryPressed: '#FFFFFF',
  primarySoft: 'rgba(241, 241, 234, 0.09)',
  onPrimary: '#121211',
  highlight: '#FFE14A',
  highlightSoft: 'rgba(255, 225, 74, 0.22)',
  onHighlight: '#141414',
  accent: '#FFE14A',
  accentSoft: 'rgba(255, 225, 74, 0.16)',
  success: '#F1F1EA',
  successSoft: 'rgba(241, 241, 234, 0.09)',
  danger: '#FF6A5C',
  dangerSoft: 'rgba(255, 106, 92, 0.13)',
  overlay: 'rgba(0, 0, 0, 0.74)',
  shadow: '0 1px 0 rgba(0, 0, 0, 0.35)',
  shadowStrong: '0 2px 6px rgba(0, 0, 0, 0.5), 0 20px 44px rgba(0, 0, 0, 0.45)',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
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

/** IBM Plex: Condensed for headings (label-like, dense), Sans for text, Mono for card numbers and counts. */
export const fonts = {
  display: 'IBMPlexSansCondensed_700Bold',
  displayMedium: 'IBMPlexSansCondensed_600SemiBold',
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 72 } as const;
/** Small radii: printed cards and labels, not bubbles. */
export const radius = { sm: 3, md: 5, lg: 8, xl: 12, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 13, md: 15, lg: 18, xl: 24, xxl: 34, display: 56 } as const;

/** Width/height of a One Piece card (63 × 88 mm). */
export const CARD_ASPECT_RATIO = 63 / 88;

/** A playset: the most copies of one card a deck may hold — what collectors aim to own. */
export const PLAYSET = 4;

/** Content never grows wider than this on large screens. */
export const MAX_CONTENT_WIDTH = 1200;

/** Wide layouts (two columns, top navigation) start here. */
export const WIDE_BREAKPOINT = 820;

/** Monospace for typed card lists (columns of codes line up) and card numbers. */
export const monoFont = fonts.mono;

/** Digits of equal width, for counts and card numbers that sit in columns or change. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Barely-there lift for floating things (menus, dialogs); pages use rules instead. */
export function elevation(palette: Palette, strong = false): ViewStyle {
  return { boxShadow: strong ? palette.shadowStrong : palette.shadow };
}
