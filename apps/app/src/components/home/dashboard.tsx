import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { DeckCard } from '@/components/deck-card';
import { AlmostThere, RecentActivity } from '@/components/home/insights';
import { MetaSuggestions } from '@/components/home/meta-suggestions';
import { LanguageSwitch } from '@/components/language-switch';
import { Button } from '@/components/ui/button';
import { EmptyView } from '@/components/ui/state-views';
import { PageHeader, Panel, ProgressBar, SectionTitle, StatGroup } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { collectionKeys, useCollectionSummary, useSetProgress } from '@/hooks/use-collection';
import { fetchCatalogStats, fetchCollectionStats, fetchDeckSummaries, fetchShowcase } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { titleCase } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { WIDE_BREAKPOINT, spacing, tabular } from '@/theme';

/** Home for signed-in users: totals, decks, the newest set and recent additions. */
export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const userId = user?.id ?? 'anon';
  const name = (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? '';
  const n = (value: number) => value.toLocaleString(i18n.language);

  // Everything here is in the app's card language: English and Japanese never mix.
  const [language] = useCardLanguage();
  const summary = useCollectionSummary();
  const catalog = useQuery({ queryKey: ['catalog-stats'], queryFn: fetchCatalogStats, staleTime: 60 * 60 * 1000 });
  const decks = useQuery({
    queryKey: ['decks', userId, 'summaries', language],
    queryFn: () => fetchDeckSummaries([language]),
    enabled: Boolean(user),
  });
  const showcase = useQuery({ queryKey: ['showcase', language], queryFn: () => fetchShowcase(language), staleTime: 60 * 60 * 1000 });
  const progress = useSetProgress(language);
  // Full playsets and spares come from the collection's stats (same language).
  const stats = useQuery({
    queryKey: [...collectionKeys.all(userId), 'stats', language],
    queryFn: () => fetchCollectionStats(language),
    enabled: Boolean(user),
  });

  const latest = showcase.data?.set;
  const latestOwned = latest ? (progress.data?.[latest.id] ?? 0) : 0;

  return (
    <Screen scroll>
      <PageHeader
        title={t('dashboard.greeting', { name })}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <LanguageSwitch />
            <Link href="/deck/new" asChild>
              <Button title={t('dashboard.checkDeck')} icon="check-square" />
            </Link>
            <Link href="/collection/import" asChild>
              <Button title={t('collection.import')} icon="upload" variant="outline" />
            </Link>
          </>
        }
      />

      <StatGroup
        stats={[
          { label: t('dashboard.stats.copies'), value: n(summary.data?.total_quantity ?? 0) },
          {
            label: t('dashboard.stats.playsets'),
            value: n(stats.data?.playsets ?? 0),
            hint: stats.data?.spares ? t('dashboard.stats.spares', { count: stats.data.spares }) : undefined,
          },
          {
            label: t('dashboard.stats.cards'),
            value: n(summary.data?.unique_cards ?? 0),
            hint: catalog.data ? t('dashboard.stats.ofTotal', { total: n(catalog.data.cards) }) : undefined,
          },
          {
            label: t('dashboard.stats.decks'),
            value: n(decks.data?.length ?? 0),
            hint: decks.data?.length ? t('dashboard.stats.built', { count: decks.data.filter((d) => d.is_built).length }) : undefined,
          },
        ]}
      />

      <AlmostThere decks={decks.data} />
      <MetaSuggestions />

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && { flex: 3 }]}>
          <SectionTitle
            title={t('dashboard.yourDecks')}
            action={
              <Link href="/decks" asChild>
                <Button title={t('dashboard.seeAll')} variant="ghost" size="sm" trailingIcon="arrow-right" />
              </Link>
            }
          />
          {decks.data && decks.data.length > 0 ? (
            <View style={styles.deckGrid}>
              {decks.data.slice(0, 4).map((deck) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </View>
          ) : (
            <Panel>
              <EmptyView
                icon="copy"
                title={t('decks.emptyTitle')}
                message={t('decks.emptyBody')}
              />
              <Link href="/deck/new" asChild>
                <Button title={t('decks.new')} icon="plus" boxStyle={styles.centerButton} />
              </Link>
            </Panel>
          )}
        </View>

        <View style={[styles.column, wide && { flex: 2 }]}>
          <SectionTitle title={t('dashboard.latestSet')} />
          {latest ? (
            <Panel padded={false} style={styles.latest}>
              {latest.image_url ? (
                <Image source={{ uri: latest.image_url }} style={styles.latestArt} contentFit="cover" transition={150} accessibilityLabel={latest.name} />
              ) : null}
              <View style={styles.latestBody}>
                <View style={styles.latestTitle}>
                  <Text variant="heading">{titleCase(latest.name)}</Text>
                  <Text variant="mono" tone="secondary">
                    {latest.code}
                  </Text>
                </View>
                <View style={styles.latestProgress}>
                  <ProgressBar value={latest.printing_count ? latestOwned / latest.printing_count : 0} height={6} />
                  <Text variant="caption" tone="secondary" style={tabular}>
                    {t('collection.setRowProgress', { owned: latestOwned, total: latest.printing_count })}
                  </Text>
                </View>
                <Link href={{ pathname: '/set/[id]', params: { id: latest.id } }} asChild>
                  <Button title={t('dashboard.continueCollecting')} variant="outline" trailingIcon="arrow-right" />
                </Link>
              </View>
            </Panel>
          ) : null}
        </View>
      </View>

      <RecentActivity />
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { gap: spacing.xl },
  latest: { overflow: 'hidden' },
  latestArt: { width: '100%', aspectRatio: 16 / 9 },
  latestBody: { padding: spacing.lg, gap: spacing.md },
  latestTitle: { gap: 2 },
  latestProgress: { gap: 6 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { gap: spacing.md },
  deckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  centerButton: { alignSelf: 'center' },
});
