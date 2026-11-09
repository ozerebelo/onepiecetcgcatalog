import { CATEGORIES, toShoppingList, toSimList, validateDeck } from '@binder/core';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Link, Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { DeckProblems } from '@/components/deck-problems';
import { AppSwitch } from '@/components/ui/app-switch';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Pips } from '@/components/ui/pips';
import { Text } from '@/components/ui/text';
import { checkDeck, deleteDeck, fetchDeck, setDeckBuilt, type CheckRow } from '@/lib/api';
import { confirmAction, notifyError, showToast } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { CARD_COLORS, WIDE_BREAKPOINT, radius, spacing, usePalette } from '@/theme';

type Filter = 'all' | 'missing' | 'owned';

/** A saved deck checked against the collection: what you have, what you're missing. */
export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const client = useQueryClient();
  const { user, initializing } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const palette = usePalette();

  const [englishOnly, setEnglishOnly] = useState(false);
  const [reserveBuilt, setReserveBuilt] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const userId = user?.id ?? 'anon';
  const deck = useQuery({ queryKey: ['decks', userId, 'deck', id], queryFn: () => fetchDeck(id), enabled: Boolean(user) });
  const options = { languages: englishOnly ? (['en'] as const).slice() : null, reserveBuilt };
  const check = useQuery({
    queryKey: ['decks', userId, 'check', id, options],
    queryFn: () => checkDeck(id, options),
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
  });
  const built = useMutation({
    mutationFn: (value: boolean) => setDeckBuilt(id, value),
    onSuccess: () => client.invalidateQueries({ queryKey: ['decks', userId] }),
    onError: notifyError,
  });

  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;
  if (deck.isPending || check.isPending) return <LoadingView />;
  if (deck.isError || check.isError) return <ErrorView error={deck.error ?? check.error} onRetry={() => check.refetch()} />;
  if (!deck.data) return <EmptyView message={t('common.notFound')} />;

  const rows = check.data;
  const known = rows.filter((r) => r.known);
  const unknown = rows.filter((r) => !r.known);
  const total = known.reduce((n, r) => n + r.needed, 0);
  const have = known.reduce((n, r) => n + r.have, 0);
  // Sorted by card number, so copied lists read like a shopping list.
  const missingRows = known.filter((r) => r.missing > 0).sort((a, b) => a.card_id.localeCompare(b.card_id));
  const missingCount = missingRows.reduce((n, r) => n + r.missing, 0);
  const leader = known.find((r) => r.category === 'Leader');
  const problems = validateDeck(known.map((r) => ({ card_id: r.card_id, category: r.category, quantity: r.needed })));
  const visible = known.filter((r) => (filter === 'all' ? true : filter === 'missing' ? r.missing > 0 : r.missing === 0));

  const percent = total ? Math.round((have / total) * 100) : 0;
  const optionsSummary = [
    englishOnly ? t('decks.summary.englishOnly') : t('decks.summary.allLanguages'),
    reserveBuilt ? t('decks.summary.holdingBack') : t('decks.summary.notHoldingBack'),
  ].join(' · ');

  const copy = async (text: string, message: string) => {
    await Clipboard.setStringAsync(text);
    showToast(message);
  };

  const remove = async () => {
    const ok = await confirmAction(t('decks.deleteTitle'), t('decks.deleteBody', { name: deck.data!.name }), t('decks.delete'));
    if (!ok) return;
    try {
      await deleteDeck(id);
      await client.invalidateQueries({ queryKey: ['decks'] });
      router.replace('/decks');
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <Screen scroll edges={[]}>
      <Stack.Screen options={{ title: deck.data.name }} />

      {/* The answer first: can I build this, and what do I pull / buy? */}
      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={wide ? styles.leaderArtWide : styles.leaderArtSmall}>
          <CardImage uri={leader?.image_url} label={leader?.name ?? deck.data.name} rounded={radius.md} priority="high" />
        </View>
        <View style={styles.heroBody}>
          <View style={styles.row}>
            {(leader?.colors ?? []).map((c) => (
              <View key={c} style={[styles.dot, { backgroundColor: CARD_COLORS[c] }]} />
            ))}
            <Text variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
              {leader ? `${leader.name} · ${leader.card_id}` : t('decks.noLeader')}
              {deck.data.is_built ? ` · ${t('decks.built')}` : ''}
            </Text>
          </View>
          <Text variant="title" accessibilityRole="header">
            {deck.data.name}
          </Text>
          <Text variant="heading" accessibilityLiveRegion="polite" style={styles.verdict}>
            {missingCount === 0 ? (
              t('decks.verdictReady', { count: total })
            ) : (
              <>
                {t('decks.verdictPull', { count: have })}
                <Text variant="heading" tone="secondary">
                  {'  ·  '}
                </Text>
                <Text variant="heading" tone="danger">
                  {t('decks.verdictBuy', { count: missingCount })}
                </Text>
              </>
            )}
          </Text>
          <ProgressBar value={total ? have / total : 0} height={8} />
          <Text variant="caption" tone="secondary">
            {t('decks.verdictSub', { percent, total })}
          </Text>
          <DeckProblems problems={problems} />
          {unknown.length > 0 ? (
            <Text variant="caption" tone="danger">
              {t('decks.unknownCards', { count: unknown.length, codes: unknown.map((u) => u.card_id).join(', ') })}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              title={t('decks.copyMissing')}
              icon="clipboard"
              disabled={missingCount === 0}
              onPress={() =>
                copy(
                  toSimList(missingRows.map((r) => ({ card_id: r.card_id, quantity: r.missing }))),
                  t('decks.copiedMissing', { count: missingCount }),
                )
              }
            />
            <Button
              title={t('decks.more')}
              trailingIcon={moreOpen ? 'chevron-up' : 'chevron-down'}
              variant="outline"
              accessibilityState={{ expanded: moreOpen }}
              onPress={() => setMoreOpen((v) => !v)}
            />
          </View>
          {moreOpen ? (
            <View style={[styles.more, { borderTopColor: palette.border }]}>
              <Button
                title={t('decks.copyShopping')}
                icon="shopping-cart"
                size="sm"
                variant="ghost"
                disabled={missingCount === 0}
                onPress={() =>
                  copy(
                    toShoppingList(missingRows.map((r) => ({ card_id: r.card_id, quantity: r.missing, name: r.name }))),
                    t('decks.copiedShopping'),
                  )
                }
              />
              <Button
                title={t('decks.copyDeck')}
                icon="copy"
                size="sm"
                variant="ghost"
                onPress={() =>
                  copy(toSimList(known.map((r) => ({ card_id: r.card_id, quantity: r.needed }))), t('decks.copiedDeck'))
                }
              />
              <Link href={{ pathname: '/deck/[id]/edit', params: { id } }} asChild>
                <Button title={t('decks.edit')} icon="edit-2" size="sm" variant="ghost" />
              </Link>
              <View style={styles.flex} />
              <Button title={t('decks.delete')} icon="trash-2" size="sm" variant="danger" onPress={remove} />
            </View>
          ) : null}
        </View>
      </View>

      {/* How the check counts, folded to one line until needed */}
      <View style={[styles.options, { borderColor: palette.border }]}>
        <PressableArea
          accessibilityRole="button"
          accessibilityState={{ expanded: optionsOpen }}
          accessibilityLabel={`${t('decks.checking')}: ${optionsSummary}`}
          onPress={() => setOptionsOpen((v) => !v)}
          boxStyle={styles.optionsHead}
          activeStyle={{ backgroundColor: palette.primarySoft }}>
          <Text variant="caption" weight="semibold">
            {t('decks.checking')}
          </Text>
          <Text variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
            {optionsSummary}
          </Text>
          <Text variant="caption" weight="semibold">
            {optionsOpen ? t('decks.done') : t('decks.change')}
          </Text>
        </PressableArea>
        {optionsOpen ? (
          <View style={styles.optionsBody}>
            <Toggle
              label={t('decks.englishOnly')}
              hint={t('decks.englishOnlyHint')}
              value={englishOnly}
              onChange={setEnglishOnly}
            />
            <Toggle
              label={t('decks.reserveBuilt')}
              hint={t('decks.reserveBuiltHint')}
              value={reserveBuilt}
              onChange={setReserveBuilt}
            />
            <Toggle
              label={t('decks.isBuilt')}
              hint={t('decks.isBuiltHint')}
              value={built.isPending ? Boolean(built.variables) : deck.data.is_built}
              onChange={(v) => built.mutate(v)}
            />
          </View>
        ) : null}
      </View>

      {/* The pull list */}
      <View style={[styles.listHead, { borderTopColor: palette.rule }]}>
        <Text variant="heading" accessibilityRole="header" style={styles.flex}>
          {t('decks.pullColumn')}
        </Text>
        <Segmented
          accessibilityLabel={t('collection.ownedFilter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('decks.filters.all', { count: known.length }) },
            { value: 'missing', label: t('decks.filters.missing', { count: missingRows.length }) },
            { value: 'owned', label: t('decks.filters.owned', { count: known.length - missingRows.length }) },
          ]}
        />
      </View>
      {visible.length === 0 ? (
        <EmptyView icon="check-circle" message={filter === 'missing' ? t('decks.nothingMissing') : t('collection.nothingHere')} />
      ) : (
        CATEGORIES.map((category) => {
          const group = visible.filter((r) => r.category === category);
          if (group.length === 0) return null;
          return (
            <View key={category} style={styles.group}>
              <View style={[styles.groupHead, { borderBottomColor: palette.rule }]}>
                <Text variant="eyebrow" tone="secondary" style={styles.flex}>
                  {t(`decks.groups.${category}`)} · {group.reduce((n, r) => n + r.needed, 0)}
                </Text>
              </View>
              {group.map((row) => (
                <CheckRowView key={row.card_id} row={row} />
              ))}
            </View>
          );
        })
      )}
    </Screen>
  );
}

/** One pull-list row: the card, its slots (owned marked, missing in red pen) and what to do. */
function CheckRowView({ row }: { row: CheckRow }) {
  const { t } = useTranslation();
  const palette = usePalette();
  // On phones the status may break onto two lines, so the card's own lines keep their room.
  const compact = useWindowDimensions().width < 520;
  const byLanguage = row.owned_printings.reduce<Record<string, number>>((acc, p) => {
    acc[p.language] = (acc[p.language] ?? 0) + p.quantity;
    return acc;
  }, {});
  const ownedText = Object.entries(byLanguage)
    .map(([lang, qty]) => `${t(`languages.short.${lang}`)} ×${qty}`)
    .join(' · ');

  return (
    <Link href={{ pathname: '/card/[id]', params: { id: row.card_id } }} asChild>
      <PressableArea
        accessibilityRole="link"
        accessibilityLabel={`${row.name}, ${row.card_id}, ${row.have}/${row.needed}`}
        boxStyle={[styles.checkRow, { borderBottomColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.primarySoft }}>
        <View style={styles.thumb}>
          <CardImage uri={row.image_url} label={row.card_id} rounded={radius.sm} />
        </View>
        <View style={styles.checkBody}>
          <Text weight="semibold" numberOfLines={1}>
            {row.name}
          </Text>
          <Text variant="mono" tone="muted" numberOfLines={1}>
            {row.card_id}
            {row.cost != null ? ` · ${t(row.category === 'Leader' ? 'card.life' : 'card.cost')} ${row.cost}` : ''}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {row.owned > 0 ? t('decks.youHave', { owned: ownedText }) : t('decks.noneOwned')}
            {row.reserved > 0 ? ` · ${t('decks.reserved', { count: row.reserved })}` : ''}
          </Text>
        </View>
        <Pips owned={row.have} need={row.needed} />
        <Text
          variant="mono"
          numberOfLines={2}
          style={[
            compact ? styles.statusCompact : styles.status,
            { color: row.missing ? palette.danger : palette.textSecondary },
          ]}>
          {row.missing === 0
            ? t('decks.pull', { count: row.needed })
            : row.have > 0
              ? t('decks.pullAndNeed', { pull: row.have, need: row.missing })
              : t('decks.needMore', { count: row.missing })}
        </Text>
      </PressableArea>
    </Link>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text weight="semibold">{label}</Text>
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      </View>
      <AppSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

/** The pull list stays narrow enough that a card's name and its status read as one line. */
const LIST_WIDTH = 880;

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginTop: spacing.lg },
  heroWide: { gap: spacing.xl },
  leaderArtWide: { width: 150 },
  leaderArtSmall: { width: 64 },
  heroBody: { flex: 1, gap: spacing.sm, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  verdict: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  more: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  options: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, maxWidth: LIST_WIDTH },
  optionsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingVertical: spacing.sm },
  optionsBody: { gap: spacing.lg, paddingBottom: spacing.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  listHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 2,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    maxWidth: LIST_WIDTH,
  },
  group: { gap: 0, marginTop: spacing.md, maxWidth: LIST_WIDTH },
  groupHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 40 },
  checkBody: { flex: 1, gap: 1, minWidth: 0 },
  status: { width: 130, textAlign: 'right' },
  statusCompact: { width: 76, textAlign: 'right' },
});
