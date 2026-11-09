import { type Language, type SetKind, type SetRow } from '@binder/core';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SearchHeader, useCardFilters } from '@/components/card-filters';
import { CardTile } from '@/components/card-tile';
import { LanguageSwitch } from '@/components/language-switch';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { PageHeader, ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen, listColumn } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useOwnedByCard, useSetProgress } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import {
  SEARCH_PAGE_SIZE,
  fetchQuickAddPrinting,
  fetchSetCovers,
  fetchSets,
  searchCards,
  type CardSearchResult,
  type SearchSort,
  type SetCover,
} from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { formatReleaseDate, setDisplayName } from '@/lib/format';
import { notifyError, showToast } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { CARD_ASPECT_RATIO, radius, spacing, tabular, usePalette } from '@/theme';

const SORTS: readonly SearchSort[] = ['relevance', 'number', 'name', 'cost'];

/** The type filter. "Sets" are the main boosters (premium boosters included). */
type KindFilter = 'all' | 'sets' | 'extra' | 'starter' | 'other';
const KIND_FILTERS: KindFilter[] = ['all', 'sets', 'extra', 'starter', 'other'];
const kindGroup = (kind: SetKind): Exclude<KindFilter, 'all'> =>
  kind === 'booster' || kind === 'premium' ? 'sets' : kind === 'extra' || kind === 'starter' ? kind : 'other';

/** Two sections: sets and extra boosters first, then starter decks and promos. */
const SECTIONS = [
  { key: 'boosters', groups: ['sets', 'extra'] },
  { key: 'decks', groups: ['starter', 'other'] },
] as const;

const SET_TILE_GAP = spacing.md;
const CARD_TILE_GAP = spacing.sm;

type Row =
  | {
      type: 'heading';
      key: string;
      label: string;
      count: number;
      first: boolean;
    }
  | { type: 'sets'; key: string; sets: SetRow[] }
  | { type: 'cards'; key: string; cards: CardSearchResult[] };

/**
 * Cards: every product with its artwork, newest release first — sets and extra boosters, then
 * starter decks and promos. Typing a search or picking a filter switches the same list to matching
 * cards. It is one full-width list (the whole page scrolls, header included), so the search box keeps
 * its focus when the view switches.
 */
export default function CardsScreen() {
  const { t, i18n } = useTranslation();
  const filters = useCardFilters<SearchSort>('relevance');
  const { params } = filters;
  // One card language for the whole app: the sets listed, search results and quick adds follow it.
  const [language] = useCardLanguage();
  const [kind, setKind] = useState<KindFilter>('all');
  const searching = params.query.trim() !== '' || filters.activeFilterCount > 0;
  const setGrid = useGridColumns(220, SET_TILE_GAP);
  const cardGrid = useGridColumns(110, CARD_TILE_GAP);

  const sets = useQuery({
    queryKey: ['sets', language],
    queryFn: () => fetchSets(language),
  });
  const covers = useQuery({
    queryKey: ['set-covers', language],
    queryFn: () => fetchSetCovers(language),
    staleTime: 60 * 60 * 1000,
  });
  const progress = useSetProgress(language);
  const ownedByCard = useOwnedByCard();
  const { user } = useAuth();
  const search = useInfiniteQuery({
    queryKey: ['search-cards', params],
    queryFn: ({ pageParam }) => searchCards(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === SEARCH_PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
    enabled: searching,
  });
  const cards = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const resultCount = cards[0]?.total_count ?? 0;
  const visibleSets = useMemo(
    () => (sets.data ?? []).filter((s) => kind === 'all' || kindGroup(s.kind) === kind),
    [sets.data, kind],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (searching) {
      for (let i = 0; i < cards.length; i += cardGrid.columns)
        out.push({
          type: 'cards',
          key: `c-${i}`,
          cards: cards.slice(i, i + cardGrid.columns),
        });
      return out;
    }
    const newestFirst = (a: SetRow, b: SetRow) =>
      (b.release_date ?? '').localeCompare(a.release_date ?? '') ||
      // same day (e.g. several starter decks) or no date: by product number, newest first
      b.sort_order - a.sort_order;
    for (const section of SECTIONS) {
      const group = visibleSets
        .filter((s) => (section.groups as readonly string[]).includes(kindGroup(s.kind)))
        .sort(newestFirst);
      if (!group.length) continue;
      out.push({
        type: 'heading',
        key: `h-${section.key}`,
        label: t(`cardsPage.sections.${section.key}`),
        count: group.length,
        first: out.length === 0,
      });
      for (let i = 0; i < group.length; i += setGrid.columns) {
        out.push({
          type: 'sets',
          key: `${section.key}-${i}`,
          sets: group.slice(i, i + setGrid.columns),
        });
      }
    }
    return out;
  }, [searching, cards, cardGrid.columns, visibleSets, setGrid.columns, t]);

  const header = (
    <View style={styles.header}>
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
              ? t('cardsPage.setCount', {
                  count: visibleSets.length,
                  total: visibleSets.length.toLocaleString(i18n.language),
                })
              : ' '
        }
        fetching={searching ? search.isFetching && !search.isFetchingNextPage : sets.isFetching}
        actions={<LanguageSwitch />}
      />
      {!searching ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kindsBar}
          contentContainerStyle={styles.kinds}>
          {KIND_FILTERS.map((k) => (
            <Chip key={k} label={t(`cardsPage.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  const pending = searching ? search.isPending : sets.isPending;
  const error = searching ? (search.isError && cards.length === 0 ? search.error : null) : sets.isError ? sets.error : null;

  return (
    <Screen bleed>
      <FlatList
        data={pending || error ? [] : rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        contentContainerStyle={listColumn}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (searching && search.hasNextPage && !search.isFetchingNextPage) search.fetchNextPage();
        }}
        ListEmptyComponent={
          pending ? (
            <LoadingView />
          ) : error ? (
            <ErrorView error={error} onRetry={() => (searching ? search.refetch() : sets.refetch())} />
          ) : searching ? (
            <EmptyView
              message={t('search.noResults')}
              action={
                filters.activeFilterCount > 0
                  ? {
                      label: t('search.clearFilters'),
                      onPress: filters.clearFilters,
                    }
                  : undefined
              }
            />
          ) : (
            <EmptyView message={t('sets.empty')} />
          )
        }
        ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : undefined}
        renderItem={({ item }) => {
          if (item.type === 'heading') {
            return (
              <View style={[styles.sectionTitle, item.first && styles.firstSection]}>
                <Text variant="heading" accessibilityRole="header">
                  {item.label}
                </Text>
                <Text variant="caption" tone="secondary" style={tabular}>
                  {t('cardsPage.setCount', {
                    count: item.count,
                    total: item.count.toLocaleString(i18n.language),
                  })}
                </Text>
              </View>
            );
          }
          if (item.type === 'sets') {
            return (
              <View style={[styles.row, { gap: SET_TILE_GAP, marginBottom: spacing.lg }]}>
                {item.sets.map((set) => (
                  <SetTile
                    key={set.id}
                    set={set}
                    cover={covers.data?.[set.id]}
                    width={setGrid.tileWidth}
                    owned={progress.data ? (progress.data[set.id] ?? 0) : undefined}
                  />
                ))}
              </View>
            );
          }
          return (
            <View style={[styles.row, { gap: CARD_TILE_GAP }]}>
              {item.cards.map((card) => (
                <CardTile
                  key={card.id}
                  href={{ pathname: '/card/[id]', params: { id: card.id } }}
                  imageUrl={card.image_url}
                  code={card.id}
                  name={card.name}
                  width={cardGrid.tileWidth}
                  badge={card.printing_count > 1 ? t('search.arts', { count: card.printing_count }) : null}
                  quantity={ownedByCard[card.id] ?? 0}
                  showPips={Boolean(user)}
                  action={user ? <QuickAdd card={card} languages={params.languages} /> : undefined}
                />
              ))}
            </View>
          );
        }}
      />
    </Screen>
  );
}

/**
 * "+1" on a search result: adds the card's base art in the search language (English first), with an
 * Undo in the toast. For an alt art or another language, open the card and pick the printing.
 */
function QuickAdd({ card, languages }: { card: CardSearchResult; languages: Language[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const adjust = useAdjustQuantity();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const printing = await fetchQuickAddPrinting(card.id, languages.length ? languages : ['en', 'ja']);
      if (!printing) return;
      adjust.mutate({ printingId: printing.id, delta: 1 });
      showToast(t('cardsPage.quickAdded', { name: card.name, code: printing.code, language: t(`languages.short.${printing.language}`) }), {
        label: t('collection.undo'),
        onPress: () => adjust.mutate({ printingId: printing.id, delta: -1 }),
      });
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={add}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t('cardsPage.quickAdd', { name: card.name, code: card.id })}
      hitSlop={6}
      style={({ hovered, pressed }) => [
        styles.quickAdd,
        { borderColor: palette.text, backgroundColor: pressed ? palette.highlight : hovered ? palette.surfaceAlt : palette.surface },
        busy && { opacity: 0.5 },
      ]}>
      <Icon name="plus" size={18} />
    </Pressable>
  );
}

/**
 * One product: its key artwork (the illustration on the pack), then name, release date, card count
 * and progress. Without artwork it shows a card from the set, zoomed onto the illustration so the
 * "SAMPLE" mark printed lower on official card images stays out of view.
 */
function SetTile({ set, cover, width, owned }: { set: SetRow; cover?: SetCover; width: number; owned?: number }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const name = setDisplayName(set, t(`cardsPage.kindNames.${kindGroup(set.kind)}`));
  const date = formatReleaseDate(set.release_date, i18n.language, 'short');
  const complete = owned !== undefined && owned > 0 && owned >= set.printing_count;
  const cardArtWidth = width * 1.3;

  return (
    <Link href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${set.code}, ${name}`}
        boxStyle={[
          styles.tile,
          {
            width,
            backgroundColor: palette.surface,
            borderColor: palette.border,
            boxShadow: palette.shadow,
          },
        ]}
        activeStyle={styles.lift}>
        <View style={[styles.art, { backgroundColor: palette.surfaceAlt }]}>
          {set.image_url ? (
            <Image
              source={{ uri: set.image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              accessibilityLabel={name}
            />
          ) : cover?.image_url ? (
            <Image
              source={{ uri: cover.image_url }}
              style={{
                position: 'absolute',
                width: cardArtWidth,
                height: cardArtWidth / CARD_ASPECT_RATIO,
                left: (width - cardArtWidth) / 2,
                top: -cardArtWidth * 0.06,
              }}
              contentFit="cover"
              transition={150}
              accessibilityLabel={cover.name}
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
            {date
              ? `${date} · ${t('sets.printings', { count: set.printing_count })}`
              : t('sets.printings', { count: set.printing_count })}
          </Text>
          {owned !== undefined ? (
            <View style={styles.progress}>
              <ProgressBar
                value={set.printing_count ? owned / set.printing_count : 0}
                tone={complete ? 'success' : 'primary'}
                height={4}
              />
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

const styles = StyleSheet.create({
  quickAdd: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.lg, paddingBottom: spacing.sm },
  footer: { marginVertical: spacing.lg },
  kindsBar: { flexGrow: 0, flexShrink: 0 },
  kinds: { gap: spacing.sm, paddingVertical: spacing.xs },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  firstSection: { marginTop: spacing.md },
  row: { flexDirection: 'row' },
  tile: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  lift: Platform.OS === 'web' ? { transform: [{ translateY: -4 }] } : {},
  art: { aspectRatio: 4 / 3, width: '100%', overflow: 'hidden' },
  code: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  codeText: { color: '#FFFFFF' },
  tileBody: { padding: spacing.md, gap: 4 },
  name: { minHeight: 42 },
  progress: { gap: 4, marginTop: spacing.xs },
});
