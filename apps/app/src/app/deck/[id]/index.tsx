import { CATEGORIES, toShoppingList, toSimList, validateDeck, type Category } from '@binder/core';
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
import { Badge, Panel, ProgressBar } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { checkDeck, deleteDeck, fetchDeck, setDeckBuilt, type CheckRow } from '@/lib/api';
import { confirmAction, notifyError } from '@/lib/notify';
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

      {/* Summary */}
      <Panel style={[styles.hero, wide && styles.heroWide]}>
        {wide ? (
          <View style={styles.leaderArtWide}>
            <CardImage uri={leader?.image_url} label={leader?.name ?? deck.data.name} rounded={radius.lg} priority="high" />
          </View>
        ) : null}
        <View style={styles.heroBody}>
          <View style={styles.titleRow}>
            {!wide ? (
              <View style={styles.leaderArtSmall}>
                <CardImage uri={leader?.image_url} label={leader?.card_id ?? ''} rounded={radius.sm} priority="high" />
              </View>
            ) : null}
            <View style={styles.titleText}>
              <View style={styles.row}>
                {(leader?.colors ?? []).map((c) => (
                  <View key={c} style={[styles.dot, { backgroundColor: CARD_COLORS[c] }]} />
                ))}
                <Text variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
                  {leader ? `${leader.name} · ${leader.card_id}` : t('decks.noLeader')}
                </Text>
              </View>
              <Text variant="title">{deck.data.name}</Text>
              {deck.data.is_built ? <Badge label={t('decks.built')} tone="accent" icon="package" /> : null}
            </View>
          </View>
          <View style={styles.statsRow}>
            <BigStat value={`${have}/${total}`} label={t('decks.cardsOwned')} />
            <BigStat value={String(missingCount)} label={t('decks.cardsMissing')} tone={missingCount ? 'danger' : 'success'} />
            <BigStat value={`${total ? Math.round((have / total) * 100) : 0}%`} label={t('decks.complete')} />
          </View>
          <ProgressBar value={total ? have / total : 0} tone={missingCount === 0 ? 'success' : 'primary'} height={10} />
          <View style={styles.actions}>
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
              onPress={() =>
                copy(toSimList(known.map((r) => ({ card_id: r.card_id, quantity: r.needed }))), t('decks.copiedDeck'))
              }
            />
            <Link href={{ pathname: '/deck/[id]/edit', params: { id } }} asChild>
              <Button title={t('decks.edit')} icon="edit-2" size="sm" variant="outline" />
            </Link>
            <Button title={t('decks.delete')} icon="trash-2" size="sm" variant="danger" onPress={remove} />
          </View>
          {notice ? (
            <Text variant="caption" tone="success" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
        </View>
      </Panel>

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
              <Text variant="label" tone="muted">
                {t(`decks.groups.${category}`)} · {group.reduce((n, r) => n + r.needed, 0)}
              </Text>
              <View style={[styles.grid, wide && styles.gridWide]}>
                {group.map((row) => (
                  <CheckRowView key={row.card_id} row={row} wide={wide} category={category} />
                ))}
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

function CheckRowView({ row, wide, category: _category }: { row: CheckRow; wide: boolean; category: Category }) {
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
        boxStyle={[
          styles.checkRow,
          { backgroundColor: palette.surface, borderColor: complete ? palette.border : palette.dangerSoft },
          wide && { flexBasis: '48%' },
        ]}
        activeStyle={{ borderColor: palette.borderStrong }}>
        <View style={styles.thumb}>
          <CardImage uri={row.image_url} label={row.card_id} rounded={radius.sm} />
          <View style={[styles.qty, { backgroundColor: palette.overlay }]}>
            <Text variant="label" style={styles.qtyText}>
              ×{row.needed}
            </Text>
          </View>
        </View>
        <View style={styles.checkBody}>
          <Text weight="semibold" numberOfLines={1}>
            {row.name}
          </Text>
          <Text variant="mono" tone="muted">
            {row.card_id}
            {row.cost != null ? ` · ${t('card.cost')} ${row.cost}` : ''}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {row.owned > 0 ? t('decks.youHave', { owned: ownedText }) : t('decks.noneOwned')}
            {row.reserved > 0 ? ` · ${t('decks.reserved', { count: row.reserved })}` : ''}
          </Text>
        </View>
        {complete ? (
          <Badge label={`${row.have}/${row.needed}`} tone="success" icon="check" />
        ) : (
          <View style={styles.status}>
            <Badge label={t('decks.needMore', { count: row.missing })} tone="danger" />
            <Text variant="caption" tone="muted">
              {row.have}/{row.needed}
            </Text>
          </View>
        )}
      </PressableArea>
    </Link>
  );
}

function BigStat({ value, label, tone = 'default' }: { value: string; label: string; tone?: 'default' | 'danger' | 'success' }) {
  return (
    <View style={styles.bigStat}>
      <Text variant="heading" tone={tone}>
        {value}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
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
  hero: { gap: spacing.lg, marginTop: spacing.lg },
  heroWide: { flexDirection: 'row', alignItems: 'flex-start' },
  leaderArtWide: { width: 170 },
  leaderArtSmall: { width: 76 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  heroBody: { flex: 1, gap: spacing.md, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  bigStat: { gap: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  options: { gap: spacing.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  group: { gap: spacing.sm },
  grid: { gap: spacing.sm },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
  },
  thumb: { width: 54 },
  qty: { position: 'absolute', bottom: 3, right: 3, paddingHorizontal: 5, borderRadius: radius.pill },
  qtyText: { color: '#fff', textTransform: 'none', letterSpacing: 0 },
  checkBody: { flex: 1, gap: 1, minWidth: 0 },
  status: { alignItems: 'flex-end', gap: 2 },
});
