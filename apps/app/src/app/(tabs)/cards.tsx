import { SET_KINDS, compareSets, type Language, type SetKind, type SetRow } from '@binder/core';
import { keepPreviousData, useInfiniteQuery, useQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { SearchHeader, useCardFilters, type CardFilters } from '@/components/card-filters';
import { CardTile } from '@/components/card-tile';
import { PageHeader, ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useSetProgress } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { SEARCH_PAGE_SIZE, fetchSetCovers, fetchSets, searchCards, type CardSearchResult, type SearchSort, type SetCover } from '@/lib/api';
import { setDisplayName } from '@/lib/format';
import { radius, spacing, tabular, usePalette } from '@/theme';

const SORTS: readonly SearchSort[] = ['relevance', 'number', 'name', 'cost'];

/**
 * Cards: every set as a cover, newest first within each kind of product. Typing a search or picking
 * a filter switches the page to matching cards across all sets.
 */
export default function CardsScreen() {
  const { t, i18n } = useTranslation();
  const filters = useCardFilters<SearchSort>('relevance');
  const { params } = filters;
  const [setsLanguage, setSetsLanguage] = useState<Language>('en');
  const searching = params.query.trim() !== '' || filters.activeFilterCount > 0;

  const sets = useQuery({ queryKey: ['sets', setsLanguage], queryFn: () => fetchSets(setsLanguage) });
  const search = useInfiniteQuery({
    queryKey: ['search-cards', params],
    queryFn: ({ pageParam }) => searchCards(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === SEARCH_PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
    enabled: searching,
  });
  const resultCount = search.data?.pages[0]?.[0]?.total_count ?? 0;

  return (
    <Screen>
      <PageHeader title={t('cardsPage.title')} subtitle={t('cardsPage.subtitle')} />
      {/* One search header for both views, so typing or filtering never resets it. */}
      <SearchHeader
        filters={filters}
        sortOptions={SORTS}
        sortLabel={(s) => t(`search.sorts.${s}`)}
        countLabel={
          searching
            ? search.isSuccess
              ? t('search.results', { count: resultCount })
              : ' '
            : sets.isSuccess
              ? t('cardsPage.setCount', { count: sets.data.length, total: sets.data.length.toLocaleString(i18n.language) })
              : ' '
        }
        fetching={searching ? search.isFetching && !search.isFetchingNextPage : sets.isFetching}
        actions={
          searching ? undefined : (
            <Segmented
              accessibilityLabel={t('search.language')}
              value={setsLanguage}
              onChange={setSetsLanguage}
              options={[
                { value: 'en', label: t('languages.en') },
                { value: 'ja', label: t('languages.ja') },
              ]}
            />
          )
        }
      />
      {searching ? (
        <CardResults search={search} filters={filters} />
      ) : sets.isPending ? (
        <LoadingView />
      ) : sets.isError ? (
        <ErrorView error={sets.error} onRetry={() => sets.refetch()} />
      ) : (
        <SetBrowser sets={sets.data} language={setsLanguage} />
      )}
    </Screen>
  );
}

type Row = { type: 'heading'; kind: SetKind; count: number; key: string } | { type: 'covers'; sets: SetRow[]; key: string };

/** Sets grouped by kind of product, newest first, as rows of covers (one virtualised list). */
function SetBrowser({ sets, language }: { sets: SetRow[]; language: Language }) {
  const { t } = useTranslation();
  const { columns, tileWidth } = useGridColumns(170);
  const covers = useQuery({ queryKey: ['set-covers', language], queryFn: () => fetchSetCovers(language), staleTime: 60 * 60 * 1000 });
  const progress = useSetProgress(language);

  const rows = useMemo(() => {
    const sorted = [...sets].sort(compareSets);
    const out: Row[] = [];
    for (const kind of SET_KINDS) {
      const group = sorted.filter((s) => s.kind === kind);
      if (!group.length) continue;
      out.push({ type: 'heading', kind, count: group.length, key: `h-${kind}` });
      for (let i = 0; i < group.length; i += columns) {
        out.push({ type: 'covers', sets: group.slice(i, i + columns), key: `${kind}-${i}` });
      }
    }
    return out;
  }, [sets, columns]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyView message={t('sets.empty')} />}
      renderItem={({ item, index }) =>
        item.type === 'heading' ? (
          <View style={[styles.heading, index === 0 && styles.firstHeading]}>
            <Text variant="heading" role="heading" aria-level={2}>
              {t(`sets.kinds.${item.kind}`)}
            </Text>
            <Text variant="caption" tone="secondary" style={tabular}>
              {t('sets.count', { count: item.count })}
            </Text>
          </View>
        ) : (
          <View style={styles.coverRow}>
            {item.sets.map((set) => (
              <SetCoverTile
                key={set.id}
                set={set}
                cover={covers.data?.[set.id]}
                width={tileWidth}
                owned={progress.data ? (progress.data[set.id] ?? 0) : undefined}
              />
            ))}
          </View>
        )
      }
    />
  );
}

/** A set as a cover: its most striking card, the code and name, and progress when signed in. */
function SetCoverTile({ set, cover, width, owned }: { set: SetRow; cover?: SetCover; width: number; owned?: number }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const n = (value: number) => value.toLocaleString(i18n.language);
  const complete = owned !== undefined && owned > 0 && owned >= set.printing_count;
  const name = setDisplayName(set, t(`landing.sets.kind.${['booster', 'extra', 'starter'].includes(set.kind) ? set.kind : 'other'}`));
  return (
    <Link href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${set.code}, ${name}`}
        boxStyle={[styles.tile, { width }]}
        activeStyle={styles.lift}
      >
        <View style={[styles.cover, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
          {cover?.image_url ? (
            <Image
              source={{ uri: cover.image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition={{ top: '10%', left: '50%' }}
              transition={150}
              recyclingKey={cover.printing_id}
              accessibilityLabel={cover.name}
            />
          ) : null}
          <View style={[styles.code, { backgroundColor: palette.surface }]}>
            <Text variant="figure" weight="semibold">
              {set.code}
            </Text>
          </View>
        </View>
        <Text variant="subheading" weight="semibold" numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        {owned !== undefined ? (
          <View style={styles.progress}>
            <Text variant="caption" tone="secondary" style={tabular}>
              {t('cardsPage.owned', { owned: n(owned), total: n(set.printing_count) })}
            </Text>
            <ProgressBar value={set.printing_count ? owned / set.printing_count : 0} tone={complete ? 'accent' : 'neutral'} height={4} />
          </View>
        ) : (
          <Text variant="caption" tone="secondary" style={tabular}>
            {t('sets.printings', { count: set.printing_count })}
          </Text>
        )}
      </PressableArea>
    </Link>
  );
}

/** Matching cards across every set (shown while searching or filtering). */
function CardResults({
  search,
  filters,
}: {
  search: UseInfiniteQueryResult<InfiniteData<CardSearchResult[]>>;
  filters: CardFilters<SearchSort>;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { columns, tileWidth } = useGridColumns();
  const cards = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);

  if (search.isPending) return <LoadingView />;
  if (search.isError && cards.length === 0) return <ErrorView error={search.error} onRetry={() => search.refetch()} />;
  return (
    <FlatList
      key={columns}
      data={cards}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={columns > 1 ? styles.cardRow : undefined}
      contentContainerStyle={styles.list}
      keyboardDismissMode="on-drag"
      onEndReachedThreshold={0.6}
      onEndReached={() => {
        if (search.hasNextPage && !search.isFetchingNextPage) search.fetchNextPage();
      }}
      ListEmptyComponent={
        <EmptyView
          message={t('search.noResults')}
          action={filters.activeFilterCount > 0 ? { label: t('search.clearFilters'), onPress: filters.clearFilters } : undefined}
        />
      }
      ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={palette.textMuted} /> : undefined}
      renderItem={({ item }) => (
        <CardTile
          href={{ pathname: '/card/[id]', params: { id: item.id } }}
          imageUrl={item.image_url}
          code={item.id}
          name={item.name}
          width={tileWidth}
          badge={item.printing_count > 1 ? t('search.arts', { count: item.printing_count }) : null}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xxxl, flexGrow: 1 },
  cardRow: { gap: spacing.sm },
  footer: { marginVertical: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  coverRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  tile: { gap: spacing.xs },
  name: { minHeight: 44 },
  firstHeading: { marginTop: spacing.sm },
  lift: { transform: [{ translateY: -3 }] },
  cover: { aspectRatio: 4 / 5, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.xs },
  code: { position: 'absolute', left: spacing.sm, top: spacing.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  progress: { gap: 6 },
});
