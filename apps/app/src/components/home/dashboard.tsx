import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { DeckList } from '@/components/deck-list';
import { Button } from '@/components/ui/button';
import { KpiStrip, PageHeader, Panel, ProgressBar, SectionTitle } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { EmptyView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { collectionKeys, useCollectionSummary, useSetProgress } from '@/hooks/use-collection';
import { fetchCatalogStats, fetchDeckSummaries, fetchShowcase, searchCollection } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { WIDE_BREAKPOINT, radius, spacing, tabular } from '@/theme';

/**
 * Home for signed-in users. The screen's question: "what's in my binder, and which decks can I build
 * from it?" — so the decks list, with what each one still needs, is the biggest block.
 */
export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const userId = user?.id ?? 'anon';
  const n = (value: number) => value.toLocaleString(i18n.language);

  const summary = useCollectionSummary();
  const catalog = useQuery({ queryKey: ['catalog-stats'], queryFn: fetchCatalogStats, staleTime: 60 * 60 * 1000 });
  const decks = useQuery({ queryKey: ['decks', userId, 'summaries', null], queryFn: () => fetchDeckSummaries(null), enabled: Boolean(user) });
  const showcase = useQuery({ queryKey: ['showcase'], queryFn: fetchShowcase, staleTime: 60 * 60 * 1000 });
  const progress = useSetProgress('en');
  const recentParams = { query: '', languages: [], colors: [], categories: [], rarities: [], sort: 'recent' as const };
  const recent = useQuery({
    queryKey: collectionKeys.search(userId, { ...recentParams, page: 'recent-strip' }),
    queryFn: () => searchCollection(recentParams, 0),
    enabled: Boolean(user),
  });

  const latest = showcase.data?.set;
  const latestOwned = latest ? (progress.data?.[latest.id] ?? 0) : 0;
  const built = decks.data?.filter((d) => d.is_built).length ?? 0;

  return (
    <Screen scroll>
      <PageHeader
        title={t('dashboard.title')}
        actions={
          <>
            <Link href="/collection/import" asChild>
              <Button title={t('dashboard.importCards')} icon="upload" variant="outline" size="sm" />
            </Link>
            <Link href="/deck/new" asChild>
              <Button title={t('dashboard.checkDeck')} size="sm" />
            </Link>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: t('dashboard.stats.copies'), value: n(summary.data?.total_quantity ?? 0) },
          { label: t('dashboard.stats.printings'), value: n(summary.data?.unique_printings ?? 0) },
          {
            label: t('dashboard.stats.cards'),
            value: n(summary.data?.unique_cards ?? 0),
            hint: catalog.data ? t('dashboard.stats.cardsHint', { total: n(catalog.data.cards) }) : undefined,
          },
          {
            label: t('dashboard.stats.decks'),
            value: n(decks.data?.length ?? 0),
            hint: decks.data?.length ? t('dashboard.stats.decksHint', { count: built }) : undefined,
          },
        ]}
      />

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && { flex: 2 }]}>
          <SectionTitle
            title={t('dashboard.yourDecks')}
            action={
              <Link href="/decks" asChild>
                <Button title={t('dashboard.seeAll')} variant="ghost" size="sm" trailingIcon="arrow-right" />
              </Link>
            }
          />
          {decks.data && decks.data.length > 0 ? (
            <DeckList decks={decks.data.slice(0, 5)} />
          ) : (
            <Panel>
              <EmptyView icon="copy" title={t('decks.emptyTitle')} message={t('decks.emptyBody')} />
              <Link href="/deck/new" asChild>
                <Button title={t('decks.new')} icon="plus" boxStyle={styles.centerButton} />
              </Link>
            </Panel>
          )}
        </View>

        <View style={[styles.column, wide && { flex: 1 }]}>
          <SectionTitle title={t('dashboard.latestSet')} />
          {latest ? (
            <Panel>
              <View>
                <Text variant="label" tone="secondary" style={tabular}>
                  {latest.code}
                </Text>
                <Text variant="heading">{titleCase(latest.name)}</Text>
              </View>
              <View style={styles.progress}>
                <Text weight="medium" style={tabular}>
                  {t('dashboard.latestProgress', { owned: n(latestOwned), total: n(latest.printing_count) })}
                </Text>
                <ProgressBar value={latest.printing_count ? latestOwned / latest.printing_count : 0} />
              </View>
              <Link href={{ pathname: '/set/[id]', params: { id: latest.id } }} asChild>
                <Button title={t('dashboard.continueCollecting')} variant="outline" size="sm" trailingIcon="arrow-right" boxStyle={styles.start} />
              </Link>
            </Panel>
          ) : null}
        </View>
      </View>

      {recent.data && recent.data.length > 0 ? (
        <View style={styles.column}>
          <SectionTitle
            title={t('dashboard.recent')}
            action={
              <Link href="/collection" asChild>
                <Button title={t('dashboard.seeAll')} variant="ghost" size="sm" trailingIcon="arrow-right" />
              </Link>
            }
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {recent.data.slice(0, 12).map((item) => (
              <Link
                key={item.printing_id}
                href={{ pathname: '/card/[id]', params: { id: item.card_id, printing: item.printing_id } }}
                asChild>
                <PressableArea boxStyle={styles.stripCard} activeStyle={{ opacity: 0.8 }} accessibilityLabel={`${item.name}, ${item.code}`}>
                  <CardImage uri={item.image_url} label={`${item.code} ${item.name}`} rounded={radius.sm} />
                  <Text variant="caption" weight="medium" numberOfLines={1}>
                    {item.name}
                  </Text>
                </PressableArea>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { gap: spacing.xl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { gap: spacing.md },
  centerButton: { alignSelf: 'center' },
  progress: { gap: spacing.sm },
  start: { alignSelf: 'flex-start' },
  strip: { gap: spacing.md, paddingVertical: spacing.xs },
  stripCard: { width: 112, gap: spacing.xs },
});
