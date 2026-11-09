import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

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
import { radius, spacing, tabular, usePalette } from '@/theme';

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

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: t('meta.title') }} />
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
        <View style={styles.column}>
          <View style={styles.head}>
            <Text variant="heading" accessibilityRole="header" style={styles.flex}>
              {t('meta.leaders')}
            </Text>
            {signedIn ? (
              <Text variant="eyebrow" tone="secondary">
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

          {signedIn && pickups.data && pickups.data.length > 0 ? <Pickups pickups={pickups.data} /> : null}

          <Text variant="caption" tone="secondary" style={styles.sources}>
            {t('meta.sourcesNote', { sources: summary.sources })}
          </Text>
        </View>
      )}
    </Screen>
  );
}

/** The cards you're missing that the most top lists play. */
function Pickups({ pickups }: { pickups: MetaPickup[] }) {
  const { t } = useTranslation();
  const colors = usePalette();
  return (
    <View style={styles.pickups}>
      <Text variant="heading" accessibilityRole="header">
        {t('meta.pickups')}
      </Text>
      <Text tone="secondary">{t('meta.pickupsHint')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickupRow}>
        {pickups.map((p) => (
          <Link key={p.card_id} href={{ pathname: '/card/[id]', params: { id: p.card_id } }} asChild>
            <PressableArea
              accessibilityRole="link"
              accessibilityLabel={`${p.name}, ${p.card_id}. ${t('meta.pickupLine', { count: p.decks })}${
                p.decks_finished ? `, ${t('meta.finishes', { count: p.decks_finished })}` : ''
              }. ${t('meta.buyCopies', { count: p.copies })}`}
              boxStyle={styles.pickup}
              activeStyle={{ opacity: 0.85 }}>
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
                {t('meta.pickupLine', { count: p.decks })}
                {p.decks_finished ? ` · ${t('meta.finishes', { count: p.decks_finished })}` : ''}
              </Text>
            </PressableArea>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { maxWidth: WIDTH },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  lede: { marginTop: spacing.xs, marginBottom: spacing.sm },
  rule: { height: 2 },
  sources: { marginTop: spacing.lg },
  pickups: { gap: spacing.xs, marginTop: spacing.xl },
  pickupRow: { gap: spacing.md, paddingVertical: spacing.sm },
  pickup: { width: 104, gap: 3 },
  copies: { position: 'absolute', right: 4, bottom: 4, borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  copiesText: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
