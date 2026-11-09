import { Link, router, usePathname, type Href, type NativeStackHeaderProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/providers/auth';
import { MAX_CONTENT_WIDTH, WIDE_BREAKPOINT, fonts, radius, spacing, usePalette } from '@/theme';

import { APP_NAME, Logo } from './brand/logo';
import { Icon } from './ui/icon';
import { PressableArea } from './ui/pressable-area';
import { Text } from './ui/text';

const LINKS: { href: Href; key: string; match: string[] }[] = [
  { href: '/cards', key: 'tabs.cards', match: ['/card', '/set'] },
  { href: '/collection', key: 'tabs.collection', match: ['/collection'] },
  { href: '/decks', key: 'tabs.decks', match: ['/deck', '/meta'] },
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
  // Route groups such as "(tabs)" are not page names; fall back to plain "Back".
  const backLabel = back?.title && !back.title.startsWith('(') ? back.title : t('common.back');

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
            {backLabel}
          </Text>
        ) : null}
      </Pressable>
      {title ? (
        <Text
          variant={wide ? 'caption' : 'subheading'}
          tone={wide ? 'secondary' : 'default'}
          numberOfLines={1}
          style={styles.flex}>
          {title}
        </Text>
      ) : null}
    </View>
  );

  if (!wide) {
    return (
      <View style={[styles.compact, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>{backRow}</View>
    );
  }

  return (
    <View style={[styles.bar, { backgroundColor: palette.background, borderBottomColor: palette.rule }]}>
      <View style={styles.inner}>
        <Link href="/" asChild>
          <PressableArea accessibilityRole="link" accessibilityLabel={APP_NAME}>
            <Logo size={28} />
          </PressableArea>
        </Link>
        <View style={styles.links}>
          {LINKS.map((link) => {
            const active = link.match.some((m) => pathname.startsWith(m));
            return (
              <Link key={link.key} href={link.href} asChild>
                <PressableArea accessibilityRole="link" boxStyle={styles.link}>
                  {active ? <View style={[styles.marker, { backgroundColor: palette.highlight }]} /> : null}
                  <Text
                    style={{
                      fontFamily: active ? fonts.semibold : fonts.medium,
                      fontSize: 15,
                      color: active ? palette.onHighlight : palette.textSecondary,
                    }}>
                    {t(link.key)}
                  </Text>
                </PressableArea>
              </Link>
            );
          })}
        </View>
        <View style={styles.flex} />
        {/* No "Sign in" button on the sign-in / sign-up pages themselves. */}
        {user || !pathname.startsWith('/auth') ? (
          <Link href={user ? '/account' : '/auth/sign-in'} asChild>
            <PressableArea
              accessibilityRole="link"
              accessibilityLabel={user ? t('tabs.account') : t('account.signIn')}
              boxStyle={
                user ? [styles.avatar, { borderColor: palette.text }] : [styles.signIn, { backgroundColor: palette.primary }]
              }>
              <Text
                style={{
                  color: user ? palette.text : palette.onPrimary,
                  fontFamily: user ? fonts.monoBold : fonts.semibold,
                  fontSize: user ? 15 : 14,
                }}>
                {user
                  ? ((user.user_metadata?.display_name as string | undefined) || user.email || '?').slice(0, 1).toUpperCase()
                  : t('account.signIn')}
              </Text>
            </PressableArea>
          </Link>
        ) : null}
      </View>
      <View style={[styles.inner, styles.subRow]}>{backRow}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 2 },
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
  links: { flexDirection: 'row', gap: spacing.md },
  link: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, justifyContent: 'center' },
  marker: { position: 'absolute', left: -4, right: -4, top: 6, bottom: 6, borderRadius: 2 },
  flex: { flex: 1 },
  signIn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  avatar: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  compact: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, height: 56, justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
});
