import { SET_KINDS, compareSets, type Language, type SetRow } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { PageHeader, ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useSetProgress } from '@/hooks/use-collection';
import { fetchSets } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { spacing, tabular, usePalette } from '@/theme';

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
      <PageHeader
        title={t('sets.title')}
        subtitle={t('sets.subtitle')}
        actions={
          <Segmented
            accessibilityLabel={t('search.language')}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: t('languages.en') },
              { value: 'ja', label: t('languages.ja') },
            ]}
          />
        }
      />
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
            <View style={styles.sectionHeader}>
              <Text variant="subheading" weight="semibold" role="heading" aria-level={2}>
                {section.title}
              </Text>
              <Text variant="caption" tone="secondary" style={tabular}>
                {t('sets.count', { count: section.data.length })}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SetRowItem set={item} owned={progress.data ? (progress.data[item.id] ?? 0) : undefined} />
          )}
        />
      )}
    </Screen>
  );
}

/** One product as a list row; `owned` is undefined when signed out (no progress shown). */
function SetRowItem({ set, owned }: { set: SetRow; owned?: number }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const n = (value: number) => value.toLocaleString(i18n.language);
  const phone = useWindowDimensions().width < 600;
  return (
    <Link href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${set.code}, ${set.name}`}
        boxStyle={[styles.row, { borderBottomColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.backgroundAlt }}>
        <Text weight="semibold" style={[styles.code, phone && styles.codePhone, tabular]} numberOfLines={1}>
          {set.code}
        </Text>
        <Text variant="body" numberOfLines={phone ? 2 : 1} style={styles.name}>
          {titleCase(set.name)}
        </Text>
        {owned !== undefined ? (
          <View style={[styles.progress, phone && styles.figurePhone]}>
            <Text style={[tabular, styles.right]}>
              {n(owned)}
              <Text tone="secondary" style={tabular}>{` / ${n(set.printing_count)}`}</Text>
            </Text>
            <ProgressBar value={set.printing_count ? owned / set.printing_count : 0} tone={owned >= set.printing_count && owned > 0 ? 'accent' : 'neutral'} height={4} />
          </View>
        ) : (
          <Text tone="secondary" style={[tabular, styles.right, styles.count, phone && styles.figurePhone]}>
            {t('sets.printings', { count: set.printing_count })}
          </Text>
        )}
        <Icon name="chevron-right" size={16} color={palette.textMuted} />
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: 1 },
  code: { width: 96 },
  codePhone: { width: 76 },
  figurePhone: { width: 84 },
  name: { flex: 1, minWidth: 0 },
  progress: { width: 140, gap: 6 },
  count: { width: 140 },
  right: { textAlign: 'right' },
});
