import { rarityShort } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Switch, View } from 'react-native';

import { CardTile } from '@/components/card-tile';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useGridColumns } from '@/hooks/use-grid-columns';
import { fetchSet, fetchSetPrintings } from '@/lib/api';
import { spacing, usePalette } from '@/theme';

/** Every printing in one product, as a grid. This is where collection tracking will hook in (phase 2). */
export default function SetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const palette = usePalette();
  const { columns, tileWidth } = useGridColumns();
  const [showVariants, setShowVariants] = useState(true);

  const set = useQuery({ queryKey: ['set', id], queryFn: () => fetchSet(id) });
  const printings = useQuery({ queryKey: ['set-printings', id], queryFn: () => fetchSetPrintings(id) });

  const visible = useMemo(
    () => (printings.data ?? []).filter((p) => showVariants || p.variant === 'base'),
    [printings.data, showVariants],
  );

  const title = set.data ? `${set.data.code} · ${set.data.name}` : '';

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
          ListHeaderComponent={
            <View style={styles.header}>
              <Text variant="title">{title}</Text>
              <View style={styles.toggle}>
                <Text variant="caption" tone="secondary" style={styles.toggleLabel}>
                  {t('sets.printings', { count: visible.length })}
                </Text>
                <Text variant="caption">{t('sets.showVariants')}</Text>
                <Switch
                  value={showVariants}
                  onValueChange={setShowVariants}
                  accessibilityLabel={t('sets.showVariants')}
                  trackColor={{ true: palette.primary, false: palette.border }}
                  thumbColor={palette.surface}
                />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CardTile
              href={{ pathname: '/card/[id]', params: { id: item.card_id, printing: item.id } }}
              imageUrl={item.image_url}
              code={item.code}
              name={item.card?.name ?? item.name}
              width={tileWidth}
              badge={rarityShort(item.rarity)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { flex: 1 },
  list: { paddingBottom: spacing.xxl },
  row: { gap: spacing.sm },
});
