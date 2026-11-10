import { cardUsage, groupBuilds, toSimList, type CardUsage, type DeckItem, type MetaBuild } from '@binder/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { LanguageSwitch } from '@/components/language-switch';
import { usePlacementLabel } from '@/components/meta-placement';
import { Button } from '@/components/ui/button';
import { ProgressBar, StatGroup } from '@/components/ui/panel';
import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { ErrorView, LoadingView } from '@/components/ui/state-views';
import { ColorMark, CostBadge } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { ownedOf, useMeta } from '@/hooks/use-meta';
import { saveDeck, type MetaCardInfo } from '@/lib/api';
import { formatReleaseDate } from '@/lib/format';
import { notifyError, showToast } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { radius, spacing, tabular, usePalette } from '@/theme';

const WIDTH = 880;
/** With fewer lists than this, tiers mean little: show the list(s) card by card instead. */
const MIN_LISTS_FOR_TIERS = 3;

/**
 * One leader in the meta: its standing, the core every list plays, the flex and tech slots, the consensus
 * list (with what you own, ready to save), its distinct builds and the results behind it.
 */
export default function MetaLeaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const wide = useWindowDimensions().width >= 720;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const placement = usePlacementLabel();
  const meta = useMeta();

  const index = meta.leaders.findIndex((l) => l.leader === id);
  const leader = index >= 0 ? meta.leaders[index] : undefined;
  const cards = meta.cards.data;
  const info = cards?.[id];
  const usage = useMemo(() => (leader ? cardUsage(leader.lists) : []), [leader]);
  const allBuilds = useMemo(() => (leader && leader.lists.length >= MIN_LISTS_FOR_TIERS ? groupBuilds(leader.leader, leader.lists) : []), [leader]);
  // A build needs at least two lists; one-off lists are counted, not drawn.
  const builds = allBuilds.filter((b) => b.lists.length >= 2);
  const oneOffs = allBuilds.length - builds.length;

  const save = useMutation({
    mutationFn: () => saveDeck(null, t('meta.consensusName', { name: info?.name ?? id }), leader!.consensus, t('meta.consensusNote', { count: leader!.lists.length })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      showToast(t('meta.saved'));
      router.push({ pathname: '/deck/[id]', params: { id: saved.id } });
    },
    onError: (error) => notifyError(error),
  });

  if (meta.isPending) return <LoadingView />;
  if (meta.isError) return <ErrorView error={meta.error} onRetry={() => meta.refetch()} />;
  if (!leader) return <ErrorView error={new Error(t('meta.leaderNotFound'))} />;

  const name = info?.name ?? id;
  const stats = [
    { label: t('meta.statShare'), value: `${Math.round(leader.share * 100)}%`, hint: t('meta.lists', { count: leader.lists.length }) },
    { label: t('meta.statWins'), value: String(leader.wins) },
    { label: t('meta.statBest'), value: leader.best ? (leader.best === 1 ? t('meta.first') : ordinalPlace(leader.best)) : '—' },
  ];
  const tiers = leader.lists.length >= MIN_LISTS_FOR_TIERS;
  const missingItems = leader.consensus
    .map((i) => ({ card_id: i.card_id, quantity: i.quantity - Math.min(i.quantity, cards?.[i.card_id]?.owned ?? 0) }))
    .filter((i) => i.quantity > 0);
  const copy = async (text: string, message: string) => {
    await Clipboard.setStringAsync(text);
    showToast(message);
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: name }} />
      <View style={styles.column}>
        {/* Standing */}
        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={wide ? styles.artWide : styles.artSmall}>
            <CardImage uri={info?.image_url} label={id} rounded={radius.md} priority="high" />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.row}>
              <ColorMark colors={info?.colors} size={12} />
              <Text variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
                {[id, (info?.colors ?? []).map((c) => t(`colors.${c}`)).join(' / ')].filter(Boolean).join(' · ')}
              </Text>
              <LanguageSwitch />
            </View>
            <Text variant="title" accessibilityRole="header">
              {name}
            </Text>
            <Text tone="secondary">{t('meta.rank', { rank: index + 1, count: meta.leaders.length })}</Text>
            {wide ? <StatGroup stats={stats} /> : null}
          </View>
        </View>
        {wide ? null : <StatGroup stats={stats} />}

        {/* The consensus list and what you own of it */}
        <View style={[styles.section, { borderTopColor: palette.rule }]}>
          <Text variant="heading" accessibilityRole="header">
            {tiers ? t('meta.consensusTitle') : t('meta.theList', { count: leader.lists.length })}
          </Text>
          <Text tone="secondary">
            {tiers ? t('meta.consensusHint', { count: leader.lists.length }) : t('meta.fewListsHint')}
          </Text>
          {user ? (
            <>
              <Text variant="heading" accessibilityLiveRegion="polite">
                {leader.missing === 0 ? (
                  t('meta.canBuild')
                ) : (
                  <>
                    {t('decks.verdictOwn', { count: leader.have })}
                    <Text variant="heading" tone="secondary">
                      {'  ·  '}
                    </Text>
                    <Text variant="heading" tone="danger">
                      {t('decks.verdictMissing', { count: leader.missing })}
                    </Text>
                  </>
                )}
              </Text>
              <ProgressBar value={leader.needed ? leader.have / leader.needed : 0} height={8} />
            </>
          ) : (
            <Text tone="secondary">{t('meta.signInToCheck')}</Text>
          )}
          <View style={styles.actions}>
            {user ? (
              <Button title={t('meta.save')} icon="plus" loading={save.isPending} onPress={() => save.mutate()} />
            ) : (
              <Link href="/auth/sign-up" asChild>
                <Button title={t('account.signUp')} />
              </Link>
            )}
            <Button title={t('meta.copyList')} icon="clipboard" variant="outline" onPress={() => copy(toSimList(leader.consensus), t('decks.copiedDeck'))} />
            {user && missingItems.length > 0 ? (
              <Button
                title={t('decks.copyMissing')}
                icon="clipboard"
                variant="outline"
                onPress={() => copy(toSimList(missingItems), t('decks.copiedMissing', { count: leader.missing }))}
              />
            ) : null}
          </View>
        </View>

        {/* What the lists play */}
        {tiers ? (
          (['core', 'flex', 'tech'] as const).map((tier) => {
            const group = usage.filter((u) => u.tier === tier);
            if (group.length === 0) return null;
            return (
              <View key={tier} style={[styles.section, { borderTopColor: palette.rule }]}>
                <Text variant="heading" accessibilityRole="header">
                  {t(`meta.tier.${tier}`)}
                </Text>
                <Text tone="secondary">{t(`meta.tierHint.${tier}`, { count: leader.lists.length })}</Text>
                {tier === 'core' ? (
                  <View style={styles.grid}>
                    {group.map((u) => (
                      <CoreCard key={u.card_id} usage={u} info={cards?.[u.card_id]} total={leader.lists.length} showOwned={Boolean(user)} />
                    ))}
                  </View>
                ) : (
                  group.map((u) => <UsageRow key={u.card_id} usage={u} info={cards?.[u.card_id]} total={leader.lists.length} showOwned={Boolean(user)} />)
                )}
              </View>
            );
          })
        ) : (
          <View style={[styles.section, { borderTopColor: palette.rule }]}>
            <View style={styles.grid}>
              {leader.consensus
                .filter((i) => i.card_id !== id)
                .map((i) => (
                  <CoreCard
                    key={i.card_id}
                    usage={{ card_id: i.card_id, lists: 1, rate: 1, average: i.quantity, usual: i.quantity, tier: 'core' }}
                    info={cards?.[i.card_id]}
                    total={1}
                    showOwned={Boolean(user)}
                    hideRate
                  />
                ))}
            </View>
          </View>
        )}

        {/* Builds */}
        {allBuilds.length > 1 ? (
          <View style={[styles.section, { borderTopColor: palette.rule }]}>
            <Text variant="heading" accessibilityRole="header">
              {t('meta.builds')}
            </Text>
            <Text tone="secondary">{t('meta.buildsHint', { count: builds.length })}</Text>
            {builds.map((build, i) => (
              <BuildView key={build.lists[0]!.id} build={build} index={i} cards={cards} />
            ))}
            {oneOffs > 0 ? (
              <Text variant="caption" tone="secondary">
                {t('meta.oneOffs', { count: oneOffs })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Results */}
        <View style={[styles.section, { borderTopColor: palette.rule }]}>
          <Text variant="heading" accessibilityRole="header">
            {t('meta.results')}
          </Text>
          {leader.lists.map((list) => (
            <Link key={list.id} href={{ pathname: '/meta/[id]', params: { id: list.id } }} asChild>
              <PressableArea
                accessibilityRole="link"
                accessibilityLabel={[placement(list.placement, list.players), list.event].filter(Boolean).join(', ')}
                boxStyle={[styles.result, { borderBottomColor: palette.border }]}
                activeStyle={{ backgroundColor: palette.primarySoft }}>
                <Text variant="mono" weight="semibold" style={styles.place}>
                  {placement(list.placement, null) ?? '—'}
                </Text>
                <Text numberOfLines={1} style={styles.flex}>
                  {list.event}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatReleaseDate(list.event_date, i18n.language, 'short')}
                </Text>
              </PressableArea>
            </Link>
          ))}
        </View>
      </View>
    </Screen>
  );
}

function ordinalPlace(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** A core card: art with its usual copies, how many lists play it and what you own. */
function CoreCard({
  usage,
  info,
  total,
  showOwned,
  hideRate,
}: {
  usage: CardUsage;
  info: MetaCardInfo | undefined;
  total: number;
  showOwned: boolean;
  hideRate?: boolean;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const owned = Math.min(info?.owned ?? 0, usage.usual);
  return (
    <Link href={{ pathname: '/card/[id]', params: { id: usage.card_id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={[
          `${info?.name ?? usage.card_id}, ${usage.card_id}, ×${usage.usual}`,
          hideRate ? null : t('meta.inLists', { count: usage.lists, total }),
          showOwned ? `${owned}/${usage.usual}` : null,
        ]
          .filter(Boolean)
          .join(', ')}
        boxStyle={styles.coreItem}
        activeStyle={{ opacity: 0.85 }}>
        <View>
          <CardImage uri={info?.image_url} label={usage.card_id} rounded={radius.sm} />
          <View style={[styles.countBadge, { backgroundColor: palette.overlay }]}>
            <Text style={[styles.countText, tabular]}>×{usage.usual}</Text>
          </View>
        </View>
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {info?.name ?? usage.card_id}
        </Text>
        {hideRate ? null : (
          <Text variant="caption" tone="secondary" style={tabular}>
            {t('meta.inLists', { count: usage.lists, total })}
          </Text>
        )}
        {showOwned ? <Pips owned={owned} need={usage.usual} size="sm" /> : null}
      </PressableArea>
    </Link>
  );
}

/** A flex or tech card: how often it's played and how many copies. */
function UsageRow({ usage, info, total, showOwned }: { usage: CardUsage; info: MetaCardInfo | undefined; total: number; showOwned: boolean }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const owned = Math.min(info?.owned ?? 0, usage.usual);
  return (
    <Link href={{ pathname: '/card/[id]', params: { id: usage.card_id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${info?.name ?? usage.card_id}, ${t('meta.inLists', { count: usage.lists, total })}, ${t('meta.usually', { count: usage.usual })}`}
        boxStyle={[styles.usageRow, { borderBottomColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.primarySoft }}>
        <View style={styles.thumb}>
          <CardImage uri={info?.image_url} label={usage.card_id} rounded={radius.sm} />
        </View>
        <CostBadge colors={info?.colors} value={info?.cost ?? null} size="sm" />
        <View style={styles.usageBody}>
          <Text weight="semibold" numberOfLines={1}>
            {info?.name ?? usage.card_id}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {t('meta.inLists', { count: usage.lists, total })} · {t('meta.usually', { count: usage.usual })}
          </Text>
        </View>
        <View style={styles.rate}>
          <ProgressBar value={usage.rate} height={4} />
          <Text variant="caption" style={[styles.rateText, tabular]}>
            {Math.round(usage.rate * 100)}%
          </Text>
        </View>
        {showOwned ? <Pips owned={owned} need={usage.usual} size="sm" /> : null}
      </PressableArea>
    </Link>
  );
}

/** A group of similar lists: its size, best finish and what it changes from the consensus. */
function BuildView({ build, index, cards }: { build: MetaBuild; index: number; cards: Record<string, MetaCardInfo> | undefined }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const placement = usePlacementLabel();
  const best = build.lists[0]!;
  const change = (items: DeckItem[], sign: string) =>
    items.map((i) => `${sign}${i.quantity} ${cards?.[i.card_id]?.name ?? i.card_id}`).join(', ');
  return (
    <View style={[styles.build, { borderColor: palette.border }]}>
      <View style={styles.row}>
        <Text weight="semibold" style={styles.flex}>
          {index === 0 ? t('meta.buildMain') : t('meta.buildN', { n: index + 1 })}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('meta.lists', { count: build.lists.length })}
        </Text>
      </View>
      <Text variant="caption" tone="secondary">
        {t('meta.buildBest', { place: placement(best.placement, null) ?? '—', event: best.event })}
      </Text>
      {build.diff.add.length || build.diff.cut.length ? (
        <>
          {build.diff.add.length ? <Text variant="caption">{t('meta.buildAdds', { cards: change(build.diff.add, '+') })}</Text> : null}
          {build.diff.cut.length ? (
            <Text variant="caption" tone="secondary">
              {t('meta.buildCuts', { cards: change(build.diff.cut, '−') })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="caption">{t('meta.buildIsConsensus')}</Text>
      )}
      <Link href={{ pathname: '/meta/[id]', params: { id: best.id } }} asChild>
        <Button title={t('meta.buildOpen')} variant="ghost" size="sm" trailingIcon="arrow-right" boxStyle={styles.buildOpen} />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { maxWidth: WIDTH },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.lg },
  heroWide: { gap: spacing.xl },
  artWide: { width: 150 },
  artSmall: { width: 72 },
  heroBody: { flex: 1, gap: spacing.sm, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  section: { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 2, gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  coreItem: { width: '30%', maxWidth: 132, gap: 3 },
  countBadge: { position: 'absolute', right: 4, bottom: 4, borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  countText: { color: '#fff', fontSize: 12, lineHeight: 16 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 36 },
  usageBody: { flex: 1, gap: 1, minWidth: 0 },
  rate: { width: 72, gap: 2 },
  rateText: { textAlign: 'right' },
  build: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  buildOpen: { alignSelf: 'flex-start' },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  place: { width: 72 },
});
