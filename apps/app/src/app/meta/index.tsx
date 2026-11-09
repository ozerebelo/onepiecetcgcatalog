import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { LanguageSwitch } from '@/components/language-switch';
import { MetaDeckCard } from '@/components/meta-deck-card';
import { PageHeader } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { fetchMetaPickups, fetchMetaProgress, type MetaPickup } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { useAuth } from '@/providers/auth';
import { radius, spacing, tabular, usePalette } from '@/theme';

type Sort = 'closest' | 'newest';

/**
 * Meta decks: reference tournament lists, ranked by how much of each you already own
 * ("What can you build"), plus the cards that would complete the most of them.
 */
export default function MetaScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const signedIn = Boolean(user);
  const [sort, setSort] = useState<Sort>('closest');

  const decks = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'progress', language],
    queryFn: () => fetchMetaProgress(language),
  });
  const pickups = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'pickups', language],
    queryFn: () => fetchMetaPickups(language, 12),
    enabled: signedIn,
  });

  const list = useMemo(() => {
    const rows = [...(decks.data ?? [])];
    if (signedIn && sort === 'closest') rows.sort((a, b) => a.missing - b.missing || b.event_date.localeCompare(a.event_date));
    return rows;
  }, [decks.data, signedIn, sort]);

  const formats = [...new Set((decks.data ?? []).map((d) => d.format))];
  const buildable = (decks.data ?? []).filter((d) => d.missing === 0).length;

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: t('meta.title') }} />
      <PageHeader
        title={t('meta.title')}
        subtitle={
          formats.length
            ? t('meta.subtitle', { count: decks.data?.length ?? 0, formats: formats.join(', ') })
            : t('meta.subtitleEmpty')
        }
        actions={<LanguageSwitch />}
      />

      {decks.isPending ? (
        <LoadingView />
      ) : decks.isError ? (
        <ErrorView error={decks.error} onRetry={() => decks.refetch()} />
      ) : list.length === 0 ? (
        <EmptyView icon="award" title={t('meta.emptyTitle')} message={t('meta.emptyBody')} />
      ) : (
        <>
          {signedIn && pickups.data && pickups.data.length > 0 ? <Pickups pickups={pickups.data} /> : null}

          <View style={styles.listHead}>
            <Text variant="heading" accessibilityRole="header" style={styles.flex}>
              {signedIn ? t('meta.whatCanYouBuild') : t('meta.decks')}
            </Text>
            {signedIn ? (
              <Segmented
                accessibilityLabel={t('meta.sortLabel')}
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'closest', label: t('meta.sortClosest') },
                  { value: 'newest', label: t('meta.sortNewest') },
                ]}
              />
            ) : null}
          </View>
          <Text tone="secondary" style={styles.lede}>
            {signedIn
              ? buildable
                ? t('meta.buildable', { count: buildable })
                : t('meta.closestHint')
              : t('meta.signedOutHint')}
          </Text>
          <View style={styles.grid}>
            {list.map((deck) => (
              <MetaDeckCard key={deck.id} deck={deck} signedIn={signedIn} />
            ))}
          </View>
          <Text variant="caption" tone="secondary" style={styles.sources}>
            {t('meta.sourcesNote', { sources: [...new Set(list.map((d) => d.source_name))].join(', ') })}
          </Text>
        </>
      )}
    </Screen>
  );
}

/** The cards that would move you closest to the most meta decks. */
function Pickups({ pickups }: { pickups: MetaPickup[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  return (
    <View style={styles.pickups}>
      <Text variant="heading" accessibilityRole="header">
        {t('meta.pickups')}
      </Text>
      <Text tone="secondary">{t('meta.pickupsHint')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickupRow}>
        {pickups.map((p) => (
          <Link key={p.card_id} href={{ pathname: '/card/[id]', params: { id: p.card_id } }} asChild>
            <PressableArea
              accessibilityRole="link"
              accessibilityLabel={`${p.name}, ${p.card_id}. ${t('meta.pickupLine', { count: p.decks })}${
                p.decks_finished ? `, ${t('meta.finishes', { count: p.decks_finished })}` : ''
              }. ${t('meta.buyCopies', { count: p.copies })}`}
              boxStyle={styles.pickup}
              activeStyle={{ opacity: 0.85 }}>
              <View>
                <CardImage uri={p.image_url} label={p.card_id} rounded={radius.sm} />
                <View style={[styles.copies, { backgroundColor: palette.danger }]}>
                  <Text style={[styles.copiesText, tabular]}>+{p.copies}</Text>
                </View>
              </View>
              <Text variant="caption" weight="semibold" numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {t('meta.pickupLine', { count: p.decks })}
                {p.decks_finished ? ` · ${t('meta.finishes', { count: p.decks_finished })}` : ''}
              </Text>
            </PressableArea>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  lede: { marginTop: spacing.xs, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sources: { marginTop: spacing.lg },
  pickups: { gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.md },
  pickupRow: { gap: spacing.md, paddingVertical: spacing.sm },
  pickup: { width: 104, gap: 3 },
  copies: { position: 'absolute', right: 4, bottom: 4, borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  copiesText: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
