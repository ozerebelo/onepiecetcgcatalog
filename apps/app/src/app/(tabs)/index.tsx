import { CATEGORIES, COLORS, RARITIES, type Category, type Color, type Language, type Rarity } from '@binder/core';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { SEARCH_PAGE_SIZE, searchCards, type CardSearchParams, type SearchSort } from '@/lib/api';
import { CARD_COLORS, spacing, usePalette } from '@/theme';

type LanguageFilter = 'all' | Language;
const LANGUAGE_PARAMS: Record<LanguageFilter, Language[]> = { all: ['en', 'ja'], en: ['en'], ja: ['ja'] };
const COSTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SORTS: SearchSort[] = ['relevance', 'number', 'name', 'cost'];
const PLAYABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'Don');

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function CardsScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const { columns, tileWidth } = useGridColumns();

  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<LanguageFilter>('all');
  const [colors, setColors] = useState<Color[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [cost, setCost] = useState<number | null>(null);
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [showFilters, setShowFilters] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 300);
  const params = useMemo<CardSearchParams>(
    () => ({
      query: debouncedQuery,
      languages: LANGUAGE_PARAMS[language],
      colors,
      categories,
      rarities,
      costMin: cost,
      costMax: cost,
      sort,
    }),
    [debouncedQuery, language, colors, categories, rarities, cost, sort],
  );

  const search = useInfiniteQuery({
    queryKey: ['search-cards', params],
    queryFn: ({ pageParam }) => searchCards(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === SEARCH_PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
  });

  const cards = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const total = cards[0]?.total_count ?? 0;
  const activeFilterCount =
    colors.length + categories.length + rarities.length + (cost == null ? 0 : 1) + (language === 'all' ? 0 : 1);

  const clearFilters = () => {
    setColors([]);
    setCategories([]);
    setRarities([]);
    setCost(null);
    setLanguage('all');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          accessibilityLabel={t('search.placeholder')}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <View style={styles.toolbar}>
          <Text variant="caption" tone="secondary" style={styles.count}>
            {search.isSuccess ? t('search.results', { count: total }) : ' '}
          </Text>
          {search.isFetching && !search.isFetchingNextPage ? <ActivityIndicator size="small" color={palette.textMuted} /> : null}
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showFilters }}
            hitSlop={8}>
            <Text variant="caption" tone="primary" style={styles.filterToggle}>
              {showFilters ? t('search.hideFilters') : t('search.filters')}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>
        </View>
        {showFilters ? (
          <ScrollView style={styles.filters} contentContainerStyle={styles.filtersContent} nestedScrollEnabled>
            <FilterRow label={t('search.language')}>
              <Segmented
                accessibilityLabel={t('search.language')}
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'all', label: t('languages.all') },
                  { value: 'en', label: t('languages.short.en') },
                  { value: 'ja', label: t('languages.short.ja') },
                ]}
              />
            </FilterRow>
            <FilterRow label={t('search.color')}>
              {COLORS.map((color) => (
                <Chip
                  key={color}
                  label={t(`colors.${color}`)}
                  dotColor={CARD_COLORS[color]}
                  selected={colors.includes(color)}
                  onPress={() => setColors((list) => toggle(list, color))}
                />
              ))}
            </FilterRow>
            <FilterRow label={t('search.category')}>
              {PLAYABLE_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={t(`categories.${category}`)}
                  selected={categories.includes(category)}
                  onPress={() => setCategories((list) => toggle(list, category))}
                />
              ))}
            </FilterRow>
            <FilterRow label={t('search.cost')}>
              {COSTS.map((value) => (
                <Chip
                  key={value}
                  label={String(value)}
                  selected={cost === value}
                  onPress={() => setCost((current) => (current === value ? null : value))}
                />
              ))}
            </FilterRow>
            <FilterRow label={t('search.rarity')}>
              {RARITIES.map((rarity) => (
                <Chip
                  key={rarity}
                  label={t(`rarities.${rarity}`)}
                  selected={rarities.includes(rarity)}
                  onPress={() => setRarities((list) => toggle(list, rarity))}
                />
              ))}
            </FilterRow>
            <FilterRow label={t('search.sort')}>
              <Segmented
                accessibilityLabel={t('search.sort')}
                value={sort}
                onChange={setSort}
                options={SORTS.map((value) => ({ value, label: t(`search.sorts.${value}`) }))}
              />
            </FilterRow>
            {activeFilterCount > 0 ? (
              <Pressable onPress={clearFilters} accessibilityRole="button" style={styles.clear}>
                <Text variant="caption" tone="primary" style={styles.filterToggle}>
                  {t('search.clearFilters')}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </View>

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
              action={activeFilterCount > 0 ? { label: t('search.clearFilters'), onPress: clearFilters } : undefined}
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

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.filterRow}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, gap: spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  count: { flex: 1 },
  filterToggle: { fontWeight: '700' },
  filters: { maxHeight: 360 },
  filtersContent: { gap: spacing.md, paddingBottom: spacing.md },
  filterRow: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  clear: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { gap: spacing.sm },
  footer: { marginVertical: spacing.lg },
});
