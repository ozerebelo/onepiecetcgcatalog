import { Link, router, usePathname, type Href, type NativeStackHeaderProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/providers/auth';
import { MAX_CONTENT_WIDTH, WIDE_BREAKPOINT, fonts, radius, spacing, usePalette } from '@/theme';

import { Logo } from './brand/logo';
import { Icon } from './ui/icon';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

const LINKS: { href: Href; key: string; match: string }[] = [
  { href: '/cards', key: 'tabs.cards', match: '/card' },
  { href: '/sets', key: 'tabs.sets', match: '/set' },
  { href: '/collection', key: 'tabs.collection', match: '/collection' },
  { href: '/decks', key: 'tabs.decks', match: '/deck' },
];

/**
 * Website header for pages opened on top of the tabs (card, set, deck, import, auth).
 * Wide screens keep the full site navigation plus a back button and the page title;
 * phones get a compact back + title bar, like the native apps.
 */
export function WebStackHeader({ options, back }: NativeStackHeaderProps) {
  const { t } = useTranslation();
  const palette = usePalette();
  const pathname = usePathname();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const title = typeof options.title === 'string' ? options.title : '';

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const backRow = (
    <View style={styles.backRow}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={({ hovered }) => [styles.backButton, hovered && { backgroundColor: palette.surfaceAlt }]}>
        <Icon name="arrow-left" size={18} />
        {wide ? (
          <Text variant="caption" weight="semibold">
            {back?.title || t('common.back')}
          </Text>
        ) : null}
      </Pressable>
      {title ? (
        <Text variant={wide ? 'caption' : 'subheading'} tone={wide ? 'secondary' : 'default'} numberOfLines={1} style={styles.flex}>
          {title}
        </Text>
      ) : null}
    </View>
  );

  if (!wide) {
    return <View style={[styles.compact, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>{backRow}</View>;
  }

  return (
    <View style={[styles.bar, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
      <View style={styles.inner}>
        <Link href="/" asChild>
          <PressableArea accessibilityRole="link" accessibilityLabel="Nakama Binder">
            <Logo size={30} />
          </PressableArea>
        </Link>
        <View style={styles.links}>
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.match);
            return (
              <Link key={link.key} href={link.href} asChild>
                <PressableArea
                  accessibilityRole="link"
                  boxStyle={[styles.link, active && { backgroundColor: palette.surface }]}
                  activeStyle={{ backgroundColor: palette.surfaceAlt }}>
                  <Text style={{ fontFamily: active ? fonts.semibold : fonts.medium, fontSize: 14, color: active ? palette.text : palette.textSecondary }}>
                    {t(link.key)}
                  </Text>
                </PressableArea>
              </Link>
            );
          })}
        </View>
        <View style={styles.flex} />
        <Link href={user ? '/account' : '/auth/sign-in'} asChild>
          <PressableArea
            accessibilityRole="link"
            accessibilityLabel={user ? t('tabs.account') : t('account.signIn')}
            boxStyle={user ? [styles.avatar, { backgroundColor: palette.primarySoft }] : [styles.signIn, { backgroundColor: palette.primary }]}>
            <Text style={{ color: user ? palette.primary : palette.onPrimary, fontFamily: fonts.semibold, fontSize: 14 }}>
              {user
                ? ((user.user_metadata?.display_name as string | undefined) || user.email || '?').slice(0, 1).toUpperCase()
                : t('account.signIn')}
            </Text>
          </PressableArea>
        </Link>
      </View>
      <View style={[styles.inner, styles.subRow]}>{backRow}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    height: 64,
  },
  subRow: { height: 44 },
  links: { flexDirection: 'row', gap: spacing.xs },
  link: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  flex: { flex: 1 },
  signIn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  compact: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, height: 56, justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md },
});
