import { SET_KINDS, compareSets, type Language, type SetRow } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';

import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useSetProgress } from '@/hooks/use-collection';
import { fetchSets } from '@/lib/api';
import { radius, spacing, usePalette } from '@/theme';

export default function SetsScreen() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<Language>('en');
  const sets = useQuery({ queryKey: ['sets', language], queryFn: () => fetchSets(language) });
  const progress = useSetProgress(language);

  const sections = useMemo(() => {
    const sorted = [...(sets.data ?? [])].sort(compareSets);
    return SET_KINDS.map((kind) => ({
      kind,
      title: t(`sets.kinds.${kind}`),
      data: sorted.filter((s) => s.kind === kind),
    })).filter((section) => section.data.length > 0);
  }, [sets.data, t]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{t('sets.title')}</Text>
        <Segmented
          accessibilityLabel={t('search.language')}
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: t('languages.en') },
            { value: 'ja', label: t('languages.ja') },
          ]}
        />
      </View>
      {sets.isPending ? (
        <LoadingView />
      ) : sets.isError ? (
        <ErrorView error={sets.error} onRetry={() => sets.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyView message={t('sets.empty')} />}
          renderSectionHeader={({ section }) => (
            <Text variant="label" tone="secondary" style={styles.sectionHeader}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <SetRowItem set={item} owned={progress.data ? (progress.data[item.id] ?? 0) : undefined} />
          )}
        />
      )}
    </Screen>
  );
}

/** `owned` is undefined when signed out (no progress shown). */
function SetRowItem({ set, owned }: { set: SetRow; owned?: number }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const progress =
    owned === undefined
      ? null
      : { owned, percent: set.printing_count ? Math.round((owned / set.printing_count) * 100) : 0 };
  return (
    <Link href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        boxStyle={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.code, { backgroundColor: palette.surfaceAlt }]}>
          <Text variant="mono" style={styles.codeText} numberOfLines={1}>
            {set.code}
          </Text>
        </View>
        <View style={styles.rowText}>
          <Text variant="subheading" numberOfLines={1}>
            {set.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {progress !== null
              ? t('collection.setRowProgress', { owned: progress.owned, total: set.printing_count })
              : t('sets.printings', { count: set.printing_count })}
          </Text>
          {progress !== null ? (
            <View style={[styles.track, { backgroundColor: palette.surfaceAlt }]}>
              <View style={[styles.fill, { width: `${progress.percent}%`, backgroundColor: palette.primary }]} />
            </View>
          ) : null}
        </View>
        <Text tone="muted">›</Text>
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, gap: spacing.md },
  list: { paddingBottom: spacing.xxl },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  code: { minWidth: 84, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  codeText: { fontWeight: '700' },
  rowText: { flex: 1, gap: 2 },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%' },
});
