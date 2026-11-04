import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { DeckCard } from '@/components/deck-card';
import { Button } from '@/components/ui/button';
import { EmptyView } from '@/components/ui/state-views';
import { PageHeader, Panel, ProgressBar, SectionTitle, StatTile } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { collectionKeys, useCollectionSummary, useSetProgress } from '@/hooks/use-collection';
import { fetchDeckSummaries, fetchShowcase, searchCollection } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { WIDE_BREAKPOINT, radius, spacing, usePalette } from '@/theme';

/** Home for signed-in users: totals, decks, the newest set and recent additions. */
export function Dashboard() {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const userId = user?.id ?? 'anon';
  const name = (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? '';
  const n = (value: number) => value.toLocaleString(i18n.language);

  const summary = useCollectionSummary();
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

  return (
    <Screen scroll>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.greeting', { name })}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <Link href="/deck/new" asChild>
              <Button title={t('dashboard.checkDeck')} icon="check-square" />
            </Link>
            <Link href="/collection/import" asChild>
              <Button title={t('collection.import')} icon="upload" variant="outline" />
            </Link>
          </>
        }
      />

      <View style={styles.stats}>
        <StatTile icon="layers" label={t('dashboard.stats.copies')} value={n(summary.data?.total_quantity ?? 0)} />
        <StatTile icon="image" label={t('dashboard.stats.printings')} value={n(summary.data?.unique_printings ?? 0)} />
        <StatTile icon="hash" label={t('dashboard.stats.cards')} value={n(summary.data?.unique_cards ?? 0)} />
        <StatTile icon="copy" label={t('dashboard.stats.decks')} value={n(decks.data?.length ?? 0)} />
      </View>

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
            <Panel>
              <Text variant="eyebrow" tone="primary">
                {latest.code}
              </Text>
              <Text variant="heading">{latest.name}</Text>
              <ProgressBar value={latest.printing_count ? latestOwned / latest.printing_count : 0} />
              <Text variant="caption" tone="secondary">
                {t('collection.setRowProgress', { owned: latestOwned, total: latest.printing_count })}
              </Text>
              <Link href={{ pathname: '/set/[id]', params: { id: latest.id } }} asChild>
                <Button title={t('dashboard.continueCollecting')} variant="outline" trailingIcon="arrow-right" />
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
                <PressableArea boxStyle={styles.stripCard} activeStyle={{ transform: [{ translateY: -3 }] }} accessibilityLabel={`${item.name}, ${item.code}`}>
                  <View style={{ boxShadow: palette.shadow, borderRadius: radius.md }}>
                    <CardImage uri={item.image_url} label={`${item.code} ${item.name}`} />
                  </View>
                  <Text variant="caption" weight="semibold" numberOfLines={1}>
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  columns: { gap: spacing.xl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { gap: spacing.md },
  deckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  centerButton: { alignSelf: 'center' },
  strip: { gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: 2 },
  stripCard: { width: 120, gap: spacing.xs },
});
