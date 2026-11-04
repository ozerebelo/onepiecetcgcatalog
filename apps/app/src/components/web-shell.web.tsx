import { Link, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/providers/auth';
import { MAX_CONTENT_WIDTH, WIDE_BREAKPOINT, fonts, radius, spacing, usePalette } from '@/theme';

import { Logo } from './brand/logo';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

/** Site navigation (wide web). Keep in sync with the phone tab bar in app-tabs.web.tsx. */
const NAV: { href: Href; key: string; match: (path: string) => boolean }[] = [
  { href: '/cards', key: 'tabs.cards', match: (p) => p.startsWith('/card') || p.startsWith('/set') },
  { href: '/collection', key: 'tabs.collection', match: (p) => p.startsWith('/collection') },
  { href: '/decks', key: 'tabs.decks', match: (p) => p.startsWith('/deck') },
];

export const TOP_BAR_HEIGHT = 60;

/**
 * The website's frame on wide screens: one top bar (logo → home, the sections, the account) over a
 * full-width white page. It is shared by the tab screens and the pages pushed on top of them.
 * Phones keep the bottom tab bar (app-tabs.web.tsx); the signed-out home page is a full-bleed
 * landing page with its own header.
 *
 * `children` always renders at the same position in the tree so navigation state survives resizes.
 */
export function WebShell({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const pathname = usePathname();
  const { user, initializing } = useAuth();
  const { width } = useWindowDimensions();
  const landing = pathname === '/' && !user && !initializing;
  const framed = width >= WIDE_BREAKPOINT && !landing;

  return (
    <View style={[styles.root, { backgroundColor: palette.surface }]}>
      {framed ? <TopBar pathname={pathname} /> : null}
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

function TopBar({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const name = (user?.user_metadata?.display_name as string | undefined) || user?.email || '';

  return (
    <View style={[styles.bar, { backgroundColor: palette.background, borderBottomColor: palette.border }]} role="navigation">
      <View style={styles.inner}>
        <Link href="/" asChild>
          <PressableArea accessibilityRole="link" accessibilityLabel={t('tabs.home')} boxStyle={styles.brand}>
            <Logo size={28} />
          </PressableArea>
        </Link>
        <View style={styles.links}>
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link key={item.key} href={item.href} asChild>
                <PressableArea
                  accessibilityRole="link"
                  accessibilityLabel={t(item.key)}
                  aria-current={active ? 'page' : undefined}
                  boxStyle={styles.link}
                  activeStyle={{ opacity: 0.7 }}
                >
                  <Text
                    style={{
                      ...(active ? fonts.semibold : fonts.medium),
                      fontSize: 15,
                      color: active ? palette.text : palette.textSecondary,
                    }}
                  >
                    {t(item.key)}
                  </Text>
                  {active ? <View style={[styles.underline, { backgroundColor: palette.brand }]} /> : null}
                </PressableArea>
              </Link>
            );
          })}
        </View>
        <View style={styles.flex} />
        {user ? (
          <Link href="/account" asChild>
            <PressableArea
              accessibilityRole="link"
              accessibilityLabel={t('tabs.account')}
              boxStyle={[styles.account, pathname.startsWith('/account') && { backgroundColor: palette.surfaceAlt }]}
              activeStyle={{ backgroundColor: palette.surfaceAlt }}
            >
              <View style={[styles.avatar, { backgroundColor: palette.brand }]}>
                <Text style={{ ...fonts.semibold, fontSize: 13, color: '#FFFFFF' }}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text variant="body" weight="medium" numberOfLines={1} style={styles.name}>
                {name}
              </Text>
            </PressableArea>
          </Link>
        ) : (
          <View style={styles.signedOut}>
            <Link href="/auth/sign-in" asChild>
              <PressableArea accessibilityRole="link" boxStyle={styles.link} activeStyle={{ opacity: 0.7 }}>
                <Text style={{ ...fonts.medium, fontSize: 15, color: palette.text }}>{t('account.signIn')}</Text>
              </PressableArea>
            </Link>
            <Link href="/auth/sign-up" asChild>
              <PressableArea
                accessibilityRole="link"
                boxStyle={[styles.signUp, { backgroundColor: palette.primary }]}
                activeStyle={{ backgroundColor: palette.primaryPressed }}
              >
                <Text style={{ ...fonts.semibold, fontSize: 14, color: palette.onPrimary }}>{t('account.signUp')}</Text>
              </PressableArea>
            </Link>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  bar: { height: TOP_BAR_HEIGHT, borderBottomWidth: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  brand: { paddingVertical: spacing.xs },
  links: { flexDirection: 'row', alignSelf: 'stretch', gap: spacing.xs },
  link: { justifyContent: 'center', paddingHorizontal: spacing.md },
  underline: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 0, height: 2 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    maxWidth: 240,
  },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { flexShrink: 1 },
  signedOut: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  signUp: { minHeight: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, justifyContent: 'center' },
});
