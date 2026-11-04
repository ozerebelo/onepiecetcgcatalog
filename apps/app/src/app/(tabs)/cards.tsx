import { type Language, type SetKind, type SetRow } from '@binder/core';
import { keepPreviousData, useInfiniteQuery, useQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { SearchHeader, useCardFilters, type CardFilters } from '@/components/card-filters';
import { CardTile } from '@/components/card-tile';
import { Chip } from '@/components/ui/chip';
import { PageHeader, ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useSetProgress } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import {
  SEARCH_PAGE_SIZE,
  fetchSetCovers,
  fetchSets,
  searchCards,
  type CardSearchResult,
  type SearchSort,
  type SetCover,
} from '@/lib/api';
import { formatReleaseDate, setDisplayName } from '@/lib/format';
import { radius, spacing, tabular, usePalette } from '@/theme';

const SORTS: readonly SearchSort[] = ['relevance', 'number', 'name', 'cost'];

/** Product-type filter on the set timeline. Premium boosters sit with the boosters. */
type KindFilter = 'all' | 'booster' | 'extra' | 'starter' | 'other';
const KIND_FILTERS: KindFilter[] = ['all', 'booster', 'extra', 'starter', 'other'];
const kindGroup = (kind: SetKind): Exclude<KindFilter, 'all'> =>
  kind === 'booster' || kind === 'premium' ? 'booster' : kind === 'extra' || kind === 'starter' ? kind : 'other';

/**
 * Cards: every set as its pack, newest release first. Typing a search or picking a filter switches
 * the page to matching cards across all sets; one search header serves both views.
 */
export default function CardsScreen() {
  const { t, i18n } = useTranslation();
  const filters = useCardFilters<SearchSort>('relevance');
  const { params } = filters;
  const [language, setLanguage] = useState<Language>('en');
  const [kind, setKind] = useState<KindFilter>('all');
  const searching = params.query.trim() !== '' || filters.activeFilterCount > 0;

  const sets = useQuery({ queryKey: ['sets', language], queryFn: () => fetchSets(language) });
  const search = useInfiniteQuery({
    queryKey: ['search-cards', params],
    queryFn: ({ pageParam }) => searchCards(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === SEARCH_PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
    enabled: searching,
  });
  const resultCount = search.data?.pages[0]?.[0]?.total_count ?? 0;
  const visibleSets = useMemo(
    () => (sets.data ?? []).filter((s) => kind === 'all' || kindGroup(s.kind) === kind),
    [sets.data, kind],
  );

  return (
    <Screen>
      <PageHeader title={t('cardsPage.title')} subtitle={t('cardsPage.subtitle')} />
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
              ? t('cardsPage.setCount', { count: visibleSets.length, total: visibleSets.length.toLocaleString(i18n.language) })
              : ' '
        }
        fetching={searching ? search.isFetching && !search.isFetchingNextPage : sets.isFetching}
        actions={
          searching ? undefined : (
            <Segmented
              accessibilityLabel={t('search.language')}
              value={language}
              onChange={setLanguage}
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
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kindsBar} contentContainerStyle={styles.kinds}>
            {KIND_FILTERS.map((k) => (
              <Chip key={k} label={t(`cardsPage.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </ScrollView>
          {sets.isPending ? (
            <LoadingView />
          ) : sets.isError ? (
            <ErrorView error={sets.error} onRetry={() => sets.refetch()} />
          ) : (
            <SetTimeline sets={visibleSets} language={language} />
          )}
        </>
      )}
    </Screen>
  );
}

type Row = { type: 'heading'; label: string; key: string } | { type: 'packs'; sets: SetRow[]; key: string };

/** Sets newest first, in sections by release year; products without a date come last. */
function SetTimeline({ sets, language }: { sets: SetRow[]; language: Language }) {
  const { t } = useTranslation();
  const { columns, tileWidth } = useGridColumns(220, spacing.md);
  const covers = useQuery({ queryKey: ['set-covers', language], queryFn: () => fetchSetCovers(language), staleTime: 60 * 60 * 1000 });
  const progress = useSetProgress(language);

  const rows = useMemo(() => {
    const sorted = [...sets].sort(
      (a, b) =>
        (b.release_date ?? '').localeCompare(a.release_date ?? '') ||
        // same day (e.g. six starter decks): by product number, newest first
        b.sort_order - a.sort_order,
    );
    const groups = new Map<string, SetRow[]>();
    for (const set of sorted) {
      const label = set.release_date ? set.release_date.slice(0, 4) : t('cardsPage.undated');
      // release_date is "YYYY-MM-DD" (Postgres date); only the year is used here.
      groups.set(label, [...(groups.get(label) ?? []), set]);
    }
    const out: Row[] = [];
    for (const [label, group] of groups) {
      out.push({ type: 'heading', label, key: `h-${label}` });
      for (let i = 0; i < group.length; i += columns) out.push({ type: 'packs', sets: group.slice(i, i + columns), key: `${label}-${i}` });
    }
    return out;
  }, [sets, columns, t]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyView message={t('sets.empty')} />}
      renderItem={({ item, index }) =>
        item.type === 'heading' ? (
          <Text variant="heading" accessibilityRole="header" style={[styles.year, index === 0 && styles.firstYear]}>
            {item.label}
          </Text>
        ) : (
          <View style={styles.packRow}>
            {item.sets.map((set) => (
              <SetTile
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

/**
 * One product: its key artwork (the illustration on the pack; without one, a card from the set),
 * then code, name, release date and progress.
 */
function SetTile({ set, cover, width, owned }: { set: SetRow; cover?: SetCover; width: number; owned?: number }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const name = setDisplayName(set, t(`sets.kinds.${set.kind}`));
  const date = formatReleaseDate(set.release_date, i18n.language, 'short');
  const complete = owned !== undefined && owned > 0 && owned >= set.printing_count;
  const artwork = set.image_url ?? cover?.image_url ?? null;

  return (
    <Link href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${set.code}, ${name}`}
        boxStyle={[styles.tile, { width, backgroundColor: palette.surface, borderColor: palette.border, boxShadow: palette.shadow }]}
        activeStyle={styles.lift}>
        <View style={[styles.art, { backgroundColor: palette.surfaceAlt }]}>
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              // card art (fallback) shows its illustration, not the text box at the bottom
              contentPosition={set.image_url ? 'center' : { top: '12%', left: '50%' }}
              transition={150}
              accessibilityLabel={name}
            />
          ) : null}
          <View style={[styles.code, { backgroundColor: palette.overlay }]}>
            <Text variant="mono" style={styles.codeText}>
              {set.code}
            </Text>
          </View>
        </View>
        <View style={styles.tileBody}>
          <Text variant="subheading" numberOfLines={2} style={styles.name}>
            {name}
          </Text>
          <Text variant="caption" tone="muted" style={tabular}>
            {date ? `${date} · ${t('sets.printings', { count: set.printing_count })}` : t('sets.printings', { count: set.printing_count })}
          </Text>
          {owned !== undefined ? (
            <View style={styles.progress}>
              <ProgressBar value={set.printing_count ? owned / set.printing_count : 0} tone={complete ? 'success' : 'primary'} height={4} />
              <Text variant="caption" tone="secondary" style={tabular}>
                {t('cardsPage.owned', { owned, total: set.printing_count })}
              </Text>
            </View>
          ) : null}
        </View>
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
      ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={palette.primary} /> : undefined}
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
  kindsBar: { flexGrow: 0, flexShrink: 0 },
  kinds: { gap: spacing.sm, paddingVertical: spacing.xs },
  year: { marginTop: spacing.xl, marginBottom: spacing.md },
  firstYear: { marginTop: spacing.sm },
  packRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  tile: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lift: { transform: [{ translateY: -4 }] },
  art: { aspectRatio: 4 / 3, width: '100%' },
  code: { position: 'absolute', left: spacing.sm, top: spacing.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  codeText: { color: '#FFFFFF' },
  tileBody: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, gap: 4 },
  name: { minHeight: 42 },
  progress: { gap: 4, marginTop: spacing.xs },
});
