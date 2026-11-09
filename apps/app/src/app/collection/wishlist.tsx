import { rarityShort } from '@binder/core';
import { Link, Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { LanguageSwitch } from '@/components/language-switch';
import { PageHeader } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { RarityTag } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { useRemoveFromWishlist, useWishlist } from '@/hooks/use-wishlist';
import { printingLabel } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { radius, spacing, tabular, usePalette } from '@/theme';

/** Printings you want, in the app's card language, with whether you have them yet. */
export default function WishlistScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user, initializing } = useAuth();
  const wishlist = useWishlist();
  const remove = useRemoveFromWishlist();

  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;

  const entries = wishlist.data ?? [];
  const stillWanted = entries.filter((e) => e.owned < e.wanted).length;

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Stack.Screen options={{ title: t('wishlist.title') }} />
      <PageHeader
        title={t('wishlist.title')}
        subtitle={entries.length ? t('wishlist.summary', { count: entries.length, wanted: stillWanted }) : t('wishlist.subtitle')}
        actions={<LanguageSwitch />}
      />
      {wishlist.isPending ? (
        <LoadingView />
      ) : wishlist.isError ? (
        <ErrorView error={wishlist.error} onRetry={() => wishlist.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyView title={t('wishlist.emptyTitle')} message={t('wishlist.emptyBody')} />
      ) : (
        <View>
          {entries.map((e) => {
            const missing = Math.max(0, e.wanted - e.owned);
            return (
              <View key={e.printing_id} style={[styles.row, { borderBottomColor: palette.border }]}>
                <Link href={{ pathname: '/card/[id]', params: { id: e.card_id, printing: e.printing_id } }} asChild>
                  <PressableArea accessibilityRole="link" accessibilityLabel={`${e.name}, ${printingLabel(e.code, t)}`} boxStyle={styles.main} activeStyle={{ opacity: 0.8 }}>
                    <View style={styles.thumb}>
                      <CardImage uri={e.image_url} label={e.code} rounded={radius.sm} />
                    </View>
                    <View style={styles.flex}>
                      <Text weight="semibold" numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Text variant="mono" tone="muted" numberOfLines={1}>
                        {printingLabel(e.code, t)} · {e.set_code}
                      </Text>
                      <RarityTag code={rarityShort(e.rarity)} />
                    </View>
                  </PressableArea>
                </Link>
                <View style={styles.status}>
                  <Text variant="mono" style={[tabular, { color: missing ? palette.danger : palette.text }]}>
                    {missing ? t('decks.missing', { count: missing }) : t('wishlist.gotIt')}
                  </Text>
                  <Text variant="caption" tone="secondary" style={tabular}>
                    {t('wishlist.wantOwn', { wanted: e.wanted, owned: e.owned })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => remove.mutate(e.printing_id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('wishlist.removeEntry', { code: e.code })}
                  hitSlop={6}
                  style={styles.remove}>
                  <Text variant="caption" weight="semibold" style={styles.underline}>
                    {t('wishlist.remove')}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  thumb: { width: 44 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  status: { alignItems: 'flex-end', gap: 2 },
  remove: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.xs },
  underline: { textDecorationLine: 'underline' },
});
