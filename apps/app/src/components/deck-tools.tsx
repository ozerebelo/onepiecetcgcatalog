import { BANLIST, deckLegality, STANDARD, type Color } from '@binder/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ColorMark, useCardColor } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import type { CheckRow, DeckCardDetail } from '@/lib/api';
import { formatReleaseDate } from '@/lib/format';
import { CARD_ASPECT_RATIO, radius, spacing, tabular, usePalette } from '@/theme';

type Details = Record<string, DeckCardDetail> | undefined;

const POWER_STEPS = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000] as const;

/** The numbers players check before a game: colours, blockers, triggers, counters, power. */
export function DeckProfile({ rows, details }: { rows: CheckRow[]; details: Details }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const cardColor = useCardColor();
  const main = rows.filter((r) => r.category !== 'Leader');
  const copies = main.reduce((n, r) => n + r.needed, 0);
  const sum = (pick: (r: CheckRow, d: DeckCardDetail) => number) =>
    main.reduce((n, r) => n + (details?.[r.card_id] ? pick(r, details[r.card_id]) * r.needed : 0), 0);

  const blockers = sum((_, d) => (d.blocker ? 1 : 0));
  const triggers = sum((_, d) => (d.trigger ? 1 : 0));
  const counterTotal = sum((_, d) => d.counter ?? 0);
  const events = main.filter((r) => r.category === 'Event').reduce((n, r) => n + r.needed, 0);

  // Colour split by copies; multicolour cards count once in each of their colours.
  const colours = useMemo(() => {
    const tally = new Map<Color, number>();
    for (const r of main) for (const c of r.colors ?? []) tally.set(c, (tally.get(c) ?? 0) + r.needed);
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  }, [main]);
  const colourTotal = colours.reduce((n, [, v]) => n + v, 0);

  const powers = POWER_STEPS.map((step, i) => {
    const last = i === POWER_STEPS.length - 1;
    const count = main
      .filter((r) => r.category === 'Character')
      .filter((r) => {
        const p = details?.[r.card_id]?.power;
        return p != null && (last ? p >= step : p >= step && p < step + 1000);
      })
      .reduce((n, r) => n + r.needed, 0);
    return { step, last, count };
  });
  const peak = Math.max(1, ...powers.map((p) => p.count));

  if (copies === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text variant="subheading">{t('deckTools.profile')}</Text>
      <View style={styles.tiles}>
        <Tile label={t('deckTools.blockers')} value={blockers} />
        <Tile label={t('deckTools.triggers')} value={triggers} />
        <Tile label={t('deckTools.counter')} value={`+${counterTotal.toLocaleString()}`} hint={t('deckTools.counterAvg', { avg: Math.round(counterTotal / Math.max(1, copies)) })} />
        <Tile label={t('deckTools.events')} value={events} />
      </View>

      {colours.length > 0 ? (
        <View style={styles.block}>
          <View style={[styles.split, { backgroundColor: palette.surfaceAlt }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {colours.map(([c, v]) => (
              <View key={c} style={{ flex: v, backgroundColor: cardColor(c) }} />
            ))}
          </View>
          <View style={styles.legend}>
            {colours.map(([c, v]) => (
              <View key={c} style={styles.legendItem} accessible accessibilityLabel={`${t(`colors.${c}`)}: ${v}`}>
                <ColorMark colors={[c]} size={10} />
                <Text variant="caption" tone="secondary" style={tabular}>
                  {t(`colors.${c}`)} {Math.round((v / colourTotal) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text variant="caption" weight="semibold">
          {t('deckTools.power')}
        </Text>
        <View style={[styles.powerPlot, { borderBottomColor: palette.rule }]}>
          {powers.map((p) => (
            <View key={p.step} style={styles.powerCol} accessible accessibilityLabel={t('deckTools.powerBar', { power: p.last ? `${p.step}+` : p.step, count: p.count })}>
              <Text style={[styles.powerCount, tabular, { color: p.count ? palette.text : palette.textMuted }]}>{p.count || ''}</Text>
              <View style={[styles.powerBar, { height: (p.count / peak) * 48, backgroundColor: palette.text }]} />
            </View>
          ))}
        </View>
        <View style={styles.powerAxis}>
          {powers.map((p) => (
            <Text key={p.step} style={[styles.powerTick, tabular, { color: palette.textSecondary }]}>
              {p.step / 1000}k{p.last ? '+' : ''}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.tile, { borderColor: palette.border }]} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="heading" style={tabular}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Standard / Extra legality: banned cards and pairs (every format), cards rotated out of Standard. */
export function DeckLegalityNotes({ rows, details }: { rows: CheckRow[]; details: Details }) {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const [showRotated, setShowRotated] = useState(false);
  if (!details) return null;
  const name = (id: string) => rows.find((r) => r.card_id === id)?.name ?? id;
  const result = deckLegality(rows.map((r) => ({ card_id: r.card_id, block: details[r.card_id]?.block })));
  const until = formatReleaseDate(STANDARD.until, i18n.language, 'long');
  const clean = result.banned.length === 0 && result.pairs.length === 0 && result.rotated.length === 0;

  return (
    <View style={styles.notes}>
      {clean ? (
        <Line icon="check-circle" color={palette.text} text={t('deckTools.standardLegal', { blocks: STANDARD.blocks.join(', '), until })} />
      ) : null}
      {result.banned.map((id) => (
        <Line key={id} icon="slash" color={palette.danger} danger text={t('deckTools.banned', { card: `${name(id)} ${id}`, date: formatReleaseDate(BANLIST.asOf, i18n.language, 'long') })} />
      ))}
      {result.pairs.map(([a, b]) => (
        <Line key={`${a}-${b}`} icon="slash" color={palette.danger} danger text={t('deckTools.bannedPair', { a: `${name(a)} ${a}`, b: `${name(b)} ${b}` })} />
      ))}
      {result.rotated.length > 0 ? (
        <View>
          <Pressable onPress={() => setShowRotated((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showRotated }}>
            <Line icon="alert-triangle" color={palette.text} text={t('deckTools.rotated', { count: result.rotated.length, blocks: STANDARD.blocks.join(', ') })} />
          </Pressable>
          {showRotated ? (
            <Text variant="caption" tone="secondary" style={styles.rotatedList}>
              {result.rotated.map((id) => `${name(id)} ${id}`).join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Line({ icon, color, text, danger = false }: { icon: 'check-circle' | 'slash' | 'alert-triangle'; color: string; text: string; danger?: boolean }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size={16} color={color} />
      <Text variant="caption" tone={danger ? 'danger' : 'secondary'} style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Opening-hand tester: shuffle the 50, draw 5, take one mulligan if you like, then the leader's life
 * goes face down from the top. Draw on to see your next turns.
 */
export function OpeningHand({ rows, life }: { rows: CheckRow[]; life: number }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const deck = useMemo(() => rows.filter((r) => r.category !== 'Leader').flatMap((r) => Array.from({ length: r.needed }, () => r)), [rows]);
  const [order, setOrder] = useState<CheckRow[] | null>(null);
  const [drawn, setDrawn] = useState(5);
  const [mulliganed, setMulliganed] = useState(false);

  if (deck.length < 5) return null;
  const start = () => {
    setOrder(shuffle(deck));
    setDrawn(5);
    setMulliganed(false);
  };
  const mulligan = () => {
    setOrder(shuffle(deck));
    setMulliganed(true);
  };
  // Hand = top 5 (+ draws); life = the next `life` cards, face down; draws come after the life cards.
  const hand = order ? [...order.slice(0, 5), ...order.slice(5 + life, 5 + life + (drawn - 5))] : [];
  const left = order ? order.length - 5 - life - (drawn - 5) : deck.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.handHead}>
        <Text variant="subheading" style={styles.flex}>
          {t('deckTools.hand')}
        </Text>
        <Button title={order ? t('deckTools.newHand') : t('deckTools.drawHand')} icon="shuffle" size="sm" variant={order ? 'outline' : 'primary'} onPress={start} />
      </View>
      {order ? (
        <>
          {/* Five across on every screen, the way the hand sits in front of you; extra draws wrap. */}
          <View style={styles.hand}>
            {hand.map((card, i) => (
              <View key={`${card.card_id}-${i}`} style={styles.handCard} accessible accessibilityLabel={`${card.name ?? card.card_id} ${card.card_id}`}>
                <CardImage uri={card.image_url} label={card.card_id} rounded={radius.sm} />
                <Text variant="mono" tone="secondary" numberOfLines={1}>
                  {card.card_id}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.handFoot}>
            <View style={styles.lifeRow} accessible accessibilityLabel={t('deckTools.life', { count: life })}>
              {Array.from({ length: life }, (_, i) => (
                <View key={i} style={[styles.cardBack, { backgroundColor: palette.text, borderColor: palette.border }]} />
              ))}
              <Text variant="caption" tone="secondary">
                {t('deckTools.life', { count: life })} · {t('deckTools.left', { count: Math.max(0, left) })}
              </Text>
            </View>
            <View style={styles.handActions}>
              {!mulliganed && drawn === 5 ? <Button title={t('deckTools.mulligan')} size="sm" variant="ghost" onPress={mulligan} /> : null}
              <Button title={t('deckTools.draw')} icon="plus" size="sm" variant="outline" disabled={left <= 0} onPress={() => setDrawn((d) => d + 1)} />
            </View>
          </View>
        </>
      ) : (
        <Text variant="caption" tone="secondary">
          {t('deckTools.handHint', { life })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  block: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: 120, gap: 2, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  split: { flexDirection: 'row', height: 14, borderRadius: radius.sm, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  powerPlot: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 2, height: 72 },
  powerCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  powerCount: { fontSize: 11, lineHeight: 14, marginBottom: 2 },
  powerBar: { width: '50%', maxWidth: 22, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  powerAxis: { flexDirection: 'row', gap: 4 },
  powerTick: { flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 14 },
  notes: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rotatedList: { paddingLeft: 24, paddingTop: 4 },
  handHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hand: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.xs },
  handCard: { width: '18%', maxWidth: 120, gap: 4 },
  handFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  lifeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cardBack: { width: 18, aspectRatio: CARD_ASPECT_RATIO, borderRadius: 2, borderWidth: 1 },
  handActions: { flexDirection: 'row', gap: spacing.sm },
});
