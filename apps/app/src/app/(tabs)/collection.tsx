import { collectionToCsv, collectionToList } from '@binder/core';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { SearchHeader, useCardFilters } from '@/components/card-filters';
import { CardTile } from '@/components/card-tile';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { collectionKeys, useCollectionSummary } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { exportCollection, SEARCH_PAGE_SIZE, searchCollection, type CollectionSort } from '@/lib/api';
import { saveTextFile } from '@/lib/files';
import { notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { radius, spacing, usePalette } from '@/theme';

const SORTS: readonly CollectionSort[] = ['number', 'name', 'cost', 'quantity', 'recent'];

export default function CollectionScreen() {
  const { user, initializing } = useAuth();

  if (initializing) return <LoadingView />;
  if (!user) return <SignedOut />;
  return <CollectionView userId={user.id} />;
}

function SignedOut() {
  const { t } = useTranslation();
  const palette = usePalette();
  return (
    <Screen scroll narrow>
      <Text variant="title">{t('collection.title')}</Text>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text variant="heading">{t('account.signedOutTitle')}</Text>
        <Text tone="secondary">{t('collection.signedOutBody')}</Text>
        <Link href="/auth/sign-in" asChild>
          <Button title={t('account.signIn')} />
        </Link>
        <Link href="/auth/sign-up" asChild>
          <Button title={t('account.signUp')} variant="secondary" />
        </Link>
      </View>
    </Screen>
  );
}

function CollectionView({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { columns, tileWidth } = useGridColumns();
  const filters = useCardFilters<CollectionSort>('number');
  const { params } = filters;
  const summary = useCollectionSummary();
  const [exporting, setExporting] = useState<'csv' | 'list' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const search = useInfiniteQuery({
    queryKey: collectionKeys.search(userId, params),
    queryFn: ({ pageParam }) => searchCollection(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === SEARCH_PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const first = items[0];
  const isEmptyCollection = summary.data?.unique_printings === 0;
  const number = (n: number) => n.toLocaleString(i18n.language);

  const runExport = async (kind: 'csv' | 'list') => {
    setExporting(kind);
    setNotice(null);
    try {
      const rows = await exportCollection();
      const date = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') {
        await saveTextFile(`nakama-binder-collection-${date}.csv`, collectionToCsv(rows), 'text/csv');
      } else {
        await Clipboard.setStringAsync(collectionToList(rows));
        setNotice(t('collection.copied', { count: rows.length }));
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen>
      <PageHeader
        title={t('collection.title')}
        subtitle={
          summary.data
            ? t('collection.summary', {
                copies: number(summary.data.total_quantity),
                printings: number(summary.data.unique_printings),
                cards: number(summary.data.unique_cards),
              })
            : undefined
        }
        actions={
          <>
            <Link href="/collection/import" asChild>
              <Button title={t('collection.import')} icon="upload" size="sm" />
            </Link>
            <Button
              title={t('collection.exportCsv')}
              icon="download"
              variant="outline"
              size="sm"
              loading={exporting === 'csv'}
              disabled={isEmptyCollection}
              onPress={() => runExport('csv')}
            />
            <Button
              title={t('collection.copyList')}
              icon="clipboard"
              variant="outline"
              size="sm"
              loading={exporting === 'list'}
              disabled={isEmptyCollection}
              onPress={() => runExport('list')}
            />
          </>
        }
      />
      <View style={styles.top}>
        {notice ? (
          <Text variant="caption" tone="success" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
      </View>

      {isEmptyCollection ? (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text variant="heading">{t('collection.emptyTitle')}</Text>
          <Text tone="secondary">{t('collection.emptyBody')}</Text>
          <Link href="/sets" asChild>
            <Button title={t('collection.browseSets')} variant="secondary" />
          </Link>
        </View>
      ) : (
        <>
          <SearchHeader
            filters={filters}
            sortOptions={SORTS}
            sortLabel={(s) => t(`collection.sorts.${s}`)}
            countLabel={
              search.isSuccess
                ? t('collection.results', {
                    count: first?.total_count ?? 0,
                    copies: number(first?.total_quantity ?? 0),
                  })
                : ' '
            }
            fetching={search.isFetching && !search.isFetchingNextPage}
          />
          {search.isPending ? (
            <LoadingView />
          ) : search.isError && items.length === 0 ? (
            <ErrorView error={search.error} onRetry={() => search.refetch()} />
          ) : (
            <FlatList
              key={columns}
              data={items}
              numColumns={columns}
              keyExtractor={(item) => item.printing_id}
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
                    filters.activeFilterCount > 0
                      ? { label: t('search.clearFilters'), onPress: filters.clearFilters }
                      : undefined
                  }
                />
              }
              ListFooterComponent={
                search.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={palette.primary} /> : undefined
              }
              renderItem={({ item }) => (
                <CardTile
                  href={{ pathname: '/card/[id]', params: { id: item.card_id, printing: item.printing_id } }}
                  imageUrl={item.image_url}
                  code={item.code}
                  name={item.name}
                  width={tileWidth}
                  quantity={item.quantity}
                  badge={`${item.set_code} · ${t(`languages.short.${item.language}`)}`}
                />
              )}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  emptyCard: { marginTop: spacing.xl },
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { gap: spacing.sm },
  footer: { marginVertical: spacing.lg },
});
