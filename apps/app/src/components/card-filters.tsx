import { CATEGORIES, COLORS, RARITIES, type Category, type Color, type Language, type Rarity } from '@binder/core';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { CardSearchParams } from '@/lib/api';
import { CARD_COLORS, spacing, usePalette } from '@/theme';

import { Chip } from './ui/chip';
import { Segmented } from './ui/segmented';
import { Text } from './ui/text';
import { TextField } from './ui/text-field';

export type LanguageFilter = 'all' | Language;
const LANGUAGE_PARAMS: Record<LanguageFilter, Language[]> = { all: ['en', 'ja'], en: ['en'], ja: ['ja'] };
const COSTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const PLAYABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'Don');

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Search text + filter state shared by the Cards and Collection screens. */
export function useCardFilters<S extends string>(defaultSort: S) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<LanguageFilter>('all');
  const [colors, setColors] = useState<Color[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [cost, setCost] = useState<number | null>(null);
  const [sort, setSort] = useState<S>(defaultSort);
  const debouncedQuery = useDebouncedValue(query, 300);

  const params = useMemo<Omit<CardSearchParams, 'sort'> & { sort: S }>(
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

  const activeFilterCount =
    colors.length + categories.length + rarities.length + (cost == null ? 0 : 1) + (language === 'all' ? 0 : 1);

  return {
    query,
    setQuery,
    language,
    setLanguage,
    colors,
    toggleColor: (c: Color) => setColors((list) => toggle(list, c)),
    categories,
    toggleCategory: (c: Category) => setCategories((list) => toggle(list, c)),
    rarities,
    toggleRarity: (r: Rarity) => setRarities((list) => toggle(list, r)),
    cost,
    toggleCost: (value: number) => setCost((current) => (current === value ? null : value)),
    sort,
    setSort,
    params,
    activeFilterCount,
    clearFilters: () => {
      setColors([]);
      setCategories([]);
      setRarities([]);
      setCost(null);
      setLanguage('all');
    },
  };
}

export type CardFilters<S extends string> = ReturnType<typeof useCardFilters<S>>;

interface SearchHeaderProps<S extends string> {
  filters: CardFilters<S>;
  sortOptions: readonly S[];
  sortLabel: (sort: S) => string;
  /** e.g. "2,884 cards"; a space keeps the row height while loading. */
  countLabel: string;
  fetching: boolean;
  /** Extra controls shown on the right of the count row. */
  actions?: ReactNode;
}

export function SearchHeader<S extends string>({
  filters: f,
  sortOptions,
  sortLabel,
  countLabel,
  fetching,
  actions,
}: SearchHeaderProps<S>) {
  const { t } = useTranslation();
  const palette = usePalette();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.header}>
      <TextField
        value={f.query}
        onChangeText={f.setQuery}
        placeholder={t('search.placeholder')}
        accessibilityLabel={t('search.placeholder')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <View style={styles.toolbar}>
        <Text variant="caption" tone="secondary" style={styles.count}>
          {countLabel}
        </Text>
        {fetching ? <ActivityIndicator size="small" color={palette.textMuted} /> : null}
        {actions}
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={8}>
          <Text variant="caption" tone="primary" style={styles.bold}>
            {open ? t('search.hideFilters') : t('search.filters')}
            {f.activeFilterCount > 0 ? ` (${f.activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>
      {open ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} nestedScrollEnabled>
          <FilterRow label={t('search.language')}>
            <Segmented
              accessibilityLabel={t('search.language')}
              value={f.language}
              onChange={f.setLanguage}
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
                selected={f.colors.includes(color)}
                onPress={() => f.toggleColor(color)}
              />
            ))}
          </FilterRow>
          <FilterRow label={t('search.category')}>
            {PLAYABLE_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={t(`categories.${category}`)}
                selected={f.categories.includes(category)}
                onPress={() => f.toggleCategory(category)}
              />
            ))}
          </FilterRow>
          <FilterRow label={t('search.cost')}>
            {COSTS.map((value) => (
              <Chip key={value} label={String(value)} selected={f.cost === value} onPress={() => f.toggleCost(value)} />
            ))}
          </FilterRow>
          <FilterRow label={t('search.rarity')}>
            {RARITIES.map((rarity) => (
              <Chip
                key={rarity}
                label={t(`rarities.${rarity}`)}
                selected={f.rarities.includes(rarity)}
                onPress={() => f.toggleRarity(rarity)}
              />
            ))}
          </FilterRow>
          <FilterRow label={t('search.sort')}>
            <Segmented
              accessibilityLabel={t('search.sort')}
              value={f.sort}
              onChange={f.setSort}
              options={sortOptions.map((value) => ({ value, label: sortLabel(value) }))}
            />
          </FilterRow>
          {f.activeFilterCount > 0 ? (
            <Pressable onPress={f.clearFilters} accessibilityRole="button" style={styles.clear}>
              <Text variant="caption" tone="primary" style={styles.bold}>
                {t('search.clearFilters')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
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
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  count: { flex: 1 },
  bold: { fontWeight: '700' },
  panel: { maxHeight: 360 },
  panelContent: { gap: spacing.md, paddingBottom: spacing.md },
  filterRow: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  clear: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
});
