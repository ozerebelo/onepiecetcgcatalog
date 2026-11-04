import { useQuery } from '@tanstack/react-query';
import { Link, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo';
import { Footer, Closing } from '@/components/landing/closing';
import { DeckCheck } from '@/components/landing/deck-check';
import { HEADER_HEIGHT, Hero } from '@/components/landing/hero';
import { CHAPTERS, PButton, PText, usePosterLayout, web, type ChapterName, type PosterLayout } from '@/components/landing/kit';
import { SetList } from '@/components/landing/set-list';
import { Sheets } from '@/components/landing/sheets';
import { Showcase } from '@/components/landing/showcase';
import { PressableArea } from '@/components/ui/pressable-area';
import { LoadingView } from '@/components/ui/state-views';
import { fetchCatalogStats, fetchLanding } from '@/lib/api';
import { poster } from '@/theme';

interface Mark {
  y: number;
  chapter: ChapterName;
}

/**
 * Public home page for visitors who aren't signed in: "colour chapters". Every section is a flat
 * field in one of the game's card colours; the fixed header takes the colours of the chapter under it.
 */
export function Landing() {
  const { i18n } = useTranslation();
  const layout = usePosterLayout();
  const landing = useQuery({
    queryKey: ['landing'],
    queryFn: fetchLanding,
    staleTime: 60 * 60 * 1000,
  });
  const stats = useQuery({
    queryKey: ['catalog-stats'],
    queryFn: fetchCatalogStats,
    staleTime: 60 * 60 * 1000,
  });
  const n = (value: number | undefined) => (value == null ? '—' : value.toLocaleString(i18n.language));
  const [scrollY] = useState(() => new Animated.Value(0));

  // Where each chapter starts. Sections report their HEIGHTS (react-native-web only reports layout
  // when an element's size changes, so offsets would go stale) and offsets are summed in page order.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [inner, setInner] = useState<Record<string, number>>({});
  const measure = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setHeights((m) => (m[key] === h ? m : { ...m, [key]: h }));
    },
    [],
  );
  const setInnerMark = useCallback((key: string, y: number) => {
    setInner((m) => (m[key] === y ? m : { ...m, [key]: y }));
  }, []);
  const ordered = useMemo(() => {
    const out: Mark[] = [];
    let y = 0;
    const sections: [string, ChapterName][] = [
      ['hero', 'bone'],
      ['showcase', 'black'],
      ['check', 'green'],
      ['sets', 'yellow'],
      ['sheets', 'bone'],
      ['closing', 'bone'],
    ];
    for (const [key, chapter] of sections) {
      out.push({ y, chapter });
      if (key === 'hero' && inner.seam != null) out.push({ y: y + inner.seam, chapter: 'red' });
      y += heights[key] ?? 0;
    }
    return out.sort((a, b) => a.y - b.y);
  }, [heights, inner]);

  const data = landing.data;
  const fixedHeader = Platform.OS === 'web';
  useDocumentScroll(scrollY);

  return (
    <View style={styles.root}>
      <Scroller
        style={styles.root}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {!fixedHeader ? <LandingHeader layout={layout} chapter="bone" /> : null}
        <View onLayout={measure('hero')}>
          <Hero
            layout={layout}
            cards={(data?.cards ?? [])
              .filter((c) => c.colors.includes('Red'))
              .concat(data?.cards ?? [])
              .slice(0, 7)}
            cardCount={n(stats.data?.cards)}
            onSeam={(seam) => setInnerMark('seam', seam)}
          />
        </View>
        {!data ? (
          <View style={{ height: 400, backgroundColor: poster.black }}>{landing.isLoading ? <LoadingView /> : null}</View>
        ) : (
          <>
            <View onLayout={measure('showcase')}>
              <Showcase layout={layout} printings={data.showcase} offset={heights.hero ?? 0} scrollY={scrollY} />
            </View>
            <View onLayout={measure('check')}>
              <DeckCheck layout={layout} cards={data.cards} />
            </View>
            <View onLayout={measure('sets')}>
              <SetList layout={layout} sets={data.sets} />
            </View>
            <View onLayout={measure('sheets')}>
              <Sheets layout={layout} cards={data.cards} showcase={data.showcase} />
            </View>
          </>
        )}
        <View onLayout={measure('closing')}>
          <Closing layout={layout} />
          <Footer
            layout={layout}
            stats={{
              cards: n(stats.data?.cards),
              printings: n(stats.data?.printings),
              sets: n(stats.data?.sets),
            }}
          />
        </View>
      </Scroller>
      {fixedHeader ? <FixedHeader layout={layout} scrollY={scrollY} marks={ordered} /> : null}
    </View>
  );
}

/**
 * On web the landing scrolls the document itself (not an inner scroll view): browsers then collapse
 * their address bar, restore the position on back, and sticky / fixed parts work against the window.
 */
const Scroller = (Platform.OS === 'web' ? View : Animated.ScrollView) as typeof Animated.ScrollView;

function useDocumentScroll(scrollY: Animated.Value) {
  const pathname = usePathname();
  const active = Platform.OS === 'web' && pathname === '/' && typeof document !== 'undefined';
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = 'visible';
    const onScroll = () => scrollY.setValue(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.scrollTo(0, 0);
      body.style.overflow = previous;
    };
  }, [active, scrollY]);
}

/** The header follows the chapter beneath it, switching colours as each edge passes under it. */
function FixedHeader({ layout, scrollY, marks }: { layout: PosterLayout; scrollY: Animated.Value; marks: Mark[] }) {
  const [chapter, setChapter] = useState<ChapterName>('bone');
  useEffect(() => {
    const pick = (y: number) => {
      const probe = y + HEADER_HEIGHT / 2;
      let current: ChapterName = 'bone';
      for (const m of marks) if (m.y <= probe) current = m.chapter;
      setChapter(current);
    };
    const id = scrollY.addListener(({ value }) => pick(value));
    pick((scrollY as unknown as { _value: number })._value ?? 0);
    return () => scrollY.removeListener(id);
  }, [marks, scrollY]);
  return (
    <View style={[styles.fixed, web({ position: 'fixed' })]}>
      <LandingHeader layout={layout} chapter={chapter} />
    </View>
  );
}

function LandingHeader({ layout, chapter }: { layout: PosterLayout; chapter: ChapterName }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const c = CHAPTERS[chapter];
  const { phone, wide, margin } = layout;
  const compact = !wide;
  const transition = web({
    transitionProperty: 'background-color, color',
    transitionDuration: '300ms',
  });
  const links = [
    { href: '/cards' as const, label: t('tabs.cards') },
    { href: '/decks' as const, label: t('tabs.decks') },
    { href: '/auth/sign-in' as const, label: t('account.signIn') },
  ];

  return (
    <View
      style={[
        {
          backgroundColor: c.ground,
          paddingTop: Platform.OS === 'web' ? 0 : insets.top,
        },
        transition,
      ]}
      role="banner"
    >
      <View style={[styles.bar, { paddingHorizontal: margin }]}>
        <Link href="/" asChild>
          <PressableArea accessibilityRole="link" aria-label="Nakama Binder" boxStyle={styles.brand}>
            <LogoMark size={28} />
            <PText face="black" size={layout.size.lead} leading={1} track={-0.03} color={c.ink} style={transition}>
              Nakama Binder
            </PText>
          </PressableArea>
        </Link>
        <View style={styles.flex} />
        {compact ? (
          <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" aria-expanded={open} style={styles.menu}>
            <PText face="medium" size={layout.size.small} color={c.ink} style={transition}>
              {open ? t('landing.close') : t('landing.menu')}
            </PText>
          </Pressable>
        ) : (
          <View style={styles.links} role="navigation">
            {links.map((l) => (
              <Link key={l.href} href={l.href} asChild>
                <PressableArea accessibilityRole="link" boxStyle={styles.link} activeStyle={{ opacity: 0.6 }}>
                  <PText face="medium" size={layout.size.small} color={c.ink} style={transition}>
                    {l.label}
                  </PText>
                </PressableArea>
              </Link>
            ))}
          </View>
        )}
        <Link href="/auth/sign-up" asChild>
          <PButton
            label={phone ? t('landing.ctaShort') : t('landing.ctaPrimary')}
            bg={c.action.bg}
            fg={c.action.fg}
            size={layout.size.small}
            boxStyle={[{ minHeight: 42, paddingHorizontal: phone ? 14 : 18 }, transition]}
          />
        </Link>
      </View>
      {compact && open ? (
        <View style={[styles.sheet, { paddingHorizontal: margin }]} role="navigation">
          {links.map((l) => (
            <Link key={l.href} href={l.href} asChild>
              <PressableArea accessibilityRole="link" onPress={() => setOpen(false)} boxStyle={styles.sheetLink}>
                <PText face="black" size={layout.size.title} leading={1.1} color={c.ink}>
                  {l.label}
                </PText>
              </PressableArea>
            </Link>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: poster.bone },
  fixed: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  menu: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  sheet: { paddingBottom: 24, gap: 6 },
  sheetLink: { paddingVertical: 8 },
});
