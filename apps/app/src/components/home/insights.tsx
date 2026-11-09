import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { ProgressBar, SectionTitle } from '@/components/ui/panel';
import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { CostBadge } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { collectionKeys, useAdjustQuantity, useSetProgress } from '@/hooks/use-collection';
import { fetchActivity, fetchNearPlaysets, fetchSets, type ActivityEvent, type DeckSummary } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { printingLabel, titleCase } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { radius, spacing, tabular, usePalette } from '@/theme';

/**
 * "Almost there": what's closest to done — cards a copy or two short of a playset, sets nearly
 * complete, the deck you're closest to building. Each one is a reason to open a pack or a binder.
 */
export function AlmostThere({ decks }: { decks: DeckSummary[] | undefined }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const near = useQuery({
    queryKey: [...collectionKeys.all(user?.id ?? 'anon'), 'near-playsets', language],
    queryFn: () => fetchNearPlaysets(language, 10),
    enabled: Boolean(user),
  });
  const sets = useQuery({ queryKey: ['sets', language], queryFn: () => fetchSets(language) });
  const progress = useSetProgress(language);

  // Sets you've started, closest to complete first (complete ones are done, not "almost").
  const closeSets = (sets.data ?? [])
    .map((s) => ({ set: s, owned: progress.data?.[s.id] ?? 0 }))
    .filter((x) => x.owned > 0 && x.set.printing_count > 0 && x.owned < x.set.printing_count)
    .sort((a, b) => b.owned / b.set.printing_count - a.owned / a.set.printing_count)
    .slice(0, 3);
  const closestDeck = (decks ?? [])
    .filter((d) => d.card_count > 0 && d.owned_count < d.card_count)
    .sort((a, b) => b.owned_count / b.card_count - a.owned_count / a.card_count)[0];

  if (!near.data?.length && closeSets.length === 0 && !closestDeck) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title={t('insights.almostThere')} />
      {near.data && near.data.length > 0 ? (
        <View style={styles.block}>
          <Text variant="subheading">{t('insights.nearPlaysets')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {near.data.map((c) => (
              <Link key={c.card_id} href={{ pathname: '/card/[id]', params: { id: c.card_id } }} asChild>
                <PressableArea accessibilityRole="link" accessibilityLabel={t('insights.nearCard', { name: c.name, code: c.card_id, owned: c.owned })} boxStyle={styles.mini}>
                  <CardImage uri={c.image_url} label={c.card_id} rounded={radius.sm} />
                  <View style={styles.miniMeta}>
                    <CostBadge colors={c.colors} value={c.cost} size="sm" />
                    <Text variant="mono" numberOfLines={1} style={styles.flex}>
                      {c.card_id}
                    </Text>
                  </View>
                  <View style={styles.miniMeta}>
                    <Pips owned={c.owned} need={4} size="sm" />
                    <Text variant="caption" tone="danger" style={tabular}>
                      {t('insights.short', { count: 4 - c.owned })}
                    </Text>
                  </View>
                </PressableArea>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.pair}>
        {closeSets.length > 0 ? (
          <View style={[styles.block, styles.half]}>
            <Text variant="subheading">{t('insights.closeSets')}</Text>
            {closeSets.map(({ set, owned }) => (
              <Link key={set.id} href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
                <PressableArea accessibilityRole="link" boxStyle={[styles.setRow, { borderBottomColor: palette.border }]} activeStyle={{ backgroundColor: palette.primarySoft }}>
                  <View style={styles.setHead}>
                    <Text variant="mono" style={styles.setCode}>
                      {set.code}
                    </Text>
                    <Text weight="semibold" numberOfLines={1} style={styles.flex}>
                      {titleCase(set.name)}
                    </Text>
                    <Text variant="caption" tone="secondary" style={tabular}>
                      {owned}/{set.printing_count}
                    </Text>
                  </View>
                  <ProgressBar value={owned / set.printing_count} height={6} />
                </PressableArea>
              </Link>
            ))}
          </View>
        ) : null}
        {closestDeck ? (
          <View style={[styles.block, styles.half]}>
            <Text variant="subheading">{t('insights.closestDeck')}</Text>
            <Link href={{ pathname: '/deck/[id]', params: { id: closestDeck.id } }} asChild>
              <PressableArea accessibilityRole="link" boxStyle={[styles.setRow, { borderBottomColor: palette.border }]} activeStyle={{ backgroundColor: palette.primarySoft }}>
                <View style={styles.setHead}>
                  <Text weight="semibold" numberOfLines={1} style={styles.flex}>
                    {closestDeck.name}
                  </Text>
                  <Text variant="mono" tone="danger">
                    {t('decks.missing', { count: closestDeck.card_count - closestDeck.owned_count })}
                  </Text>
                </View>
                <ProgressBar value={closestDeck.owned_count / closestDeck.card_count} height={6} />
              </PressableArea>
            </Link>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** "3 min ago", "2 days ago" in the interface language. */
function timeAgo(iso: string, locale: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return rtf.format(0, 'minute');
}

/** What changed in your collection lately (every source: taps, packs, imports), with undo. */
export function RecentActivity() {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const client = useQueryClient();
  const adjust = useAdjustQuantity();
  const [undone, setUndone] = useState<Set<number>>(new Set());
  const activity = useQuery({
    queryKey: [...collectionKeys.all(user?.id ?? 'anon'), 'activity', language],
    queryFn: () => fetchActivity(language, 8),
    enabled: Boolean(user),
  });
  if (!activity.data?.length) return null;

  const undo = (e: ActivityEvent) => {
    adjust.mutate(
      { printingId: e.printing_id, delta: -e.delta },
      { onSettled: () => client.invalidateQueries({ queryKey: [...collectionKeys.all(user!.id), 'activity'] }) },
    );
    setUndone((s) => new Set(s).add(e.id));
  };

  return (
    <View style={styles.section}>
      <SectionTitle
        title={t('insights.activity')}
        action={
          <Link href="/collection" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <Text variant="caption" weight="semibold" style={styles.underline}>
                {t('dashboard.seeAll')}
              </Text>
            </Pressable>
          </Link>
        }
      />
      <View>
        {activity.data.map((e) => (
          <View key={e.id} style={[styles.eventRow, { borderBottomColor: palette.border }]}>
            <View style={styles.thumb}>
              <CardImage uri={e.image_url} label={e.code} rounded={radius.sm} />
            </View>
            <View style={styles.flex}>
              <Text weight="semibold" numberOfLines={1}>
                {e.name}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {printingLabel(e.code, t)} · {timeAgo(e.created_at, i18n.language)}
              </Text>
            </View>
            <Text variant="mono" style={[styles.delta, tabular, { color: e.delta > 0 ? palette.text : palette.textSecondary }]}>
              {e.delta > 0 ? `+${e.delta}` : `−${-e.delta}`}
            </Text>
            {undone.has(e.id) ? (
              <Text variant="caption" tone="muted" style={styles.undoCell}>
                {t('insights.undone')}
              </Text>
            ) : (
              <Pressable onPress={() => undo(e)} accessibilityRole="button" accessibilityLabel={t('insights.undoEvent', { code: e.code })} hitSlop={6} style={styles.undoCell}>
                <Text variant="caption" weight="semibold" style={styles.underline}>
                  {t('collection.undo')}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  block: { gap: spacing.sm },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  half: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
  strip: { gap: spacing.md, paddingBottom: spacing.xs },
  mini: { width: 112, gap: 4 },
  miniMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  setRow: { gap: 6, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  setHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setCode: { width: 64 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 34 },
  delta: { minWidth: 32, textAlign: 'right' },
  undoCell: { minWidth: 56, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  underline: { textDecorationLine: 'underline' },
});
