import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { MAX_CONTENT_WIDTH, radius, spacing, usePalette } from '@/theme';

import { Text } from './ui/text';

/** Web navigation: a top bar with the brand and tab links. */
export default function AppTabs() {
  const palette = usePalette();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const compact = width < 560;

  return (
    <Tabs style={styles.root}>
      <View style={[styles.bar, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
        <View style={styles.inner}>
          <Text variant="subheading" style={styles.brand} numberOfLines={1} accessibilityLabel={t('app.name')}>
            <Text variant="subheading" tone="primary">
              ⚓
            </Text>
            {compact ? '' : ` ${t('app.name')}`}
          </Text>
          <TabList style={styles.list}>
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
          </TabList>
        </View>
      </View>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

// `ref` is dropped on purpose: expo-router/ui types it for a different View type than RN 0.88,
// and the trigger only needs onPress/href, which arrive through `props`.
function TabButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  const palette = usePalette();
  return (
    <Pressable
      {...props}
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
