import { useWindowDimensions } from 'react-native';

import { MAX_CONTENT_WIDTH, spacing } from '@/theme';

/**
 * How many card columns fit the content area: ~3 on phones, more on tablets and desktop, with
 * tiles never narrower than `minTileWidth`.
 */
export function useGridColumns(minTileWidth = 110) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - spacing.xl * 2;
  const columns = Math.max(2, Math.min(8, Math.floor((contentWidth + spacing.sm) / (minTileWidth + spacing.sm))));
  const tileWidth = Math.floor((contentWidth - spacing.sm * (columns - 1)) / columns);
  return { columns, tileWidth };
}
