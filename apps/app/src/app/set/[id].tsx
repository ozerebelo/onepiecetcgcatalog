import { CATEGORIES, RARITIES, isOwnSetCard, rarityShort, type Category } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { ChecklistHeader, ChecklistRow } from '@/components/checklist';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/panel';
import { PipsLegend } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen, listColumn } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { RarityTag } from '@/components/ui/tcg';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities, useOwnedByCard } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { fetchSet, fetchSetPrintings, type SetPrinting } from '@/lib/api';
import { formatReleaseDate, printingLabel, titleCase, variantName } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { PLAYSET, fonts, radius, spacing, tabular, usePalette } from '@/theme';

type OwnedFilter = 'all' | 'owned' | 'missing';
type ViewMode = 'checklist' | 'grid';
type Row =
  | { type: 'header'; key: string; title: string; hint?: string }
  | { type: 'columns'; key: string }
  | { type: 'item'; key: string; item: SetPrinting }
  | { type: 'cards'; key: string; items: SetPrinting[] };

/**
 * Every printing in one product, as a printed checklist (number · card · rarity · playset slots)
 * or as a grid of card images. A pack's own cards come first; special inserts (SP / reprints of
 * older cards sold in the same packs) follow in their own section. Signed-in users tick off what
 * they own ("Tap to collect").
 */
export default function SetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const { columns, tileWidth } = useGridColumns();
  const [showVariants, setShowVariants] = useState(true);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all');
  const [collectMode, setCollectMode] = useState(false);
  const [view, setView] = useState<ViewMode>('checklist');
  const [type, setType] = useState<Category | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** The last tap in collect mode, so it can be undone from the tally strip. */
  const [lastChange, setLastChange] = useState<{ item: SetPrinting; delta: number } | null>(null);
  const { width } = useWindowDimensions();
  const compact = width < 560;

  const set = useQuery({ queryKey: ['set', id], queryFn: () => fetchSet(id) });
  const printings = useQuery({ queryKey: ['set-printings', id], queryFn: () => fetchSetPrintings(id) });
  const quantities = useCollectionQuantities({ setId: id });
  const adjust = useAdjustQuantity();
  const owned = useMemo(() => quantities.data ?? {}, [quantities.data]);
  // The playset counts every printing of a card, in any set or language: 2 base + 2 alt art is a playset.
  const byCard = useOwnedByCard(set.data?.language);

  const variantFiltered = useMemo(
    () => (printings.data ?? []).filter((p) => showVariants || p.variant === 'base'),
    [printings.data, showVariants],
  );
  const ownedCount = variantFiltered.filter((p) => (owned[p.id] ?? 0) > 0).length;
  // Card types present in this product, in the game's order (Leader, Character, Event, Stage).
  const types = useMemo(() => {
    const present = new Set((printings.data ?? []).map((p) => p.card?.category));
    return CATEGORIES.filter((c) => present.has(c));
  }, [printings.data]);
  const percent = variantFiltered.length ? Math.round((ownedCount / variantFiltered.length) * 100) : 0;
  const cardIds = useMemo(() => [...new Set((printings.data ?? []).map((p) => p.card_id))], [printings.data]);
  const fullPlaysets = cardIds.filter((cardId) => (byCard[cardId] ?? 0) >= PLAYSET).length;
  // Printings owned per rarity, chase rarities last, as a collector reads a set.
  const byRarity = useMemo(
    () =>
      RARITIES.map((rarity) => {
        const all = variantFiltered.filter((p) => p.rarity === rarity);
        return { rarity, total: all.length, owned: all.filter((p) => (owned[p.id] ?? 0) > 0).length };
      }).filter((r) => r.total > 0),
    [variantFiltered, owned],
  );

  const rows = useMemo<Row[]>(() => {
    if (!set.data) return [];
    const visible = variantFiltered.filter((p) => {
      if (type !== 'all' && p.card?.category !== type) return false;
      const has = (owned[p.id] ?? 0) > 0;
      return ownedFilter === 'all' || (ownedFilter === 'owned' ? has : !has);
    });
    const own = visible.filter((p) => isOwnSetCard(p.card_id, set.data!.code));
    const inserts = visible.filter((p) => !isOwnSetCard(p.card_id, set.data!.code));
    const chunk = (items: SetPrinting[], prefix: string): Row[] =>
      view === 'checklist'
        ? items.length
          ? [{ type: 'columns' as const, key: `${prefix}-cols` }, ...items.map((item) => ({ type: 'item' as const, key: item.id, item }))]
          : []
        : Array.from({ length: Math.ceil(items.length / columns) }, (_, i) => ({
            type: 'cards' as const,
            key: `${prefix}-${i}`,
            items: items.slice(i * columns, i * columns + columns),
          }));
    return [
      ...chunk(own, 'own'),
      ...(inserts.length
        ? [
            { type: 'header' as const, key: 'inserts', title: t('sets.inserts', { count: inserts.length }), hint: t('sets.insertsHint') },
            ...chunk(inserts, 'ins'),
          ]
        : []),
    ];
  }, [set.data, variantFiltered, owned, ownedFilter, type, columns, view, t]);

  const collect = (item: SetPrinting, delta: number) => {
    adjust.mutate({ printingId: item.id, delta });
    setLastChange({ item, delta });
  };
  const undo = () => {
    if (!lastChange) return;
    adjust.mutate({ printingId: lastChange.item.id, delta: -lastChange.delta });
    setLastChange(null);
  };

  const renderTile = (item: SetPrinting) => {
    const quantity = owned[item.id] ?? 0;
    const name = item.card?.name ?? item.name;
    return collectMode ? (
      <CardTile
        key={item.id}
        onPress={() => collect(item, 1)}
        accessibilityHint={t('collection.addOne', { card: item.code })}
        imageUrl={item.image_url}
        code={item.code}
        name={name}
        width={tileWidth}
        badge={rarityShort(item.rarity)}
        quantity={quantity}
        ownedCard={byCard[item.card_id] ?? 0}
        showPips
        dimmed={quantity === 0}
        overlay={quantity > 0 ? removeButton(item) : null}
      />
    ) : (
      <CardTile
        key={item.id}
        href={{ pathname: '/card/[id]', params: { id: item.card_id, printing: item.id } }}
        imageUrl={item.image_url}
        code={item.code}
        name={name}
        width={tileWidth}
        badge={rarityShort(item.rarity)}
        quantity={quantity}
        ownedCard={user ? (byCard[item.card_id] ?? 0) : undefined}
        showPips={Boolean(user)}
      />
    );
  };

  const removeButton = (item: SetPrinting) => (
    <Pressable
      onPress={() => collect(item, -1)}
      accessibilityRole="button"
      accessibilityLabel={t('collection.removeOne', { card: item.code })}
      style={({ hovered }) => [styles.minus, { backgroundColor: hovered ? palette.surfaceAlt : palette.surface, borderColor: palette.text }]}>
      <Icon name="minus" size={16} />
    </Pressable>
  );

  /** One checklist row: tap to open the card, or (collect mode) to add a copy. */
  const renderRow = (item: SetPrinting) => {
    const quantity = owned[item.id] ?? 0;
    const cardTotal = byCard[item.card_id] ?? 0;
    const name = item.card?.name ?? item.name;
    const label = printingLabel(item.code, t);
    const common = {
      code: item.card_id,
      name,
      variant: item.variant === 'base' ? null : variantName(item.variant, item.variant_index, t),
      rarity: rarityShort(item.rarity),
      owned: user ? quantity : undefined,
      ownedCard: user ? cardTotal : undefined,
      colors: item.card?.colors,
      cost: item.card?.cost,
      life: item.card?.category === 'Leader',
      accessibilityLabel: [
        name,
        label,
        quantity > 0 ? `×${quantity}` : null,
        user ? t('collection.playsetOf', { count: cardTotal, playset: PLAYSET }) : null,
      ]
        .filter(Boolean)
        .join(', '),
    };
    return collectMode ? (
      <ChecklistRow
        {...common}
        onPress={() => collect(item, 1)}
        accessibilityHint={t('collection.addOne', { card: item.code })}
        trailing={<View style={styles.trailing}>{quantity > 0 ? removeButton(item) : null}</View>}
      />
    ) : (
      <ChecklistRow {...common} href={{ pathname: '/card/[id]', params: { id: item.card_id, printing: item.id } }} />
    );
  };

  const activeFilters = (type !== 'all' ? 1 : 0) + (ownedFilter !== 'all' ? 1 : 0) + (showVariants ? 0 : 1);
  const filterControls = (
    <>
      {types.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesBar} contentContainerStyle={styles.types}>
          <Chip label={t('sets.types.all')} selected={type === 'all'} onPress={() => setType('all')} />
          {types.map((c) => (
            <Chip key={c} label={t(`sets.types.${c}`)} selected={type === c} onPress={() => setType(c)} />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.controls}>
        {user ? (
          <Segmented
            accessibilityLabel={t('collection.ownedFilter')}
            value={ownedFilter}
            onChange={setOwnedFilter}
            options={[
              { value: 'all', label: t('collection.filters.all') },
              { value: 'owned', label: t('collection.filters.owned') },
              { value: 'missing', label: t('collection.filters.missing') },
            ]}
          />
        ) : null}
        <ToggleRow label={t('sets.showVariants')} value={showVariants} onChange={setShowVariants} />
      </View>
    </>
  );

  const header = set.data ? (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {set.data.image_url ? (
          <View style={[styles.pack, compact && styles.packCompact]}>
            <Image source={{ uri: set.data.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={set.data.name} />
          </View>
        ) : null}
        <View style={[styles.titleBlock, styles.flexShrink]}>
          <Text variant="title" accessibilityRole="header">
            {titleCase(set.data.name)}
          </Text>
          <Text variant="mono" tone="secondary">
            {[
              set.data.code,
              t(`sets.kinds.${set.data.kind}`),
              t(`languages.${set.data.language}`),
              set.data.release_date ? formatReleaseDate(set.data.release_date, i18n.language, 'long') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      {user ? (
        <View style={styles.progress}>
          <Text variant="subheading">{t('collection.setProgress', { owned: ownedCount, total: variantFiltered.length, percent })}</Text>
          <ProgressBar value={percent / 100} />
          <Text tone="secondary">{t('collection.fullPlaysets', { count: fullPlaysets, total: cardIds.length })}</Text>
          {view === 'checklist' ? <PipsLegend here={t('collection.legendHere')} elsewhere={t('collection.legendElsewhere')} /> : null}
          {/* Completion by rarity: the chase cards are what a collector counts. */}
          <View style={styles.rarities}>
            {byRarity.map((r) => (
              <View key={r.rarity} style={styles.rarity} accessibilityLabel={`${t(`rarities.${r.rarity}`)}: ${r.owned} / ${r.total}`}>
                <RarityTag code={rarityShort(r.rarity)} />
                <Text variant="mono" style={[tabular, { color: r.owned === r.total ? palette.text : palette.textSecondary }]}>
                  {r.owned}/{r.total}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Link href="/auth/sign-in" asChild>
          <PressableArea accessibilityRole="link">
            <Text variant="caption" tone="primary" weight="semibold">
              {t('collection.signInToTrack')}
            </Text>
          </PressableArea>
        </Link>
      )}

      <View style={styles.controls}>
        <Segmented
          accessibilityLabel={t('sets.viewLabel')}
          value={view}
          onChange={setView}
          options={[
            { value: 'checklist', label: t('sets.views.checklist') },
            { value: 'grid', label: t('sets.views.grid') },
          ]}
        />
        {user ? <ToggleRow label={t('collection.collectMode')} value={collectMode} onChange={(v) => { setCollectMode(v); setLastChange(null); }} /> : null}
        {user && set.data ? (
          // Logging a box by card number is faster than tapping through the checklist.
          <Link href={{ pathname: '/collection/packs', params: { set: set.data.id } }} asChild>
            <Button title={t('packs.fromSet')} icon="package" variant="outline" size="sm" />
          </Link>
        ) : null}
        {compact ? (
          <Button
            title={activeFilters ? t('sets.filtersCount', { count: activeFilters }) : t('sets.filters')}
            variant="ghost"
            size="sm"
            trailingIcon={filtersOpen ? 'chevron-up' : 'chevron-down'}
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((v) => !v)}
          />
        ) : null}
      </View>
      {!compact || filtersOpen ? filterControls : null}
      {collectMode ? (
        <Text variant="caption" tone="secondary">
          {t('collection.collectModeHint')}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <Screen edges={[]} bleed>
      <Stack.Screen options={{ title: set.data?.code ?? '' }} />
      {set.isPending || printings.isPending ? (
        <LoadingView />
      ) : set.isError || printings.isError ? (
        <ErrorView
          error={set.error ?? printings.error}
          onRetry={() => {
            set.refetch();
            printings.refetch();
          }}
        />
      ) : !set.data ? (
        <EmptyView message={t('common.notFound')} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={[listColumn, collectMode && styles.roomForTally]}
          ListHeaderComponent={header ?? undefined}
          ListEmptyComponent={<EmptyView message={t('collection.nothingHere')} />}
          renderItem={({ item: row }) =>
            row.type === 'columns' ? (
              <ChecklistHeader
                number={t('sets.columns.number')}
                card={t('sets.columns.card')}
                rarity={t('sets.columns.rarity')}
                playset={t('sets.columns.playset')}
              />
            ) : row.type === 'item' ? (
              renderRow(row.item)
            ) : row.type === 'header' ? (
              <View style={[styles.sectionHeader, { borderTopColor: palette.rule }]}>
                <Text variant="heading">{row.title}</Text>
                {row.hint ? (
                  <Text variant="caption" tone="secondary">
                    {row.hint}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.cardRow}>{row.items.map(renderTile)}</View>
            )
          }
        />
      )}
      {collectMode && set.data ? (
        // The tally strip: always in thumb reach while collecting, with the last tap undoable.
        <View style={[styles.tally, { backgroundColor: palette.primary }]} accessibilityLiveRegion="polite">
          <View style={styles.tallyInner}>
            <View style={styles.flexShrink}>
              <Text style={[styles.tallyCount, { color: palette.onPrimary }]}>
                {t('collection.tally', { owned: ownedCount, total: variantFiltered.length })}
              </Text>
              {lastChange ? (
                <Text variant="caption" style={{ color: palette.onPrimary }} numberOfLines={1}>
                  {t(lastChange.delta > 0 ? 'collection.tallyAdded' : 'collection.tallyRemoved', {
                    card: `${lastChange.item.card?.name ?? lastChange.item.name} ${printingLabel(lastChange.item.code, t)}`,
                  })}
                </Text>
              ) : null}
            </View>
            {lastChange ? (
              <Pressable accessibilityRole="button" onPress={undo} style={styles.tallyButton}>
                <Text style={[styles.tallyAction, { color: palette.onPrimary }]}>{t('collection.undo')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCollectMode(false);
                setLastChange(null);
              }}
              style={[styles.tallyButton, styles.tallyDone, { borderColor: palette.onPrimary }]}>
              <Text style={[styles.tallyAction, { color: palette.onPrimary, textDecorationLine: 'none' }]}>{t('collection.doneCollecting')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/** A labelled switch where the whole row (label included) is one 44px target. */
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ hovered }) => [styles.toggle, hovered && { backgroundColor: palette.primarySoft }]}>
      <Text variant="caption" weight="medium">
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: value ? palette.text : 'transparent', borderColor: value ? palette.text : palette.slot }]}>
        <View style={[styles.knob, { backgroundColor: value ? palette.background : palette.slot }, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  titleBlock: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pack: { width: 136, aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden' },
  flexShrink: { flexShrink: 1 },
  packCompact: { width: 88 },
  progress: { gap: spacing.sm, paddingTop: spacing.xs },
  rarities: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  rarity: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  typesBar: { flexGrow: 0, flexShrink: 0 },
  types: { gap: spacing.sm },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.xs, borderRadius: radius.sm },
  track: { width: 36, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: 13, height: 13, borderRadius: 7 },
  knobOn: { alignSelf: 'flex-end' },
  roomForTally: { paddingBottom: 120 },
  tally: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  tallyInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  tallyCount: { fontFamily: fonts.monoBold, fontSize: 15 },
  tallyButton: { minHeight: 44, minWidth: 64, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, marginLeft: 'auto' },
  tallyDone: { borderWidth: 1.5, marginLeft: 0 },
  tallyAction: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: 'underline' },
  cardRow: { flexDirection: 'row', gap: spacing.sm },
  sectionHeader: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs, borderTopWidth: 2, marginTop: spacing.xxl },
  trailing: { width: 44, alignItems: 'flex-end' },
  minus: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
