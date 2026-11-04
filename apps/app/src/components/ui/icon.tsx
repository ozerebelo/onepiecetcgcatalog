import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { usePalette } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

/** Line icons (Feather set). Color defaults to the current text color. */
export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const palette = usePalette();
  return <Feather name={name} size={size} color={color ?? palette.text} />;
}
