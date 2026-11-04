import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text as RNText,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { fonts, poster } from '@/theme';

/**
 * Shared pieces of the landing page ("colour chapters"): one type scale, one pair of margins,
 * one square button, the entrance animation and a few web-only style helpers.
 */

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export interface PosterLayout {
  width: number;
  height: number;
  /** Phone composition below 760px. */
  phone: boolean;
  /** Wide desktop composition from 1024px. */
  wide: boolean;
  /** The page's one pair of outer margins. */
  margin: number;
  /** The page's type steps: display (hero), head (section titles), title, lead, body, small, caption. */
  size: {
    display: number;
    head: number;
    title: number;
    lead: number;
    body: number;
    small: number;
    caption: number;
  };
}

export function usePosterLayout(): PosterLayout {
  const { width, height } = useWindowDimensions();
  const vw = width / 100;
  const phone = width < 760;
  return {
    width,
    height,
    phone,
    wide: width >= 1024,
    margin: phone ? 20 : 32,
    size: {
      display: phone ? Math.round(13.4 * vw) : Math.round(clamp(84, 9.2 * vw, 150)),
      head: Math.round(clamp(38, 5 * vw, 80)),
      title: phone ? 26 : Math.round(clamp(28, 2.5 * vw, 36)),
      lead: phone ? 20 : 24,
      body: phone ? 17 : 19,
      small: phone ? 15 : 16,
      caption: 14,
    },
  };
}

type Face = 'regular' | 'medium' | 'black';

export function PText({
  face = 'regular',
  size,
  color = poster.ink,
  leading = 1.5,
  track = 0,
  style,
  ...rest
}: TextProps & {
  face?: Face;
  size: number;
  color?: string;
  leading?: number;
  track?: number;
}) {
  const s: TextStyle = {
    ...fonts[face],
    fontSize: size,
    lineHeight: Math.round(size * leading),
    letterSpacing: track * size,
    color,
  };
  return <RNText {...rest} style={[s, style]} />;
}

/** A display heading (h1 / h2) in the black weight, tight. */
export function PHeading({
  level,
  size,
  color = poster.ink,
  style,
  children,
  ...rest
}: TextProps & { level: 1 | 2 | 3; size: number; color?: string }) {
  return (
    <PText {...rest} face="black" size={size} color={color} leading={0.92} track={-0.04} role="heading" aria-level={level} style={style}>
      {children}
    </PText>
  );
}

/** The page's one button: a solid square block. Link-safe (styles go through `boxStyle`). */
export function PButton({
  label,
  bg,
  fg,
  size,
  boxStyle,
  style: _style,
  ...rest
}: Omit<PressableProps, 'children'> & {
  label: string;
  bg: string;
  fg: string;
  size: number;
  boxStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed, hovered }) => [
        {
          backgroundColor: bg,
          minHeight: 48,
          paddingHorizontal: 22,
          justifyContent: 'center',
          alignItems: 'center',
          ...web({
            transitionProperty: 'transform, opacity',
            transitionDuration: '160ms',
            cursor: 'pointer',
          }),
        },
        hovered && { transform: [{ translateY: -2 }] },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
        boxStyle,
      ]}
    >
      <PText face="medium" size={size} color={fg} leading={1.2}>
        {label}
      </PText>
    </Pressable>
  );
}

/** Web-only style values (sticky, transitions, cursor …); nothing on native. */
export function web(style: Record<string, unknown>): ViewStyle {
  return (Platform.OS === 'web' ? style : {}) as ViewStyle;
}

/** `data-*` attributes on web (e.g. data-ui on real interface fragments). */
export function dataSet(values: Record<string, string>): object {
  return Platform.OS === 'web' ? { dataSet: values } : {};
}

let reducedMotion = false;
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} else {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      reducedMotion = value;
    })
    .catch(() => {});
}
export const prefersReducedMotion = () => reducedMotion;

/**
 * Entrance: rises 24px and fades in once when it enters the viewport, `delay` ms after its
 * neighbours (stagger the heading, the text, then the picture). Web only; native renders in place.
 * Never leaves content hidden: without IntersectionObserver, or with reduced motion, it shows at once.
 */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<unknown>(null);
  const canAnimate = Platform.OS === 'web' && typeof window !== 'undefined' && 'IntersectionObserver' in window && !prefersReducedMotion();
  const [shown, setShown] = useState(!canAnimate);

  useEffect(() => {
    if (!canAnimate) return;
    const node = ref.current as unknown as Element | null;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canAnimate]);

  return (
    <View
      ref={ref as never}
      style={[
        canAnimate &&
          web({
            transitionProperty: 'opacity, transform',
            transitionDuration: '700ms',
            transitionTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            transitionDelay: `${delay}ms`,
          }),
        { opacity: shown ? 1 : 0, transform: [{ translateY: shown ? 0 : 24 }] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Chapter colours: the ground of a field and the ink that reads on it. */
export interface Chapter {
  ground: string;
  ink: string;
  /** The header's action on this chapter. */
  action: { bg: string; fg: string };
}

export const CHAPTERS = {
  bone: {
    ground: poster.bone,
    ink: poster.ink,
    action: { bg: poster.green, fg: poster.ink },
  },
  red: {
    ground: poster.red,
    ink: poster.ink,
    action: { bg: poster.ink, fg: poster.bone },
  },
  black: {
    ground: poster.black,
    ink: poster.paper,
    action: { bg: poster.green, fg: poster.ink },
  },
  green: {
    ground: poster.green,
    ink: poster.ink,
    action: { bg: poster.ink, fg: poster.bone },
  },
  yellow: {
    ground: poster.yellow,
    ink: poster.ink,
    action: { bg: poster.ink, fg: poster.bone },
  },
} satisfies Record<string, Chapter>;

export type ChapterName = keyof typeof CHAPTERS;
