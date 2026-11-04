import { Platform, useWindowDimensions } from 'react-native';

import { MAX_CONTENT_WIDTH, SHELL_SIDEBAR_WIDTH, SHELL_SHEET_INSET, WIDE_BREAKPOINT, spacing } from '@/theme';

/**
 * How many card columns fit the content area: ~3 on phones, more on tablets and desktop, with
 * tiles never narrower than `minTileWidth`. On wide web screens the content sits on the shell's
 * sheet, beside the sidebar, so that space is taken off first.
 */
export function useGridColumns(minTileWidth = 110) {
  const { width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
  const available = framed ? width - SHELL_SIDEBAR_WIDTH - SHELL_SHEET_INSET - 2 : width;
  const contentWidth = Math.min(available, MAX_CONTENT_WIDTH) - spacing.xl * 2;
  const columns = Math.max(2, Math.min(8, Math.floor((contentWidth + spacing.sm) / (minTileWidth + spacing.sm))));
  const tileWidth = Math.floor((contentWidth - spacing.sm * (columns - 1)) / columns);
  return { columns, tileWidth };
}
