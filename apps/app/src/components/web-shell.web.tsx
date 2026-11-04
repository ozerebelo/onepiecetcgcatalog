import { Link, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/providers/auth';
import { SHELL_SHEET_INSET, SHELL_SIDEBAR_WIDTH, WIDE_BREAKPOINT, fonts, radius, spacing, usePalette } from '@/theme';

import { Logo } from './brand/logo';
import { Icon, type IconName } from './ui/icon';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

const NAV: { href: Href; key: string; icon: IconName; match: (path: string) => boolean; signedIn?: boolean }[] = [
  { href: '/', key: 'tabs.home', icon: 'home', match: (p) => p === '/', signedIn: true },
  { href: '/cards', key: 'tabs.cards', icon: 'layers', match: (p) => p.startsWith('/card') },
  { href: '/sets', key: 'tabs.sets', icon: 'grid', match: (p) => p.startsWith('/set') },
  { href: '/collection', key: 'tabs.collection', icon: 'book-open', match: (p) => p.startsWith('/collection') },
  { href: '/decks', key: 'tabs.decks', icon: 'copy', match: (p) => p.startsWith('/deck') },
];

/**
 * The website's frame on wide screens ("framed sheet"): a stone frame holds the navigation on the
 * left, and every screen — tab screens and the pages pushed on top of them — sits on one white sheet
 * inset beside it. Phones keep the bottom tab bar (app-tabs.web.tsx); the signed-out home page is a
 * full-bleed landing page with its own header.
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
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      {framed ? <Sidebar pathname={pathname} /> : null}
      <View style={[styles.flex, framed && [styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]]}>
        {children}
      </View>
    </View>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const name = (user?.user_metadata?.display_name as string | undefined) || user?.email || '';

  return (
    <View style={styles.sidebar} role="navigation">
      <Link href="/" asChild>
        <PressableArea accessibilityRole="link" accessibilityLabel="Nakama Binder" boxStyle={styles.brand}>
          <Logo size={26} />
        </PressableArea>
      </Link>
      <View style={styles.nav}>
        {NAV.filter((item) => !item.signedIn || user).map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.key} href={item.href} asChild>
              <PressableArea
                accessibilityRole="link"
                accessibilityLabel={t(item.key)}
                aria-current={active ? 'page' : undefined}
                boxStyle={[styles.item, active && { backgroundColor: palette.surfaceAlt }]}
                activeStyle={{ backgroundColor: palette.surfaceAlt }}>
                <Icon name={item.icon} size={16} color={active ? palette.text : palette.textSecondary} />
                <Text style={{ ...(active ? fonts.semibold : fonts.medium), fontSize: 14, color: active ? palette.text : palette.textSecondary }}>
                  {t(item.key)}
                </Text>
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
            aria-current={pathname.startsWith('/account') ? 'page' : undefined}
            boxStyle={[styles.item, pathname.startsWith('/account') && { backgroundColor: palette.surfaceAlt }]}
            activeStyle={{ backgroundColor: palette.surfaceAlt }}>
            <View style={[styles.avatar, { backgroundColor: palette.text }]}>
              <Text style={{ ...fonts.semibold, fontSize: 12, color: palette.surface }}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text variant="body" weight="medium" numberOfLines={1} style={styles.flex}>
              {name}
            </Text>
          </PressableArea>
        </Link>
      ) : (
        <View style={styles.signedOut}>
          <Link href="/auth/sign-in" asChild>
            <PressableArea
              accessibilityRole="link"
              boxStyle={[styles.signIn, { backgroundColor: palette.primary }]}
              activeStyle={{ backgroundColor: palette.primaryPressed }}>
              <Text style={{ ...fonts.semibold, fontSize: 14, color: palette.onPrimary }}>{t('account.signIn')}</Text>
            </PressableArea>
          </Link>
          <Link href="/auth/sign-up" asChild>
            <PressableArea accessibilityRole="link" boxStyle={styles.item} activeStyle={{ backgroundColor: palette.surfaceAlt }}>
              <Text variant="body" weight="medium" tone="secondary">
                {t('account.signUp')}
              </Text>
            </PressableArea>
          </Link>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  sheet: { marginTop: SHELL_SHEET_INSET, marginRight: SHELL_SHEET_INSET, marginBottom: SHELL_SHEET_INSET, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  sidebar: { width: SHELL_SIDEBAR_WIDTH, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  brand: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  nav: { gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  signedOut: { gap: spacing.xs },
  signIn: { minHeight: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
