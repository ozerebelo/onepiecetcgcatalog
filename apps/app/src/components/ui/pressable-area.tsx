import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export type PressableAreaProps = Omit<PressableProps, 'style'> & {
  /** Layout/visual style. Deliberately NOT named `style` — see below. */
  boxStyle?: StyleProp<ViewStyle>;
  /** Extra style while hovered (web) or pressed. */
  activeStyle?: StyleProp<ViewStyle>;
};

/**
 * A Pressable with built-in pressed/hover feedback, safe to use as the child of `<Link asChild>`.
 *
 * Why the custom prop name: on web, `Link asChild` hands its props to the child via
 * Radix's Slot, which merges `style` with an object spread (`{...linkStyle, ...childStyle}`).
 * A style *function* spreads to `{}` (layout silently lost) and a style *array* spreads
 * to `{0: …, 1: …}` (React DOM throws). Passing layout through `boxStyle` keeps it out
 * of that merge on every platform.
 */
export function PressableArea({ boxStyle, activeStyle, ...rest }: PressableAreaProps) {
  return (
    <Pressable
      {...rest}
      style={({ pressed, hovered }) => [boxStyle, (hovered || pressed) && activeStyle, pressed && { opacity: 0.85 }]}
    />
  );
}
