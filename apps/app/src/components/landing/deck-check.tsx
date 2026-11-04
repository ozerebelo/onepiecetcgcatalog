import { parseDecklist, toShoppingList, type DeckItem } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchCardsBrief, type LandingPrinting } from '@/lib/api';
import { fonts, poster, tabular } from '@/theme';

import { HEADER_HEIGHT } from './hero';
import { PHeading, PText, Reveal, dataSet, web, type PosterLayout } from './kit';

const STAGES = 4;
/** Copies of each line the sample binder holds (leader first). */
const SAMPLE_OWNED = [1, 4, 4, 2, 4, 0, 4, 3, 4, 1, 4, 4, 0, 2];
const SAMPLE_QUANTITIES = [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2];

/** A sample deck from the newest set: its leader in one colour plus 50 cards of that colour. */
export function buildSample(cards: LandingPrinting[]) {
  const leaders = cards.filter((c) => c.category === 'Leader');
  const leader = leaders.find((l) => l.colors.includes('Red')) ?? leaders[0];
  const colour = leader?.colors[0];
  const others = cards.filter((c) => c.category !== 'Leader');
  const pool = [
    ...others.filter((c) => !colour || c.colors.includes(colour)),
    ...others.filter((c) => colour && !c.colors.includes(colour)),
  ];
  const lines = [leader, ...pool].filter(Boolean).slice(0, SAMPLE_QUANTITIES.length) as LandingPrinting[];
  const owned: Record<string, number> = {};
  lines.forEach((c, i) => (owned[c.card_id] = SAMPLE_OWNED[i] ?? 0));
  const text = lines.map((c, i) => `${SAMPLE_QUANTITIES[i]}x${c.card_id}`).join('\n');
  const known: Record<string, { name: string; image_url: string | null }> = {};
  for (const c of cards) known[c.card_id] = { name: c.name, image_url: c.image_url };
  return { text, owned, known };
}

interface Row extends DeckItem {
  name: string | null;
  image_url: string | null;
  owned: number;
}

/**
 * How it works, as the page's live thing: a real Sim-format decklist (editable) checked against a
 * sample binder. A slider walks through the four stages; each stage shows the product in that state.
 */
export function DeckCheck({ layout, cards }: { layout: PosterLayout; cards: LandingPrinting[] }) {
  const { t } = useTranslation();
  const sample = useMemo(() => buildSample(cards), [cards]);
  const [text, setText] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const list = text ?? sample.text;
  const parsed = useMemo(() => parseDecklist(list), [list]);

  // Cards typed in that the page doesn't know yet: look them up (debounced).
  const debounced = useDebouncedValue(parsed.items, 400);
  const unknown = debounced
    .map((i) => i.card_id)
    .filter((id) => !sample.known[id])
    .sort();
  const lookup = useQuery({
    queryKey: ['landing-cards', unknown.join(',')],
    queryFn: () => fetchCardsBrief(unknown),
    enabled: unknown.length > 0,
    staleTime: Infinity,
  });

  const rows: Row[] = parsed.items.map((item) => {
    const info = sample.known[item.card_id] ?? lookup.data?.[item.card_id];
    return {
      ...item,
      name: info?.name ?? null,
      image_url: info?.image_url ?? null,
      owned: Math.min(item.quantity, sample.owned[item.card_id] ?? 0),
    };
  });
  const owned = rows.reduce((n, r) => n + r.owned, 0);
  const missing = rows.filter((r) => r.owned < r.quantity).map((r) => ({ ...r, quantity: r.quantity - r.owned }));

  const stageNames = [t('landing.check.stage1'), t('landing.check.stage2'), t('landing.check.stage3'), t('landing.check.stage4')];
  const clauses = [t('landing.check.clause1'), t('landing.check.clause2'), t('landing.check.clause3'), t('landing.check.clause4')];

  const { phone, wide, margin, size, height } = layout;
  const fragment = (
    <Fragment
      stage={stage}
      text={list}
      onText={setText}
      rows={rows}
      owned={owned}
      total={parsed.total}
      missing={missing}
      width={wide ? 460 : Math.min(560, layout.width - margin * 2)}
    />
  );
  const slider = <StageSlider stage={stage} onStage={setStage} names={stageNames} phone={phone} />;
  const clause = (
    <View style={{ gap: 16 }}>
      <PHeading level={2} size={size.head} color={poster.ink}>
        {clauses[stage]}
      </PHeading>
      <PText size={size.body} color={poster.ink} style={{ maxWidth: 440 }}>
        {t('landing.check.body')}
      </PText>
    </View>
  );

  if (!wide) {
    // Heading first, then the product and the slider that drives it.
    return (
      <View>
        <View
          style={{
            backgroundColor: poster.green,
            paddingHorizontal: margin,
            paddingTop: phone ? 72 : 96,
            paddingBottom: 48,
          }}
        >
          <Reveal>{clause}</Reveal>
        </View>
        <View
          style={{
            backgroundColor: poster.bone,
            paddingHorizontal: margin,
            paddingTop: 40,
            paddingBottom: 56,
            gap: 28,
            alignItems: phone ? 'stretch' : 'center',
          }}
        >
          <Reveal delay={80}>{fragment}</Reveal>
          <View style={{ width: '100%', maxWidth: 560 }}>{slider}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ minHeight: Math.max(720, height * 0.92), flexDirection: 'row' }}>
      <View
        style={[
          styles.half,
          {
            backgroundColor: poster.green,
            paddingLeft: margin,
            paddingTop: HEADER_HEIGHT + 56,
            paddingRight: 40,
          },
        ]}
      >
        <Reveal>{clause}</Reveal>
      </View>
      <View
        style={[
          styles.half,
          {
            backgroundColor: poster.bone,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: HEADER_HEIGHT + 24,
            paddingBottom: 140,
          },
        ]}
      >
        <Reveal delay={120}>{fragment}</Reveal>
      </View>
      <View style={[styles.sliderRow, { left: margin, right: margin }]}>{slider}</View>
    </View>
  );
}

function StageSlider({ stage, onStage, names, phone }: { stage: number; onStage: (n: number) => void; names: string[]; phone: boolean }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(1);
  const thumb = phone ? 40 : 32;
  const responder = useMemo(() => {
    const pick = (x: number) => onStage(Math.max(0, Math.min(STAGES - 1, Math.round((x / width) * (STAGES - 1)))));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    });
  }, [onStage, width]);
  const keyHandler = {
    onKeyDown: (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
      const key = e.nativeEvent.key;
      if (key === 'ArrowRight' || key === 'ArrowUp') onStage(Math.min(STAGES - 1, stage + 1));
      else if (key === 'ArrowLeft' || key === 'ArrowDown') onStage(Math.max(0, stage - 1));
      else if (key === 'Home') onStage(0);
      else if (key === 'End') onStage(STAGES - 1);
      else return;
      e.preventDefault?.();
    },
  };
  const pct = stage / (STAGES - 1);

  return (
    <View style={{ gap: 14 }}>
      <View
        {...responder.panHandlers}
        {...(Platform.OS === 'web' ? keyHandler : {})}
        focusable
        accessible
        role="slider"
        aria-label={t('landing.check.sliderLabel')}
        aria-valuemin={1}
        aria-valuemax={STAGES}
        aria-valuenow={stage + 1}
        aria-valuetext={names[stage]}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onStage(e.nativeEvent.actionName === 'increment' ? Math.min(STAGES - 1, stage + 1) : Math.max(0, stage - 1))
        }
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        style={[{ height: thumb + 12, justifyContent: 'center' }, web({ cursor: 'pointer', outlineOffset: 6 })]}
      >
        <View style={[styles.track, { backgroundColor: 'rgba(26,26,26,0.2)' }]} pointerEvents="none">
          <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: thumb,
              height: thumb,
              left: `${pct * 100}%`,
              marginLeft: -thumb * pct,
            },
            web({
              transitionProperty: 'left, margin-left',
              transitionDuration: '200ms',
            }),
          ]}
        />
      </View>
      <View style={[styles.names, phone && styles.namesPhone]}>
        {names.map((name, i) => (
          <Pressable
            key={name}
            onPress={() => onStage(i)}
            style={[phone ? styles.namePhone : styles.name]}
            accessibilityRole="button"
            aria-label={name}
          >
            <PText
              face={i === stage ? 'black' : 'regular'}
              size={phone ? 15 : 16}
              color={poster.ink}
              style={!phone && i === STAGES - 1 ? styles.right : null}
            >
              {name}
            </PText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Fragment({
  stage,
  text,
  onText,
  rows,
  owned,
  total,
  missing,
  width,
}: {
  stage: number;
  text: string;
  onText: (value: string) => void;
  rows: Row[];
  owned: number;
  total: number;
  missing: Row[];
  width: number;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const shopping = toShoppingList(missing);
  const toBuy = missing.reduce((n, r) => n + r.quantity, 0);

  const header = [
    t('landing.check.headerPaste', { lines: rows.length, total }),
    t('landing.check.headerMatch', {
      count: rows.filter((r) => r.name).length,
      lines: rows.length,
    }),
    t('landing.check.headerCheck', { owned, total }),
    t('landing.check.headerCopy', { count: toBuy }),
  ][stage];

  return (
    <View style={[ui.panel, { width }]} {...dataSet({ ui: 'deck-check' })}>
      <View style={ui.head}>
        <PText face="medium" size={16} color={ui.text.color} style={{ flex: 1 }}>
          {t('landing.check.deckName')}
        </PText>
        <PText size={14} color={ui.muted.color} style={tabular}>
          {header}
        </PText>
      </View>

      {stage === 0 ? (
        <TextInput
          value={text}
          onChangeText={onText}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel={t('landing.check.inputLabel')}
          style={[ui.input, { ...fonts.medium }, tabular, web({ outlineStyle: 'none', resize: 'none' })]}
        />
      ) : stage === 3 ? (
        <View style={ui.body}>
          <ScrollView style={{ height: 284 }}>
            <PText size={16} color={ui.text.color} leading={1.6} style={tabular}>
              {shopping || t('landing.check.nothingMissing')}
            </PText>
          </ScrollView>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(shopping);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            accessibilityRole="button"
            style={({ hovered }) => [ui.copy, hovered && { backgroundColor: '#000' }]}
          >
            <PText face="medium" size={16} color="#FFFFFF">
              {copied ? t('landing.check.copied') : t('landing.check.copy')}
            </PText>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={ui.list}>
          {rows.map((row, i) => (
            <View key={row.card_id} style={[ui.row, i > 0 && ui.rule]}>
              <View style={ui.thumb}>
                {row.image_url ? <Image source={{ uri: row.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <PText face="medium" size={16} color={row.name ? ui.text.color : ui.muted.color} numberOfLines={1}>
                  {row.name ?? t('landing.check.unknown')}
                </PText>
                <PText size={14} color={ui.muted.color} style={tabular}>
                  {row.card_id}
                </PText>
              </View>
              {stage === 1 ? (
                <PText face="medium" size={16} color={ui.text.color} style={tabular}>
                  {`×${row.quantity}`}
                </PText>
              ) : row.owned >= row.quantity ? (
                <View style={[ui.pill, { backgroundColor: '#DCFAE5' }]}>
                  <PText face="medium" size={14} color="#04250E" style={tabular}>
                    {`${row.owned}/${row.quantity}`}
                  </PText>
                </View>
              ) : (
                <View style={[ui.pill, { backgroundColor: '#FFEDEA' }]}>
                  <PText face="medium" size={14} color="#831C1E" style={tabular}>
                    {t('landing.check.need', {
                      count: row.quantity - row.owned,
                    })}
                  </PText>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  half: { flex: 1 },
  sliderRow: { position: 'absolute', bottom: 28 },
  track: { height: 8, width: '100%' },
  trackFill: { height: 8, backgroundColor: poster.ink },
  thumb: { position: 'absolute', backgroundColor: poster.ink },
  names: { flexDirection: 'row', justifyContent: 'space-between' },
  namesPhone: { flexWrap: 'wrap', rowGap: 8 },
  name: { flex: 1 },
  namePhone: { width: '50%' },
  right: { textAlign: 'right' },
});

const ui = {
  text: { color: '#1A1A1A' },
  muted: { color: '#5F5B52' },
  ...StyleSheet.create({
    panel: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E6E4DF',
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: '#F7F6F4',
    },
    list: { height: 340 },
    body: { padding: 20, gap: 16 },
    input: {
      height: 340,
      paddingHorizontal: 20,
      paddingVertical: 16,
      fontSize: 16,
      lineHeight: 24,
      color: '#1A1A1A',
      textAlignVertical: 'top',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      height: 60,
    },
    rule: { borderTopWidth: 1, borderTopColor: '#F0EFEC' },
    thumb: {
      width: 28,
      height: 39,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: '#ECEBE8',
    },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    copy: {
      alignSelf: 'flex-start',
      backgroundColor: '#1A1A1A',
      borderRadius: 999,
      paddingHorizontal: 18,
      minHeight: 40,
      justifyContent: 'center',
    },
  }),
};
