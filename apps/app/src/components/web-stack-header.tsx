import { router, type NativeStackHeaderProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { WIDE_BREAKPOINT, radius, spacing, usePalette } from '@/theme';

import { Icon } from './ui/icon';
import { Text } from './ui/text';

/**
 * Website header for pages opened on top of the tabs (card, set, deck, import, auth): a back button
 * and the page title. The site navigation itself is the web shell's sidebar.
 */
export function WebStackHeader({ options, back }: NativeStackHeaderProps) {
  const { t } = useTranslation();
  const palette = usePalette();
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
          <Text variant="body" weight="medium">
            {back?.title || t('common.back')}
          </Text>
        ) : null}
      </Pressable>
      {title ? (
        <Text variant={wide ? 'body' : 'subheading'} tone={wide ? 'secondary' : 'default'} numberOfLines={1} style={styles.flex}>
          {title}
        </Text>
      ) : null}
    </View>
  );

  // Wide: a breadcrumb row at the top of the sheet (the sidebar is in components/web-shell.web.tsx).
  // Phones: a compact back + title bar on the frame tint, like the native apps.
  return (
    <View
      style={[
        wide ? styles.crumbs : styles.compact,
        { backgroundColor: wide ? palette.surface : palette.background, borderBottomColor: palette.border },
      ]}>
      {backRow}
    </View>
  );
}

const styles = StyleSheet.create({
  crumbs: { height: 52, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  flex: { flex: 1 },
  compact: { borderBottomWidth: 1, paddingHorizontal: spacing.sm, height: 52, justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md },
});
