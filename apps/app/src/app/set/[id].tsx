import { rarityShort } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { AppSwitch } from '@/components/ui/app-switch';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useAdjustQuantity, useCollectionQuantities } from '@/hooks/use-collection';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { fetchSet, fetchSetPrintings } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { radius, spacing, usePalette } from '@/theme';

type OwnedFilter = 'all' | 'owned' | 'missing';

/** Every printing in one product. Signed-in users can tick off what they own ("collect mode"). */
export default function SetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
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
  const owned = quantities.data ?? {};

  const variantFiltered = useMemo(
    () => (printings.data ?? []).filter((p) => showVariants || p.variant === 'base'),
    [printings.data, showVariants],
  );
  const ownedCount = variantFiltered.filter((p) => (owned[p.id] ?? 0) > 0).length;
  const visible = variantFiltered.filter((p) => {
    const has = (owned[p.id] ?? 0) > 0;
    return ownedFilter === 'all' || (ownedFilter === 'owned' ? has : !has);
  });
  const percent = variantFiltered.length ? Math.round((ownedCount / variantFiltered.length) * 100) : 0;

  const header = (
    <View style={styles.header}>
      <Text variant="title">{set.data ? `${set.data.code} · ${set.data.name}` : ''}</Text>

      {user ? (
        <View style={styles.progressBlock}>
          <Text variant="subheading">
            {t('collection.setProgress', { owned: ownedCount, total: variantFiltered.length, percent })}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: palette.surfaceAlt }]}>
            <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: palette.primary }]} />
          </View>
        </View>
      ) : (
        <Link href="/auth/sign-in" asChild>
          <PressableArea accessibilityRole="link">
            <Text variant="caption" tone="primary" style={styles.bold}>
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
      <Text variant="caption" tone="secondary">
        {t('sets.printings', { count: visible.length })}
      </Text>
    </View>
  );

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
          key={columns}
          data={visible}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyView message={t('collection.nothingHere')} />}
          renderItem={({ item }) => {
            const quantity = owned[item.id] ?? 0;
            const name = item.card?.name ?? item.name;
            return collectMode ? (
              <CardTile
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
                      style={[styles.minus, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      <Text variant="subheading">−</Text>
                    </Pressable>
                  ) : null
                }
              />
            ) : (
              <CardTile
                href={{ pathname: '/card/[id]', params: { id: item.card_id, printing: item.id } }}
                imageUrl={item.image_url}
                code={item.code}
                name={name}
                width={tileWidth}
                badge={rarityShort(item.rarity)}
                quantity={quantity}
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text variant="caption">{label}</Text>
      <AppSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  bold: { fontWeight: '700' },
  progressBlock: { gap: spacing.xs },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  row: { gap: spacing.sm },
  minus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
