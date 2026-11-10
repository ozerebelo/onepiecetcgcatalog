import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { LanguageSwitch } from '@/components/language-switch';
import { MetaLeaderRow } from '@/components/meta-leader-row';
import { PageHeader } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { useMeta } from '@/hooks/use-meta';
import { fetchMetaPickups, type MetaPickup } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { formatReleaseDate } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { radius, spacing, tabular, usePalette, WIDE_BREAKPOINT } from '@/theme';

const WIDTH = 880;

/**
 * The meta by leader: leaders ranked by how many top tournament lists they have, each opening its own
 * page (core cards, consensus list, builds, results). Below, the cards that would complete the most lists.
 */
export default function MetaScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const signedIn = Boolean(user);
  const colors = usePalette();
  const meta = useMeta();
  const pickups = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'pickups', language],
    queryFn: () => fetchMetaPickups(language, 12),
    enabled: signedIn,
  });

  const summary = useMemo(() => {
    const lists = meta.lists.data ?? [];
    const events = new Set(lists.map((l) => `${l.event}|${l.event_date}`));
    const dates = lists.map((l) => l.event_date).sort();
    return {
      lists: lists.length,
      events: events.size,
      formats: [...new Set(lists.map((l) => l.format))].join(', '),
      from: formatReleaseDate(dates[0] ?? null, i18n.language, 'short'),
      to: formatReleaseDate(dates.at(-1) ?? null, i18n.language, 'short'),
      sources: [...new Set(lists.map((l) => l.source_name))].join(', '),
    };
  }, [meta.lists.data, i18n.language]);

  const maxShare = meta.leaders[0]?.share ?? 0;
  // Wide screens: the ranking on the left, what to pick up next beside it.
  const wide = useWindowDimensions().width >= WIDE_BREAKPOINT + 180;
  const hasPickups = signedIn && Boolean(pickups.data?.length);

  return (
    <Screen scroll>
      <PageHeader
        title={t('meta.title')}
        subtitle={
          summary.lists
            ? t('meta.subtitleLeaders', { lists: summary.lists, events: summary.events, formats: summary.formats, from: summary.from, to: summary.to })
            : t('meta.subtitleEmpty')
        }
        actions={<LanguageSwitch />}
      />

      {meta.isPending ? (
        <LoadingView />
      ) : meta.isError ? (
        <ErrorView error={meta.error} onRetry={() => meta.refetch()} />
      ) : meta.leaders.length === 0 ? (
        <EmptyView icon="award" title={t('meta.emptyTitle')} message={t('meta.emptyBody')} />
      ) : (
        <View style={[styles.layout, wide && styles.layoutWide]}>
          <View style={styles.main}>
            <View style={styles.head}>
              <Text variant="heading" accessibilityRole="header" style={styles.flex}>
                {t('meta.leaders')}
              </Text>
              {signedIn ? (
                <Text variant="caption" tone="secondary">
                  {t('meta.yourCopies')}
                </Text>
              ) : null}
            </View>
            <Text tone="secondary" style={styles.lede}>
              {signedIn ? t('meta.leadersHint') : t('meta.leadersHintSignedOut')}
            </Text>
            <View style={[styles.rule, { backgroundColor: colors.rule }]} />
            {meta.leaders.map((leader, i) => (
              <MetaLeaderRow
                key={leader.leader}
                rank={i + 1}
                leader={leader}
                info={meta.cards.data?.[leader.leader]}
                maxShare={maxShare}
                signedIn={signedIn}
              />
            ))}
            {wide ? null : hasPickups ? <Pickups pickups={pickups.data!} /> : null}
            <Text variant="caption" tone="secondary" style={styles.sources}>
              {t('meta.sourcesNote', { sources: summary.sources })}
            </Text>
          </View>
          {wide && hasPickups ? (
            <View style={styles.aside}>
              <Pickups pickups={pickups.data!} list />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** The cards you're missing that the most top lists play: a strip on phones, a ruled list beside the ranking. */
function Pickups({ pickups, list = false }: { pickups: MetaPickup[]; list?: boolean }) {
  const { t } = useTranslation();
  const colors = usePalette();
  const label = (p: MetaPickup) =>
    `${p.name}, ${p.card_id}. ${t('meta.pickupLine', { count: p.decks })}${
      p.decks_finished ? `, ${t('meta.finishes', { count: p.decks_finished })}` : ''
    }. ${t('meta.buyCopies', { count: p.copies })}`;
  const detail = (p: MetaPickup) =>
    `${t('meta.pickupLine', { count: p.decks })}${p.decks_finished ? ` · ${t('meta.finishes', { count: p.decks_finished })}` : ''}`;

  return (
    <View style={list ? styles.pickupsList : styles.pickups}>
      <Text variant="heading" accessibilityRole="header">
        {t('meta.pickups')}
      </Text>
      <Text tone="secondary" style={list ? styles.lede : null}>
        {t('meta.pickupsHint')}
      </Text>
      {list ? (
        <>
          <View style={[styles.rule, { backgroundColor: colors.rule }]} />
          {pickups.slice(0, 8).map((p) => (
            <Link key={p.card_id} href={{ pathname: '/card/[id]', params: { id: p.card_id } }} asChild>
              <PressableArea
                accessibilityRole="link"
                accessibilityLabel={label(p)}
                boxStyle={[styles.pickupLine, { borderBottomColor: colors.border }]}
                activeStyle={{ backgroundColor: colors.primarySoft }}>
                <View style={styles.pickupThumb}>
                  <CardImage uri={p.image_url} label={p.card_id} rounded={radius.sm} />
                </View>
                <View style={styles.flex}>
                  <Text weight="semibold" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {detail(p)}
                  </Text>
                </View>
                <Text variant="mono" weight="semibold" style={[{ color: colors.danger }, tabular]}>
                  +{p.copies}
                </Text>
              </PressableArea>
            </Link>
          ))}
        </>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickupRow}>
          {pickups.map((p) => (
            <Link key={p.card_id} href={{ pathname: '/card/[id]', params: { id: p.card_id } }} asChild>
              <PressableArea accessibilityRole="link" accessibilityLabel={label(p)} boxStyle={styles.pickup} activeStyle={{ opacity: 0.85 }}>
                <View>
                  <CardImage uri={p.image_url} label={p.card_id} rounded={radius.sm} />
                  <View style={[styles.copies, { backgroundColor: colors.danger }]}>
                    <Text style={[styles.copiesText, tabular]}>+{p.copies}</Text>
                  </View>
                </View>
                <Text variant="caption" weight="semibold" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {detail(p)}
                </Text>
              </PressableArea>
            </Link>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  main: { flex: 1, minWidth: 0, maxWidth: WIDTH },
  aside: { width: 300 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  lede: { marginTop: spacing.xs, marginBottom: spacing.sm },
  rule: { height: 2 },
  sources: { marginTop: spacing.lg },
  pickups: { gap: spacing.xs, marginTop: spacing.xl },
  pickupsList: { marginTop: spacing.lg },
  pickupLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  pickupThumb: { width: 36 },
  pickupRow: { gap: spacing.md, paddingVertical: spacing.sm },
  pickup: { width: 104, gap: 3 },
  copies: { position: 'absolute', right: 4, bottom: 4, borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  copiesText: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
