import { rarityShort, type Rarity } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Link, Redirect, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LanguageSwitch } from '@/components/language-switch';
import { PageHeader, ProgressBar, SectionTitle, StatGroup } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { EmptyView, LoadingView } from '@/components/ui/state-views';
import { ColorMark, RarityTag, useCardColor } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { collectionKeys, useSetProgress } from '@/hooks/use-collection';
import { fetchCollectionStats, fetchGrowth, fetchSets } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { formatReleaseDate, titleCase } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { radius, spacing, tabular, usePalette } from '@/theme';

const WEEKS = 12;
const SETS_SHOWN = 10;
/** Chase rarities first: that's what collectors count. */
const RARITY_ORDER: Rarity[] = ['SecretRare', 'Special', 'TreasureRare', 'SuperRare', 'Leader', 'Rare', 'Uncommon', 'Common', 'Promo'];

/** What your collection says about itself, in the app's card language. */
export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const cardColor = useCardColor();
  const { user, initializing } = useAuth();
  const [language] = useCardLanguage();
  const userId = user?.id ?? 'anon';
  const [allSets, setAllSets] = useState(false);

  const stats = useQuery({
    queryKey: [...collectionKeys.all(userId), 'stats', language],
    queryFn: () => fetchCollectionStats(language),
    enabled: Boolean(user),
  });
  const growth = useQuery({
    queryKey: [...collectionKeys.all(userId), 'growth', language],
    queryFn: () => fetchGrowth(language, WEEKS * 7),
    enabled: Boolean(user),
  });
  const sets = useQuery({ queryKey: ['sets', language], queryFn: () => fetchSets(language) });
  const progress = useSetProgress(language);

  const setRows = useMemo(
    () =>
      (sets.data ?? [])
        .map((s) => ({ set: s, owned: progress.data?.[s.id] ?? 0 }))
        .filter((x) => x.owned > 0 && x.set.printing_count > 0)
        .sort((a, b) => b.owned / b.set.printing_count - a.owned / a.set.printing_count),
    [sets.data, progress.data],
  );

  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;
  if (stats.isPending) return <LoadingView />;
  const s = stats.data;
  const n = (v: number) => v.toLocaleString(i18n.language);

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: t('stats.title') }} />
      <PageHeader title={t('stats.title')} subtitle={t('stats.subtitle')} actions={<LanguageSwitch />} />

      {!s || s.copies === 0 ? (
        <EmptyView message={t('stats.empty')} />
      ) : (
        <View style={styles.page}>
          <StatGroup
            stats={[
              { label: t('dashboard.stats.copies'), value: n(s.copies) },
              { label: t('dashboard.stats.cards'), value: n(s.cards), hint: t('stats.printings', { count: s.printings }) },
              {
                label: t('dashboard.stats.playsets'),
                value: n(s.playsets),
                hint: s.spares ? t('dashboard.stats.spares', { count: s.spares }) : undefined,
              },
              { label: t('stats.leaders'), value: n(s.leaders) },
            ]}
          />

          <Growth days={growth.data ?? []} since={s.since} />

          <View style={styles.section}>
            <SectionTitle title={t('stats.sets')} />
            {setRows.slice(0, allSets ? undefined : SETS_SHOWN).map(({ set, owned }) => (
              <Link key={set.id} href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
                <PressableArea accessibilityRole="link" boxStyle={[styles.row, { borderBottomColor: palette.border }]} activeStyle={{ backgroundColor: palette.primarySoft }}>
                  <View style={styles.rowHead}>
                    <Text variant="mono" style={styles.code}>
                      {set.code}
                    </Text>
                    <Text weight="semibold" numberOfLines={1} style={styles.flex}>
                      {titleCase(set.name)}
                    </Text>
                    <Text variant="caption" tone="secondary" style={tabular}>
                      {owned}/{set.printing_count} · {Math.round((owned / set.printing_count) * 100)}%
                    </Text>
                  </View>
                  <ProgressBar value={owned / set.printing_count} height={6} />
                </PressableArea>
              </Link>
            ))}
            {setRows.length > SETS_SHOWN ? (
              <Pressable onPress={() => setAllSets((v) => !v)} accessibilityRole="button" hitSlop={6} style={styles.more}>
                <Text variant="caption" weight="semibold" style={styles.underline}>
                  {allSets ? t('collection.filterPanel.fewerSets') : t('collection.filterPanel.allSets', { count: setRows.length })}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.pair}>
            <View style={[styles.section, styles.half]}>
              <SectionTitle title={t('stats.colors')} />
              <Bars
                rows={s.by_color.map((c) => ({
                  key: c.color,
                  label: t(`colors.${c.color}`),
                  mark: <ColorMark colors={[c.color]} size={12} />,
                  value: c.copies,
                  note: t('stats.cardsCount', { count: c.cards }),
                  color: cardColor(c.color),
                }))}
              />
            </View>
            <View style={[styles.section, styles.half]}>
              <SectionTitle title={t('stats.types')} />
              <Bars
                rows={s.by_category.map((c) => ({
                  key: c.category,
                  label: t(`categories.${c.category}`),
                  value: c.copies,
                  note: t('stats.cardsCount', { count: c.cards }),
                  color: palette.text,
                }))}
              />
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle title={t('stats.rarities')} />
            <Text variant="caption" tone="secondary">
              {t('stats.raritiesHint')}
            </Text>
            {RARITY_ORDER.map((r) => s.by_rarity.find((x) => x.rarity === r))
              .filter((x): x is NonNullable<typeof x> => Boolean(x))
              .map((r) => (
                <View key={r.rarity} style={[styles.rarityRow, { borderBottomColor: palette.border }]} accessible accessibilityLabel={`${t(`rarities.${r.rarity}`)}: ${r.owned} / ${r.total}`}>
                  <View style={styles.rarityTag}>
                    <RarityTag code={rarityShort(r.rarity)} />
                  </View>
                  <Text weight="semibold" style={styles.rarityName} numberOfLines={1}>
                    {t(`rarities.${r.rarity}`)}
                  </Text>
                  <View style={styles.flex}>
                    <ProgressBar value={r.total ? r.owned / r.total : 0} height={6} />
                  </View>
                  <Text variant="mono" tone="secondary" style={[styles.count, tabular]}>
                    {r.owned}/{r.total}
                  </Text>
                </View>
              ))}
          </View>

          {s.since ? (
            <Text variant="caption" tone="muted">
              {t('stats.since', { date: formatReleaseDate(s.since, i18n.language, 'long') })}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** Horizontal bars, labelled with their numbers (no axis to read). */
function Bars({ rows }: { rows: { key: string; label: string; mark?: React.ReactNode; value: number; note: string; color: string }[] }) {
  const palette = usePalette();
  const peak = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.bars}>
      {rows.map((r) => (
        <View key={r.key} style={styles.barRow} accessible accessibilityLabel={`${r.label}: ${r.value}, ${r.note}`}>
          <View style={styles.barLabel}>
            {r.mark}
            <Text variant="caption" weight="semibold" numberOfLines={1}>
              {r.label}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: palette.surfaceAlt }]}>
            <View style={[styles.fill, { width: `${(r.value / peak) * 100}%`, backgroundColor: r.color }]} />
          </View>
          <Text variant="mono" style={[styles.barValue, tabular]}>
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Copies added and removed per week, from the activity log; tap a week for its numbers. */
function Growth({ days, since }: { days: { day: string; added: number; removed: number }[]; since: string | null }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const [active, setActive] = useState<number | null>(null);
  const weeks = useMemo(() => {
    const out = Array.from({ length: WEEKS }, (_, i) => ({ index: i, added: 0, removed: 0, start: '' }));
    const now = Date.now();
    for (let i = 0; i < WEEKS; i++) out[i].start = new Date(now - (WEEKS - i) * 7 * 86400000 + 86400000).toISOString();
    for (const d of days) {
      const ago = Math.floor((now - new Date(`${d.day}T12:00:00Z`).getTime()) / (7 * 86400000));
      const i = WEEKS - 1 - ago;
      if (i >= 0 && i < WEEKS) {
        out[i].added += d.added;
        out[i].removed += d.removed;
      }
    }
    return out;
  }, [days]);
  if (!since) return null;
  const peak = Math.max(1, ...weeks.map((w) => Math.max(w.added, w.removed)));
  const shown = active == null ? null : weeks[active];

  return (
    <View style={styles.section}>
      <SectionTitle title={t('stats.growth')} />
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.key, { backgroundColor: palette.highlight, borderColor: palette.text }]} />
        <Text variant="caption" tone="secondary">
          {t('stats.added')}
        </Text>
        <View style={[styles.key, { backgroundColor: palette.dangerSoft, borderColor: palette.danger }]} />
        <Text variant="caption" tone="secondary">
          {t('stats.removed')}
        </Text>
      </View>
      <View style={[styles.plot, { borderBottomColor: palette.rule }]}>
        {weeks.map((w) => (
          <Pressable
            key={w.index}
            onPress={() => setActive(active === w.index ? null : w.index)}
            onHoverIn={() => setActive(w.index)}
            onHoverOut={() => setActive(null)}
            accessibilityRole="button"
            accessibilityLabel={t('stats.weekBar', { date: formatReleaseDate(w.start, i18n.language, 'short'), added: w.added, removed: w.removed })}
            style={[styles.week, active === w.index && { backgroundColor: palette.primarySoft }]}>
            <View style={[styles.weekBar, { height: (w.added / peak) * 80, backgroundColor: palette.highlight, borderColor: palette.text, borderWidth: w.added ? 1 : 0 }]} />
            <View style={[styles.weekBar, { height: (w.removed / peak) * 80, backgroundColor: palette.dangerSoft, borderColor: palette.danger, borderWidth: w.removed ? 1 : 0 }]} />
          </Pressable>
        ))}
      </View>
      <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
        {shown
          ? t('stats.weekDetail', { date: formatReleaseDate(shown.start, i18n.language, 'short'), added: shown.added, removed: shown.removed })
          : t('stats.growthHint', { weeks: WEEKS })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.xxl },
  section: { gap: spacing.sm },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxl },
  half: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  row: { gap: 6, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: { width: 64 },
  more: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  underline: { textDecorationLine: 'underline' },
  bars: { gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  barLabel: { width: 108, flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 12, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
  barValue: { minWidth: 40, textAlign: 'right' },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth },
  rarityTag: { width: 40 },
  rarityName: { width: 120 },
  count: { minWidth: 76, textAlign: 'right' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  key: { width: 10, height: 10, borderWidth: 1, borderRadius: 2, marginLeft: spacing.sm },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 2, height: 96, paddingTop: spacing.sm },
  week: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: '100%', borderRadius: 3 },
  weekBar: { width: '34%', maxWidth: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
