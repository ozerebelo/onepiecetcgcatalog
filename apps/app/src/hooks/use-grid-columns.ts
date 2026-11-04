import { useWindowDimensions } from 'react-native';

import { MAX_CONTENT_WIDTH, spacing } from '@/theme';

/**
 * How many columns fit the current window: ~3 card columns on phones, more on tablets and desktop,
 * with tiles never narrower than `minTileWidth`. `gap` must match the gap the grid is laid out with.
 */
export function useGridColumns(minTileWidth = 110, gap: number = spacing.sm) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - spacing.lg * 2;
  const columns = Math.max(2, Math.min(8, Math.floor((contentWidth + gap) / (minTileWidth + gap))));
  const tileWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
  return { columns, tileWidth };
}
