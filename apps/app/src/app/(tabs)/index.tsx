import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { SearchHeader, useCardFilters } from '@/components/card-filters';
import { CardTile } from '@/components/card-tile';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { SEARCH_PAGE_SIZE, searchCards, type SearchSort } from '@/lib/api';
import { spacing, usePalette } from '@/theme';

const SORTS: readonly SearchSort[] = ['relevance', 'number', 'name', 'cost'];

export default function CardsScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const { columns, tileWidth } = useGridColumns();
  const filters = useCardFilters<SearchSort>('relevance');
  const { params } = filters;

  const search = useInfiniteQuery({
    queryKey: ['search-cards', params],
    queryFn: ({ pageParam }) => searchCards(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === SEARCH_PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
  });

  const cards = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const total = cards[0]?.total_count ?? 0;

  return (
    <Screen>
      <SearchHeader
        filters={filters}
        sortOptions={SORTS}
        sortLabel={(s) => t(`search.sorts.${s}`)}
        countLabel={search.isSuccess ? t('search.results', { count: total }) : ' '}
        fetching={search.isFetching && !search.isFetchingNextPage}
      />

      {search.isPending ? (
        <LoadingView />
      ) : search.isError && cards.length === 0 ? (
        <ErrorView error={search.error} onRetry={() => search.refetch()} />
      ) : (
        <FlatList
          key={columns}
          data={cards}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) search.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyView
              message={t('search.noResults')}
              action={
                filters.activeFilterCount > 0 ? { label: t('search.clearFilters'), onPress: filters.clearFilters } : undefined
              }
            />
          }
          ListFooterComponent={
            search.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={palette.primary} /> : undefined
          }
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { gap: spacing.sm },
  footer: { marginVertical: spacing.lg },
});
