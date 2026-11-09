import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Children, isValidElement, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth';
import { MAX_CONTENT_WIDTH, WIDE_BREAKPOINT, fonts, radius, spacing, usePalette } from '@/theme';

import { APP_NAME, Logo } from './brand/logo';
import { Icon, type IconName } from './ui/icon';
import { Text } from './ui/text';

/**
 * Web navigation.
 *  - Wide screens: a top bar — logo (home), section links, account button.
 *  - Phones: an app-style bottom bar with icons.
 *
 * Structure matters: expo-router/ui only registers tabs whose <TabTrigger>s are the direct
 * children of <TabList> (or of TabList's single `asChild` child), and <TabList> must be a
 * direct child of <Tabs>. If triggers are wrapped in other views they render fine but clicks
 * silently do nothing. Layout therefore lives in <NavBar>, the asChild of TabList, which
 * receives the triggers as its children.
 */
export default function AppTabs() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <Tabs style={styles.root}>
      <TabList asChild>
        <NavBar>
          <TabTrigger name="index" href="/" asChild>
            <HomeButton label={t('tabs.home')} />
          </TabTrigger>
          <TabTrigger name="cards" href="/cards" asChild>
            <NavButton icon="layers" label={t('tabs.cards')} />
          </TabTrigger>
          {/* Sets live on the Cards page now; /sets only redirects there. The trigger stays registered. */}
          <TabTrigger name="sets" href="/sets" asChild>
            <NavButton icon="grid" label={t('tabs.sets')} hidden />
          </TabTrigger>
          <TabTrigger name="collection" href="/collection" asChild>
            <NavButton icon="book-open" label={t('tabs.collection')} />
          </TabTrigger>
          <TabTrigger name="decks" href="/decks" asChild>
            <NavButton icon="copy" label={t('tabs.decks')} />
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <AccountButton label={t('tabs.account')} />
          </TabTrigger>
        </NavBar>
      </TabList>
      <TabSlot style={[styles.slot, !wide && { paddingBottom: 64 + insets.bottom }]} />
    </Tabs>
  );
}

// TabList passes its own props (role, style); `style` is ignored on purpose so the bar keeps
// its layout (see the Link/Slot note in components/ui/pressable-area.tsx).
function NavBar({ children, style: _style, ...rest }: TabListProps) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE_BREAKPOINT;
  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const [home, ...others] = items;
  const account = others.pop();

  if (!wide) {
    return (
      <View
        {...rest}
        style={[
          styles.bottomBar,
          { backgroundColor: palette.surface, borderTopColor: palette.border, paddingBottom: insets.bottom },
        ]}>
        {home}
        {others}
        {account}
      </View>
    );
  }

  return (
    <View {...rest} style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.rule }]}>
      <View style={styles.topInner}>
        {home}
        <View style={styles.links}>{others}</View>
        <View style={styles.spacer} />
        {account}
      </View>
    </View>
  );
}

type ButtonProps = TabTriggerSlotProps & { label: string };

function useWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

// `ref` is dropped on purpose: expo-router/ui types it for a different View type than RN 0.88,
// and the trigger only needs onPress/href, which arrive through `props`.
function HomeButton({ isFocused, label, ref: _ref, children: _children, ...props }: ButtonProps) {
  const wide = useWide();
  if (!wide) return <CompactItem icon="home" label={label} isFocused={isFocused} {...props} />;
  return (
    <Pressable {...props} accessibilityRole="link" accessibilityLabel={APP_NAME} style={styles.logoButton}>
      <Logo size={28} />
    </Pressable>
  );
}

function NavButton({
  isFocused,
  label,
  icon,
  hidden = false,
  ref: _ref,
  children: _children,
  ...props
}: ButtonProps & { icon: IconName; hidden?: boolean }) {
  const palette = usePalette();
  const wide = useWide();
  if (hidden) return null;
  if (!wide) return <CompactItem icon={icon} label={label} isFocused={isFocused} {...props} />;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={styles.link}>
      {({ hovered }) => (
        <>
          {/* The current section is marked with a highlighter stroke behind its name. */}
          {isFocused || hovered ? (
            <View style={[styles.marker, { backgroundColor: isFocused ? palette.highlight : palette.primarySoft }]} />
          ) : null}
          <Text
            style={{
              fontFamily: isFocused ? fonts.semibold : fonts.medium,
              fontSize: 15,
              color: isFocused ? palette.onHighlight : palette.textSecondary,
            }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function AccountButton({ isFocused, label, ref: _ref, children: _children, ...props }: ButtonProps) {
  const palette = usePalette();
  const wide = useWide();
  const { user } = useAuth();
  const { t } = useTranslation();
  if (!wide) return <CompactItem icon="user" label={label} isFocused={isFocused} {...props} />;

  if (!user) {
    return (
      <Pressable
        {...props}
        accessibilityRole="link"
        style={({ hovered }) => [styles.signIn, { backgroundColor: hovered ? palette.primaryPressed : palette.primary }]}>
        <Text style={{ color: palette.onPrimary, fontFamily: fonts.semibold, fontSize: 14 }}>{t('account.signIn')}</Text>
      </Pressable>
    );
  }
  const name = (user.user_metadata?.display_name as string | undefined) || user.email || '?';
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={({ hovered }) => [
        styles.avatar,
        { borderColor: palette.text, backgroundColor: isFocused ? palette.highlight : hovered ? palette.primarySoft : 'transparent' },
      ]}>
      <Text style={{ color: isFocused ? palette.onHighlight : palette.text, fontFamily: fonts.monoBold, fontSize: 15 }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </Pressable>
  );
}

function CompactItem({
  icon,
  label,
  isFocused,
  ref: _ref,
  ...props
}: { icon: IconName; label: string; isFocused?: boolean } & Omit<ButtonProps, 'label'>) {
  const palette = usePalette();
  const color = isFocused ? palette.text : palette.textMuted;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={styles.compactItem}>
      {isFocused ? <View style={[styles.compactMarker, { backgroundColor: palette.highlight }]} /> : null}
      <Icon name={icon} size={20} color={color} />
      <Text style={{ color, fontFamily: isFocused ? fonts.semibold : fonts.medium, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1 },
  topBar: { borderBottomWidth: 2, position: 'sticky' as 'relative', top: 0, zIndex: 10 },
  topInner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    height: 64,
  },
  logoButton: { paddingVertical: spacing.xs },
  links: { flexDirection: 'row', gap: spacing.md },
  spacer: { flex: 1 },
  link: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, justifyContent: 'center' },
  // Highlighter stroke behind the whole word (the text on it is always ink).
  marker: { position: 'absolute', left: -4, right: -4, top: 6, bottom: 6, borderRadius: 2 },
  signIn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  avatar: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compactItem: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
  compactMarker: { position: 'absolute', top: 0, left: '28%', right: '28%', height: 3 },
});
