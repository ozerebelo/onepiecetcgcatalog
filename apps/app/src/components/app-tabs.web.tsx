import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { MAX_CONTENT_WIDTH, radius, spacing, usePalette } from '@/theme';

import { Text } from './ui/text';

/**
 * Web navigation: a top bar with the brand and tab links.
 *
 * Structure matters: expo-router/ui only registers tabs whose <TabTrigger>s are the direct
 * children of <TabList> (or of TabList's single `asChild` child), and <TabList> must be a
 * direct child of <Tabs>. If triggers are wrapped in other views they render fine but clicks
 * silently do nothing. The bar layout therefore lives in <TopBar>, the asChild of TabList.
 */
export default function AppTabs() {
  const { t } = useTranslation();

  return (
    <Tabs style={styles.root}>
      <TabList asChild>
        <TopBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>{t('tabs.cards')}</TabButton>
          </TabTrigger>
          <TabTrigger name="sets" href="/sets" asChild>
            <TabButton>{t('tabs.sets')}</TabButton>
          </TabTrigger>
          <TabTrigger name="collection" href="/collection" asChild>
            <TabButton>{t('tabs.collection')}</TabButton>
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <TabButton>{t('tabs.account')}</TabButton>
          </TabTrigger>
        </TopBar>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

// TabList passes its own props (role, style) through; `style` is ignored on purpose so the
// bar keeps its layout (see the Link/Slot note in components/ui/pressable-area.tsx).
function TopBar({ children, style: _style, ...rest }: TabListProps) {
  const palette = usePalette();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const compact = width < 560;

  return (
    <View {...rest} style={[styles.bar, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
      <View style={styles.inner}>
        <Text variant="subheading" style={styles.brand} numberOfLines={1} accessibilityLabel={t('app.name')}>
          <Text variant="subheading" tone="primary">
            ⚓
          </Text>
          {compact ? '' : ` ${t('app.name')}`}
        </Text>
        <View style={styles.list}>{children}</View>
      </View>
    </View>
  );
}

// `ref` is dropped on purpose: expo-router/ui types it for a different View type than RN 0.88,
// and the trigger only needs onPress/href, which arrive through `props`.
function TabButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  const palette = usePalette();
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={({ pressed }) => [
        styles.tab,
        isFocused && { backgroundColor: palette.surfaceAlt },
        pressed && { opacity: 0.7 },
      ]}>
      <Text variant="caption" tone={isFocused ? 'default' : 'secondary'} style={{ fontWeight: '700' }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  brand: { flexShrink: 1, marginRight: 'auto' },
  list: { flexDirection: 'row', gap: spacing.xs },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  slot: { flex: 1 },
});
