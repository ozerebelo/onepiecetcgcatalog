import { Platform, useWindowDimensions } from 'react-native';

import { MAX_CONTENT_WIDTH, spacing } from '@/theme';

let scrollbarWidth: number | undefined;

/**
 * Width of the browser's classic scrollbar: ~15px on desktop Chrome/Windows, 0 on phones and with
 * overlay scrollbars (macOS default). Lists scroll inside the window, so their scrollbar takes this
 * much of the window width. Measured once.
 */
function webScrollbarWidth(): number {
  if (scrollbarWidth !== undefined) return scrollbarWidth;
  if (typeof document === 'undefined' || !document.body) return 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;';
  document.body.appendChild(probe);
  scrollbarWidth = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return scrollbarWidth;
}

/**
 * How many columns fit the current window: ~3 card columns on phones, more on tablets and desktop,
 * with tiles never narrower than `minTileWidth`. `gap` must match the gap the grid is laid out with.
 */
export function useGridColumns(minTileWidth = 110, gap: number = spacing.sm, reserved = 0) {
  const { width } = useWindowDimensions();
  const usable = Platform.OS === 'web' ? width - webScrollbarWidth() : width;
  // `reserved`: width taken beside the grid inside the content column (e.g. a filter sidebar).
  const contentWidth = Math.min(usable, MAX_CONTENT_WIDTH) - spacing.lg * 2 - reserved;
  const columns = Math.max(2, Math.min(8, Math.floor((contentWidth + gap) / (minTileWidth + gap))));
  const tileWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
  return { columns, tileWidth, usable };
}
