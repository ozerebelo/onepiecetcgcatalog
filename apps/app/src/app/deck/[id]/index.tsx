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
import { Badge, KpiStrip, Panel } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { checkDeck, deleteDeck, fetchDeck, setDeckBuilt, type CheckRow } from '@/lib/api';
import { confirmAction, notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { CARD_COLORS, WIDE_BREAKPOINT, radius, spacing, tabular, usePalette } from '@/theme';

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
  const [notice, setNotice] = useState<string | null>(null);

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
  const missingRows = known.filter((r) => r.missing > 0);
  const missingCount = missingRows.reduce((n, r) => n + r.missing, 0);
  const leader = known.find((r) => r.category === 'Leader');
  const problems = validateDeck(known.map((r) => ({ card_id: r.card_id, category: r.category, quantity: r.needed })));
  const visible = known.filter((r) => (filter === 'all' ? true : filter === 'missing' ? r.missing > 0 : r.missing === 0));

  const copy = async (text: string, message: string) => {
    await Clipboard.setStringAsync(text);
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
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

      {/* The object itself: leader, name, actions */}
      <View style={[styles.object, { borderColor: palette.border }]}>
        <View style={styles.leaderArt}>
          <CardImage uri={leader?.image_url} label={leader?.name ?? deck.data.name} rounded={radius.sm} priority="high" />
        </View>
        <View style={styles.titleText}>
          <Text variant="title" accessibilityRole="header" aria-level={1}>
            {deck.data.name}
          </Text>
          <View style={styles.row}>
            {(leader?.colors ?? []).map((c) => (
              <View key={c} style={[styles.dot, { backgroundColor: CARD_COLORS[c] }]} />
            ))}
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flexShrink}>
              {leader ? `${leader.name} · ${leader.card_id}` : t('decks.noLeader')}
            </Text>
            {deck.data.is_built ? <Badge label={t('decks.built')} icon="package" /> : null}
          </View>
        </View>
        <View style={[styles.actions, wide && styles.actionsWide]}>
          <Button
            title={t('decks.copyMissing')}
            icon="clipboard"
            size="sm"
            disabled={missingCount === 0}
            onPress={() =>
              copy(
                toSimList(missingRows.map((r) => ({ card_id: r.card_id, quantity: r.missing }))),
                t('decks.copiedMissing', { count: missingCount }),
              )
            }
          />
          <Button
            title={t('decks.copyShopping')}
            icon="shopping-cart"
            size="sm"
            variant="outline"
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
            variant="outline"
            onPress={() => copy(toSimList(known.map((r) => ({ card_id: r.card_id, quantity: r.needed }))), t('decks.copiedDeck'))}
          />
          <Link href={{ pathname: '/deck/[id]/edit', params: { id } }} asChild>
            <Button title={t('decks.edit')} icon="edit-2" size="sm" variant="outline" />
          </Link>
          <Button title={t('decks.delete')} icon="trash-2" size="sm" variant="ghost" onPress={remove} />
        </View>
      </View>
      {notice ? (
        <Text variant="caption" tone="success" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <KpiStrip
        items={[
          { label: t('decks.cardsOwned'), value: `${have} / ${total}` },
          { label: t('decks.cardsMissing'), value: String(missingCount), hint: missingCount ? t('decks.toBuy') : t('decks.readyToBuild') },
          { label: t('decks.complete'), value: `${total ? Math.round((have / total) * 100) : 0}%` },
        ]}
      />

      {/* Options */}
      <Panel style={styles.options}>
        <Toggle label={t('decks.englishOnly')} hint={t('decks.englishOnlyHint')} value={englishOnly} onChange={setEnglishOnly} />
        <Toggle label={t('decks.reserveBuilt')} hint={t('decks.reserveBuiltHint')} value={reserveBuilt} onChange={setReserveBuilt} />
        <Toggle
          label={t('decks.isBuilt')}
          hint={t('decks.isBuiltHint')}
          value={built.isPending ? Boolean(built.variables) : deck.data.is_built}
          onChange={(v) => built.mutate(v)}
        />
      </Panel>

      <Panel>
        <DeckProblems problems={problems} />
        {unknown.length > 0 ? (
          <Text variant="caption" tone="danger">
            {t('decks.unknownCards', { count: unknown.length, codes: unknown.map((u) => u.card_id).join(', ') })}
          </Text>
        ) : null}
      </Panel>

      {/* Card list */}
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
      {visible.length === 0 ? (
        <EmptyView icon="check-circle" message={filter === 'missing' ? t('decks.nothingMissing') : t('collection.nothingHere')} />
      ) : (
        CATEGORIES.map((category) => {
          const group = visible.filter((r) => r.category === category);
          if (group.length === 0) return null;
          return (
            <View key={category} style={styles.group}>
              <View style={styles.groupTitle}>
                <Text variant="subheading" weight="semibold" role="heading" aria-level={2}>
                  {t(`decks.groups.${category}`)}
                </Text>
                <Text variant="caption" tone="secondary" style={tabular}>
                  {t('decks.cardCount', { count: group.reduce((n, r) => n + r.needed, 0) })}
                </Text>
              </View>
              <View style={[styles.list, { borderColor: palette.border }]}>
                {group.map((row, i) => (
                  <CheckRowView key={row.card_id} row={row} first={i === 0} />
                ))}
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

function CheckRowView({ row, first }: { row: CheckRow; first: boolean }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const complete = row.missing === 0;
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
        boxStyle={[styles.checkRow, !first && { borderTopWidth: 1, borderTopColor: palette.border }]}
        activeStyle={{ backgroundColor: palette.backgroundAlt }}>
        <View style={styles.thumb}>
          <CardImage uri={row.image_url} label={row.card_id} rounded={radius.xs} />
        </View>
        <View style={styles.checkBody}>
          <Text weight="medium" numberOfLines={1}>
            {row.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={tabular}>
            {row.card_id}
            {row.cost != null ? ` · ${t('card.cost')} ${row.cost}` : ''}
            {' · '}
            {row.owned > 0 ? t('decks.youHave', { owned: ownedText }) : t('decks.noneOwned')}
            {row.reserved > 0 ? ` · ${t('decks.reserved', { count: row.reserved })}` : ''}
          </Text>
        </View>
        {complete ? null : <Badge label={t('decks.needMore', { count: row.missing })} tone="danger" />}
        <Text weight="medium" style={[tabular, styles.figure]}>
          {row.have}
          <Text tone="secondary" style={tabular}>{` / ${row.needed}`}</Text>
        </Text>
      </PressableArea>
    </Link>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
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

const styles = StyleSheet.create({
  object: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1 },
  leaderArt: { width: 56 },
  titleText: { flex: 1, gap: spacing.xs, minWidth: 220 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, width: '100%' },
  actionsWide: { width: 'auto', justifyContent: 'flex-end', maxWidth: 560 },
  options: { gap: spacing.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  group: { gap: spacing.sm },
  groupTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  list: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 64 },
  thumb: { width: 36 },
  checkBody: { flex: 1, gap: 2, minWidth: 0 },
  figure: { width: 56, textAlign: 'right' },
});
