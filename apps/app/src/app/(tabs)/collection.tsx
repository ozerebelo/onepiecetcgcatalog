import { collectionToCsv, collectionToList } from '@binder/core';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useCardFilters } from '@/components/card-filters';
import { ActiveFilters, CollectionFilterPanel } from '@/components/collection-filters';
import { CardTile } from '@/components/card-tile';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/panel';
import { Screen, listColumn } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { collectionKeys, useCollectionSummary, useOwnedByCard } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { exportCollection, SEARCH_PAGE_SIZE, searchCollection, type CollectionSort } from '@/lib/api';
import { saveTextFile } from '@/lib/files';
import { notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { MAX_CONTENT_WIDTH, fonts, radius, spacing, usePalette } from '@/theme';

const SORTS: readonly CollectionSort[] = ['number', 'name', 'cost', 'quantity', 'recent'];
/** From this width the filters sit in a sidebar beside the grid; below it they fold behind a button. */
const SIDEBAR_BREAKPOINT = 960;
const SIDEBAR_WIDTH = 256;
const SIDEBAR_GAP = spacing.xl;

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
  const { width } = useWindowDimensions();
  const sidebar = width >= SIDEBAR_BREAKPOINT;
  const { columns, tileWidth, usable } = useGridColumns(110, spacing.sm, sidebar ? SIDEBAR_WIDTH + SIDEBAR_GAP : 0);
  const filters = useCardFilters<CollectionSort>('number');
  const params = filters.collectionParams;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const summary = useCollectionSummary();
  // Slots show the card's playset across all printings; this printing's copies are the solid ones.
  const byCard = useOwnedByCard();
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
  const copiesLabel = (n: number) => t('collection.copiesCount', { count: n, formatted: number(n) });

  const runExport = async (kind: 'csv' | 'list') => {
    setExporting(kind);
    setNotice(null);
    try {
      const rows = await exportCollection();
      const date = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') {
        await saveTextFile(`playset-collection-${date}.csv`, collectionToCsv(rows), 'text/csv');
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

  const header = (
    <View>
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
        <View
          style={[
            styles.card,
            styles.emptyCard,
            { backgroundColor: palette.surface, borderColor: palette.border, boxShadow: palette.shadow },
          ]}>
          <Text variant="heading">{t('collection.emptyTitle')}</Text>
          <Text tone="secondary">{t('collection.emptyBody')}</Text>
          <Link href="/cards" asChild>
            <Button title={t('collection.browseSets')} variant="secondary" />
          </Link>
        </View>
      ) : (
        <View style={styles.searchBlock}>
          <TextField
            value={filters.query}
            onChangeText={filters.setQuery}
            placeholder={t('search.placeholder')}
            accessibilityLabel={t('search.placeholder')}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <View style={styles.toolbar}>
            <Text variant="caption" tone="secondary" style={styles.flex}>
              {search.isSuccess
                ? t('collection.results', { count: first?.total_count ?? 0, copies: copiesLabel(first?.total_quantity ?? 0) })
                : ' '}
            </Text>
            {search.isFetching && !search.isFetchingNextPage ? (
              <ActivityIndicator size="small" color={palette.textMuted} />
            ) : null}
            {sidebar ? null : (
              <Pressable
                onPress={() => setFiltersOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: filtersOpen }}
                hitSlop={8}>
                <Text variant="caption" weight="semibold" style={styles.underline}>
                  {filtersOpen
                    ? t('collection.filterPanel.hide')
                    : filters.activeFilterCount > 0
                      ? t('collection.filterPanel.showCount', { count: filters.activeFilterCount })
                      : t('collection.filterPanel.show')}
                </Text>
              </Pressable>
            )}
          </View>
          <ActiveFilters filters={filters} />
          {!sidebar && filtersOpen ? (
            <View style={[styles.inlinePanel, { borderColor: palette.border }]}>
              <CollectionFilterPanel filters={filters} sortOptions={SORTS} sortLabel={(s) => t(`collection.sorts.${s}`)} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  // Wide screens: the filters sit in their own column, lined up with the page's content column, and the
  // grid scrolls the rest of the window (its scrollbar at the window's edge).
  const outer = Math.max(0, (usable - MAX_CONTENT_WIDTH) / 2) + spacing.lg;
  const showSidebar = sidebar && !isEmptyCollection;

  return (
    <Screen bleed>
      <View style={styles.split}>
        {showSidebar ? (
          <ScrollView
            style={{ width: outer + SIDEBAR_WIDTH, flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={[styles.sidebar, { paddingLeft: outer }]}>
            <CollectionFilterPanel filters={filters} sortOptions={SORTS} sortLabel={(s) => t(`collection.sorts.${s}`)} />
          </ScrollView>
        ) : null}
        <FlatList
          style={styles.flex}
          key={columns}
          data={isEmptyCollection ? [] : items}
          numColumns={columns}
          keyExtractor={(item) => item.printing_id}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={
            showSidebar ? [styles.gridColumn, { paddingLeft: SIDEBAR_GAP, paddingRight: outer }] : listColumn
          }
          ListHeaderComponent={header}
          keyboardDismissMode="on-drag"
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) search.fetchNextPage();
          }}
          ListEmptyComponent={
            isEmptyCollection ? undefined : search.isPending ? (
              <LoadingView />
            ) : search.isError ? (
              <ErrorView error={search.error} onRetry={() => search.refetch()} />
            ) : (
              <EmptyView
                message={t('search.noResults')}
                action={
                  filters.activeFilterCount > 0 ? { label: t('search.clearFilters'), onPress: filters.clearFilters } : undefined
                }
              />
            )
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
              ownedCard={Math.max(byCard[item.card_id] ?? 0, item.quantity)}
              badge={`${item.set_code} · ${t(`languages.short.${item.language}`)}`}
            />
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  emptyCard: { marginTop: spacing.xl },
  row: { gap: spacing.sm },
  footer: { marginVertical: spacing.lg },
  split: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  sidebar: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  gridColumn: { flexGrow: 1, paddingBottom: spacing.xxxl },
  searchBlock: { gap: spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  underline: { fontFamily: fonts.semibold, textDecorationLine: 'underline' },
  inlinePanel: { borderTopWidth: 2, paddingTop: spacing.md, marginTop: spacing.xs, marginBottom: spacing.md },
});
