import { isOwnSetCard, rarityShort } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { AppSwitch } from '@/components/ui/app-switch';
import { Icon } from '@/components/ui/icon';
import { Panel, ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { fetchSet, fetchSetPrintings, type SetPrinting } from '@/lib/api';
import { formatReleaseDate, titleCase } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { spacing, usePalette } from '@/theme';

type OwnedFilter = 'all' | 'owned' | 'missing';
type Row = { type: 'header'; key: string; title: string; hint?: string } | { type: 'cards'; key: string; items: SetPrinting[] };

/**
 * Every printing in one product. A pack's own cards come first; special inserts
 * (SP / reprints of older cards sold in the same packs) follow in their own section.
 * Signed-in users can tick off what they own ("Tap to collect").
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

  const set = useQuery({ queryKey: ['set', id], queryFn: () => fetchSet(id) });
  const printings = useQuery({ queryKey: ['set-printings', id], queryFn: () => fetchSetPrintings(id) });
  const quantities = useCollectionQuantities({ setId: id });
  const adjust = useAdjustQuantity();
  const owned = useMemo(() => quantities.data ?? {}, [quantities.data]);

  const variantFiltered = useMemo(
    () => (printings.data ?? []).filter((p) => showVariants || p.variant === 'base'),
    [printings.data, showVariants],
  );
  const ownedCount = variantFiltered.filter((p) => (owned[p.id] ?? 0) > 0).length;
  const percent = variantFiltered.length ? Math.round((ownedCount / variantFiltered.length) * 100) : 0;

  const rows = useMemo<Row[]>(() => {
    if (!set.data) return [];
    const visible = variantFiltered.filter((p) => {
      const has = (owned[p.id] ?? 0) > 0;
      return ownedFilter === 'all' || (ownedFilter === 'owned' ? has : !has);
    });
    const own = visible.filter((p) => isOwnSetCard(p.card_id, set.data!.code));
    const inserts = visible.filter((p) => !isOwnSetCard(p.card_id, set.data!.code));
    const chunk = (items: SetPrinting[], prefix: string): Row[] =>
      Array.from({ length: Math.ceil(items.length / columns) }, (_, i) => ({
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
  }, [set.data, variantFiltered, owned, ownedFilter, columns, t]);

  const renderTile = (item: SetPrinting) => {
    const quantity = owned[item.id] ?? 0;
    const name = item.card?.name ?? item.name;
    return collectMode ? (
      <CardTile
        key={item.id}
        onPress={() => adjust.mutate({ printingId: item.id, delta: 1 })}
        accessibilityHint={t('collection.addOne', { card: item.code })}
        imageUrl={item.image_url}
        code={item.code}
        name={name}
        width={tileWidth}
        badge={rarityShort(item.rarity)}
        quantity={quantity}
        dimmed={quantity === 0}
        overlay={
          quantity > 0 ? (
            <Pressable
              onPress={() => adjust.mutate({ printingId: item.id, delta: -1 })}
              accessibilityRole="button"
              accessibilityLabel={t('collection.removeOne', { card: item.code })}
              hitSlop={8}
              style={[styles.minus, { backgroundColor: palette.surfaceRaised, borderColor: palette.border, boxShadow: palette.shadow }]}>
              <Icon name="minus" size={16} />
            </Pressable>
          ) : null
        }
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
      />
    );
  };

  const header = set.data ? (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {set.data.image_url ? (
          <View style={styles.pack}>
            <Image source={{ uri: set.data.image_url }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={set.data.name} />
          </View>
        ) : null}
        <View style={[styles.titleBlock, styles.flexShrink]}>
          <Text variant="eyebrow" tone="primary">
            {set.data.code} · {t(`sets.kinds.${set.data.kind}`)} · {t(`languages.${set.data.language}`)}
          </Text>
          <Text variant="title">{titleCase(set.data.name)}</Text>
          {set.data.release_date ? (
            <Text variant="caption" tone="secondary">
              {t('sets.released', {
                date: formatReleaseDate(set.data.release_date, i18n.language, 'long'),
              })}
            </Text>
          ) : null}
        </View>
      </View>

      {user ? (
        <Panel style={styles.progressPanel}>
          <View style={styles.row}>
            <Text variant="subheading" style={styles.flex}>
              {t('collection.setProgress', { owned: ownedCount, total: variantFiltered.length, percent })}
            </Text>
          </View>
          <ProgressBar value={percent / 100} tone={percent === 100 ? 'success' : 'primary'} />
        </Panel>
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
        {user ? <ToggleRow label={t('collection.collectMode')} value={collectMode} onChange={setCollectMode} /> : null}
      </View>
      {collectMode ? (
        <Text variant="caption" tone="secondary">
          {t('collection.collectModeHint')}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <Screen edges={[]}>
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
          contentContainerStyle={styles.list}
          ListHeaderComponent={header ?? undefined}
          ListEmptyComponent={<EmptyView message={t('collection.nothingHere')} />}
          renderItem={({ item: row }) =>
            row.type === 'header' ? (
              <View style={[styles.sectionHeader, { borderTopColor: palette.border }]}>
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
    </Screen>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text variant="caption" weight="medium">
        {label}
      </Text>
      <AppSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  titleBlock: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pack: { width: 88, height: 88, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  flexShrink: { flexShrink: 1 },
  progressPanel: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { paddingBottom: spacing.xxxl },
  cardRow: { flexDirection: 'row', gap: spacing.sm },
  sectionHeader: { paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm },
  minus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
