import { isOwnSetCard, rarityShort } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Logo } from '@/components/brand/logo';
import { CardImage } from '@/components/card-image';
import { ChecklistHeader, ChecklistRow } from '@/components/checklist';
import { Button } from '@/components/ui/button';
import { Pips } from '@/components/ui/pips';
import { PressableArea } from '@/components/ui/pressable-area';
import { Container } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { fetchCatalogStats, fetchShowcase, type Showcase } from '@/lib/api';
import { formatReleaseDate, titleCase } from '@/lib/format';
import { WIDE_BREAKPOINT, fonts, radius, spacing, usePalette } from '@/theme';

const STEPS = ['own', 'paste', 'pull'] as const;
/** Sample marks for the checklist on the landing page (copies owned, per row). */
const SAMPLE_OWNED = [4, 4, 2, 0, 1, 4, 3, 0];
/** Sample deck rows: copies the deck needs and copies owned. */
const SAMPLE_DECK = [
  { need: 4, have: 4 },
  { need: 4, have: 2 },
  { need: 3, have: 0 },
  { need: 2, have: 2 },
  { need: 4, have: 3 },
];

/** Public home page for visitors who aren't signed in. */
export function Landing() {
  const { t, i18n } = useTranslation();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const stats = useQuery({ queryKey: ['catalog-stats'], queryFn: fetchCatalogStats, staleTime: 60 * 60 * 1000 });
  const showcase = useQuery({ queryKey: ['showcase'], queryFn: fetchShowcase, staleTime: 60 * 60 * 1000 });
  const n = (value: number | undefined) => (value == null ? '—' : value.toLocaleString(i18n.language));
  const set = showcase.data?.set;
  const released = set ? formatReleaseDate(set.release_date, i18n.language, 'long') : null;

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.page}>
      {/* Masthead: the promise, and a real checklist beside it */}
      <Container style={[styles.masthead, wide && styles.split]}>
        <View style={[styles.mastText, wide && styles.half]}>
          {!wide ? <Logo size={28} /> : null}
          <Text variant="display" style={[styles.h1, !wide && styles.h1Narrow]} accessibilityRole="header">
            {t('landing.titleLine1')}
            {'\n'}
            {t('landing.titleLine2Before')}
            <Text variant="display" style={[styles.h1, !wide && styles.h1Narrow, { backgroundColor: palette.highlight, color: palette.onHighlight }]}>
              {t('landing.titleLine2Marked')}
            </Text>
          </Text>
          <Text style={styles.lead} tone="secondary">
            {t('landing.lead')}
          </Text>
          <View style={[styles.ctaRow, !wide && styles.ctaRowNarrow]}>
            <Link href="/auth/sign-up" asChild>
              <Button title={t('landing.ctaPrimary')} size="lg" trailingIcon="arrow-right" />
            </Link>
            <Link href="/cards" asChild>
              <Button title={t('landing.ctaSecondary', { count: n(stats.data?.cards ?? 2800) })} size="lg" variant="outline" />
            </Link>
          </View>
        </View>
        <SampleChecklist showcase={showcase.data ?? null} style={wide ? styles.half : undefined} />
      </Container>

      {/* How it works: three numbered steps under a printed rule */}
      <Container style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {t('landing.stepsTitle')}
        </Text>
        <View style={[styles.steps, { borderTopColor: palette.rule }]}>
          {STEPS.map((key, i) => (
            <View
              key={key}
              style={[
                styles.step,
                { flexBasis: wide ? 0 : '100%' },
                i > 0 && (wide ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border } : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }),
              ]}>
              <Text style={[styles.stepNumber, { color: palette.text }]}>{String(i + 1).padStart(2, '0')}</Text>
              <Text variant="heading">{t(`landing.steps.${key}.title`)}</Text>
              <Text tone="secondary">{t(`landing.steps.${key}.body`)}</Text>
            </View>
          ))}
        </View>
      </Container>

      {/* The pull list */}
      <Container style={[styles.section, wide && styles.split]}>
        <View style={[styles.pullText, wide && styles.half]}>
          <Text variant="title" accessibilityRole="header">
            {t('landing.pullTitle')}
          </Text>
          <Text tone="secondary" style={styles.lead}>
            {t('landing.pullBody')}
          </Text>
        </View>
        <SamplePullList showcase={showcase.data ?? null} style={wide ? styles.half : undefined} />
      </Container>

      {/* Newest set */}
      {showcase.data && set ? (
        <Container style={styles.section}>
          <View style={[styles.latest, { borderTopColor: palette.rule }, wide && styles.split]}>
            {set.image_url ? (
              <View style={[styles.latestArt, wide && styles.half]}>
                <Image source={{ uri: set.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityLabel={set.name} />
              </View>
            ) : null}
            <View style={[styles.latestText, wide && styles.half]}>
              <Text variant="title" accessibilityRole="header">
                {titleCase(set.name)}
              </Text>
              <Text variant="mono" tone="secondary">
                {t('landing.latestTag', { code: set.code })}
              </Text>
              <Text tone="secondary">
                {released
                  ? t('landing.latestBody', { date: released, count: set.printing_count })
                  : t('landing.latestBodyNoDate', { count: set.printing_count })}
              </Text>
              <Link href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
                <Button title={t('landing.viewSet')} variant="outline" trailingIcon="arrow-right" boxStyle={styles.start} />
              </Link>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {showcase.data.printings.slice(0, 12).map((p) => (
              <Link key={p.id} href={{ pathname: '/card/[id]', params: { id: p.card_id, printing: p.id } }} asChild>
                <PressableArea boxStyle={styles.stripCard} activeStyle={styles.lift} accessibilityLabel={`${p.name}, ${p.code}`}>
                  <CardImage uri={p.image_url} label={`${p.code} ${p.name}`} />
                </PressableArea>
              </Link>
            ))}
          </ScrollView>
        </Container>
      ) : null}

      {/* Closing */}
      <Container style={styles.section}>
        <View style={[styles.closing, { borderColor: palette.rule }]}>
          <Text variant="title" accessibilityRole="header">
            {t('landing.closingTitle')}
          </Text>
          <Text tone="secondary" style={styles.closingBody}>
            {t('landing.closingBody')}
          </Text>
          <View style={styles.ctaRow}>
            <Link href="/auth/sign-up" asChild>
              <Button title={t('landing.ctaPrimary')} size="lg" trailingIcon="arrow-right" />
            </Link>
            <Link href="/auth/sign-in" asChild>
              <Button title={t('account.signIn')} size="lg" variant="ghost" />
            </Link>
          </View>
        </View>
      </Container>

      {/* Footer */}
      <Container>
        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Logo size={22} />
          <Text variant="caption" tone="muted" style={styles.footerText}>
            {t('account.about')}
          </Text>
        </View>
      </Container>
    </ScrollView>
  );
}

/** One printing per card number, so samples never repeat a card. */
function distinctCards(printings: Showcase['printings']) {
  const seen = new Set<string>();
  return printings.filter((p) => !seen.has(p.card_id) && seen.add(p.card_id));
}

/** The newest set's first entries as a printed checklist, with sample marks. */
function SampleChecklist({ showcase, style }: { showcase: Showcase | null; style?: object }) {
  const { t } = useTranslation();
  const palette = usePalette();
  // The set's own cards (not reprints sold in the same packs), one printing each.
  const own = distinctCards(showcase?.printings ?? []).filter((p) => showcase && isOwnSetCard(p.card_id, showcase.set.code));
  const rows = own.slice(0, SAMPLE_OWNED.length);
  return (
    <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>
      <Text variant="subheading" style={styles.sheetTitle}>
        {showcase ? t('landing.sampleTitle', { code: showcase.set.code }) : ' '}
      </Text>
      <ChecklistHeader
        number={t('landing.sampleColumns.number')}
        card={t('landing.sampleColumns.card')}
        rarity={t('landing.sampleColumns.rarity')}
        playset={t('landing.sampleColumns.playset')}
      />
      {rows.map((p, i) => (
        <ChecklistRow
          key={p.id}
          code={p.card_id}
          name={p.name}
          rarity={rarityShort(p.rarity)}
          owned={SAMPLE_OWNED[i]}
          href={{ pathname: '/card/[id]', params: { id: p.card_id, printing: p.id } }}
          accessibilityLabel={`${p.name}, ${p.card_id}`}
        />
      ))}
      <Text variant="caption" tone="muted" style={styles.sheetNote}>
        {t('landing.sampleNote')}
      </Text>
    </View>
  );
}

/** An example deck checked against a collection: slots marked owned, red where still needed. */
function SamplePullList({ showcase, style }: { showcase: Showcase | null; style?: object }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const cards = distinctCards(showcase?.printings ?? []).slice(SAMPLE_OWNED.length, SAMPLE_OWNED.length + SAMPLE_DECK.length);
  const owned = SAMPLE_DECK.reduce((sum, d) => sum + Math.min(d.have, d.need), 0);
  const total = SAMPLE_DECK.reduce((sum, d) => sum + d.need, 0);
  return (
    <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>
      <Text variant="subheading" style={styles.sheetTitle}>
        {t('landing.demoDeck', { owned, total })}
      </Text>
      {SAMPLE_DECK.map((d, i) => {
        const card = cards[i];
        const missing = d.need - Math.min(d.have, d.need);
        return (
          <View key={i} style={[styles.pullRow, { borderTopColor: i === 0 ? palette.rule : palette.border, borderTopWidth: i === 0 ? 2 : StyleSheet.hairlineWidth }]}>
            <View style={styles.pullThumb}>
              <CardImage uri={card?.image_url} label={card?.code ?? ''} rounded={radius.sm} />
            </View>
            <View style={styles.flex}>
              <Text weight="semibold" numberOfLines={1}>
                {card?.name ?? '—'}
              </Text>
              <Text variant="mono" tone="muted">
                {card?.card_id ?? ''}
              </Text>
            </View>
            <Pips owned={Math.min(d.have, d.need)} need={d.need} />
            <Text variant="mono" style={[styles.pullCount, { color: missing ? palette.danger : palette.textSecondary }]}>
              {missing ? t('decks.needMore', { count: missing }) : t('landing.pull', { count: d.need })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl, gap: spacing.huge },
  masthead: { paddingTop: spacing.xxxl, gap: spacing.xxxl },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  half: { flex: 1, minWidth: 0 },
  mastText: { gap: spacing.lg, paddingTop: spacing.md },
  // Line height leaves room for descenders, so the highlighted words never cover the line above.
  h1: { fontSize: 64, lineHeight: 76, letterSpacing: -1.6 },
  h1Narrow: { fontSize: 44, lineHeight: 54, letterSpacing: -1 },
  lead: { fontSize: 17, lineHeight: 27, maxWidth: 560 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  ctaRowNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  sheet: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  sheetTitle: { paddingBottom: spacing.sm },
  sheetNote: { paddingTop: spacing.md },
  section: { gap: spacing.lg },
  steps: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 2 },
  step: { flexGrow: 1, gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  stepNumber: { fontFamily: fonts.monoMedium, fontSize: 15 },
  pullText: { gap: spacing.md, paddingTop: spacing.md },
  pullRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pullThumb: { width: 36 },
  pullCount: { width: 64, textAlign: 'right' },
  flex: { flex: 1 },
  latest: { gap: spacing.xl, borderTopWidth: 2, paddingTop: spacing.xl },
  latestArt: { aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden', minHeight: 200 },
  latestText: { gap: spacing.md },
  start: { alignSelf: 'flex-start' },
  strip: { gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: 2 },
  stripCard: { width: 140 },
  lift: { transform: [{ translateY: -3 }] },
  closing: { borderTopWidth: 2, borderBottomWidth: 2, paddingVertical: spacing.xxl, gap: spacing.md },
  closingBody: { maxWidth: 560, fontSize: 17, lineHeight: 27 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xl },
  footerText: { flex: 1, minWidth: 240 },
});
