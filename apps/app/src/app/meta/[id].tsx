import { CATEGORIES, toSimList } from '@binder/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { LanguageSwitch } from '@/components/language-switch';
import { usePlacementLabel } from '@/components/meta-placement';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/panel';
import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { ErrorView, LoadingView } from '@/components/ui/state-views';
import { ColorMark, CostBadge } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { fetchMetaDeckCheck, fetchMetaProgress, saveDeck, type MetaCheckRow } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { formatReleaseDate } from '@/lib/format';
import { notifyError, showToast } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { radius, spacing, usePalette } from '@/theme';

const LIST_WIDTH = 880;

/** One meta deck: where it placed, who published it, and how much of it you own, card by card. */
export default function MetaDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const wide = useWindowDimensions().width >= 720;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [language] = useCardLanguage();
  const placement = usePlacementLabel();

  // The deck's details come from the same list the Meta page shows (usually already cached).
  const decks = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'progress', language],
    queryFn: () => fetchMetaProgress(language),
  });
  const rows = useQuery({
    queryKey: ['meta', user?.id ?? 'anon', 'check', id, language],
    queryFn: () => fetchMetaDeckCheck(id, language),
  });
  const deck = decks.data?.find((d) => d.id === id);

  const save = useMutation({
    mutationFn: () =>
      saveDeck(
        null,
        deck!.archetype,
        (rows.data ?? []).map((r) => ({ card_id: r.card_id, quantity: r.needed })),
        t('meta.savedNote', { event: deck!.event, source: deck!.source_url }),
      ),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      showToast(t('meta.saved'));
      router.push({ pathname: '/deck/[id]', params: { id: saved.id } });
    },
    onError: (error) => notifyError(error),
  });

  if (decks.isPending || rows.isPending) return <LoadingView />;
  if (decks.isError || rows.isError) {
    return <ErrorView error={decks.error ?? rows.error} onRetry={() => (decks.refetch(), rows.refetch())} />;
  }
  if (!deck) return <ErrorView error={new Error(t('meta.notFound'))} />;

  const list = rows.data;
  const total = list.reduce((n, r) => n + r.needed, 0);
  const have = list.reduce((n, r) => n + r.have, 0);
  const missing = list.filter((r) => r.missing > 0);
  const result = placement(deck.placement, deck.players);
  const date = formatReleaseDate(deck.event_date, i18n.language, 'long');

  const copy = async (text: string, message: string) => {
    await Clipboard.setStringAsync(text);
    showToast(message);
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: deck.archetype }} />
      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={wide ? styles.leaderArtWide : styles.leaderArtSmall}>
          <CardImage uri={deck.leader_image} label={deck.leader_card_id} rounded={radius.md} priority="high" />
        </View>
        <View style={styles.heroBody}>
          <View style={styles.row}>
            <ColorMark colors={deck.leader_colors} size={12} />
            <Text variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
              {[deck.leader_name, deck.leader_card_id, deck.leader_colors.map((c) => t(`colors.${c}`)).join(' / ')].join(' · ')}
            </Text>
            <LanguageSwitch />
          </View>
          <Text variant="title" accessibilityRole="header">
            {deck.archetype}
          </Text>
          <Text weight="semibold">{[result, deck.event].filter(Boolean).join(' · ')}</Text>
          <Text variant="caption" tone="secondary">
            {[date, deck.format, deck.player, deck.region].filter(Boolean).join(' · ')}
          </Text>

          {user ? (
            <>
              <Text variant="heading" accessibilityLiveRegion="polite" style={styles.verdict}>
                {missing.length === 0 ? (
                  t('meta.canBuild')
                ) : (
                  <>
                    {t('decks.verdictOwn', { count: have })}
                    <Text variant="heading" tone="secondary">
                      {'  ·  '}
                    </Text>
                    <Text variant="heading" tone="danger">
                      {t('decks.verdictMissing', { count: total - have })}
                    </Text>
                  </>
                )}
              </Text>
              <ProgressBar value={total ? have / total : 0} height={8} />
            </>
          ) : (
            <Text tone="secondary" style={styles.verdict}>
              {t('meta.signInToCheck')}
            </Text>
          )}

          <View style={styles.actions}>
            {user ? (
              <Button title={t('meta.save')} icon="plus" loading={save.isPending} onPress={() => save.mutate()} />
            ) : (
              <Link href="/auth/sign-up" asChild>
                <Button title={t('account.signUp')} />
              </Link>
            )}
            <Button
              title={t('meta.copyList')}
              icon="clipboard"
              variant="outline"
              onPress={() => copy(toSimList(list.map((r) => ({ card_id: r.card_id, quantity: r.needed }))), t('decks.copiedDeck'))}
            />
            {user && missing.length > 0 ? (
              <Button
                title={t('decks.copyMissing')}
                icon="clipboard"
                variant="outline"
                onPress={() =>
                  copy(
                    toSimList(missing.map((r) => ({ card_id: r.card_id, quantity: r.missing }))),
                    t('decks.copiedMissing', { count: total - have }),
                  )
                }
              />
            ) : null}
          </View>
          <PressableArea
            accessibilityRole="link"
            accessibilityLabel={t('meta.sourceLink', { source: deck.source_name })}
            onPress={() => Linking.openURL(deck.source_url)}
            boxStyle={styles.source}
            activeStyle={{ opacity: 0.7 }}>
            <Text variant="caption" tone="secondary">
              {t('meta.source')}{' '}
              <Text variant="caption" weight="semibold" style={{ color: palette.text, textDecorationLine: 'underline' }}>
                {deck.source_name} ↗
              </Text>
            </Text>
          </PressableArea>
        </View>
      </View>

      {CATEGORIES.map((category) => {
        const group = list.filter((r) => r.category === category);
        if (group.length === 0) return null;
        return (
          <View key={category} style={styles.group}>
            <View style={[styles.groupHead, { borderBottomColor: palette.rule }]}>
              <Text variant="eyebrow" tone="secondary">
                {t(`decks.groups.${category}`)} · {group.reduce((n, r) => n + r.needed, 0)}
              </Text>
            </View>
            {group.map((row) => (
              <MetaRow key={row.card_id} row={row} showOwned={Boolean(user)} />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

function MetaRow({ row, showOwned }: { row: MetaCheckRow; showOwned: boolean }) {
  const { t } = useTranslation();
  const palette = usePalette();
  return (
    <Link href={{ pathname: '/card/[id]', params: { id: row.card_id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${row.name}, ${row.card_id}, ×${row.needed}${showOwned ? `, ${row.have}/${row.needed}` : ''}`}
        boxStyle={[styles.checkRow, { borderBottomColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.primarySoft }}>
        <View style={styles.thumb}>
          <CardImage uri={row.image_url} label={row.card_id} rounded={radius.sm} />
        </View>
        <CostBadge colors={row.colors} value={row.cost} life={row.category === 'Leader'} size="sm" />
        <View style={styles.checkBody}>
          <Text weight="semibold" numberOfLines={1}>
            {row.name}
          </Text>
          <Text variant="mono" tone="muted" numberOfLines={1}>
            {row.card_id} · ×{row.needed}
          </Text>
        </View>
        {showOwned ? (
          <>
            <Pips owned={row.have} need={row.needed} />
            <Text variant="mono" style={[styles.status, { color: row.missing ? palette.danger : palette.textSecondary }]}>
              {row.missing === 0 ? t('decks.own', { count: row.needed }) : t('decks.missing', { count: row.missing })}
            </Text>
          </>
        ) : null}
      </PressableArea>
    </Link>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginTop: spacing.lg, maxWidth: LIST_WIDTH },
  heroWide: { gap: spacing.xl },
  leaderArtWide: { width: 150 },
  leaderArtSmall: { width: 64 },
  heroBody: { flex: 1, gap: spacing.sm, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  verdict: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  source: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  group: { marginTop: spacing.md, maxWidth: LIST_WIDTH },
  groupHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 40 },
  checkBody: { flex: 1, gap: 1, minWidth: 0 },
  status: { width: 96, textAlign: 'right' },
});
