import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Logo } from '@/components/brand/logo';
import { CardImage } from '@/components/card-image';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Badge, Panel } from '@/components/ui/panel';
import { PressableArea } from '@/components/ui/pressable-area';
import { Container } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { fetchCatalogStats, fetchShowcase, type Showcase } from '@/lib/api';
import { MAX_CONTENT_WIDTH, WIDE_BREAKPOINT, radius, spacing, usePalette } from '@/theme';

const FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'layers', key: 'printings' },
  { icon: 'check-square', key: 'decks' },
  { icon: 'grid', key: 'sets' },
  { icon: 'upload-cloud', key: 'import' },
  { icon: 'refresh-cw', key: 'updated' },
  { icon: 'smartphone', key: 'everywhere' },
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
  const gradient = palette.heroGradient as unknown as [string, string, ...string[]];

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.page}>
      {/* Hero */}
      <LinearGradient colors={gradient} style={styles.hero}>
        <View style={[styles.glow, styles.glowRed]} />
        <View style={[styles.glow, styles.glowGold]} />
        <Container style={[styles.heroInner, wide && styles.heroInnerWide]}>
          <View style={[styles.heroText, wide && { flex: 1 }]}>
            {!wide ? <Logo size={28} color={palette.heroText} /> : null}
            <View style={[styles.pill, { borderColor: 'rgba(255,255,255,0.18)' }]}>
              <View style={[styles.pillDot, { backgroundColor: palette.accent }]} />
              <Text variant="caption" weight="medium" tone="heroSecondary">
                {t('landing.eyebrow')}
              </Text>
            </View>
            <Text variant="display" tone="hero" style={[styles.h1, !wide && styles.h1Narrow]} accessibilityRole="header">
              {t('landing.titleLine1')}
              {'\n'}
              <Text variant="display" style={[styles.h1, !wide && styles.h1Narrow, { color: palette.accent }]}>
                {t('landing.titleLine2')}
              </Text>
            </Text>
            <Text tone="heroSecondary" style={styles.lead}>
              {t('landing.lead')}
            </Text>
            <View style={styles.ctaRow}>
              <Link href="/auth/sign-up" asChild>
                <Button title={t('landing.ctaPrimary')} size="lg" trailingIcon="arrow-right" />
              </Link>
              <Link href="/cards" asChild>
                <Button title={t('landing.ctaSecondary', { count: n(stats.data?.cards ?? 2800) })} size="lg" variant="hero" />
              </Link>
            </View>
          </View>
          <CardFan showcase={showcase.data ?? null} wide={wide} />
        </Container>
      </LinearGradient>

      {/* Stats */}
      <Container style={styles.statsRow}>
        {[
          { value: n(stats.data?.cards), label: t('landing.stats.cards') },
          { value: n(stats.data?.printings), label: t('landing.stats.printings') },
          { value: n(stats.data?.sets), label: t('landing.stats.sets') },
          { value: 'EN + JP', label: t('landing.stats.languages') },
        ].map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text variant="title">{s.value}</Text>
            <Text variant="caption" tone="secondary">
              {s.label}
            </Text>
          </View>
        ))}
      </Container>

      {/* Features */}
      <Container style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="eyebrow" tone="primary">
            {t('landing.featuresEyebrow')}
          </Text>
          <Text variant="title" style={styles.center} accessibilityRole="header">
            {t('landing.featuresTitle')}
          </Text>
        </View>
        <View style={styles.featureGrid}>
          {FEATURES.map((f) => (
            <Panel key={f.key} style={[styles.feature, { flexBasis: wide ? '31%' : '100%' }]}>
              <View style={[styles.featureIcon, { backgroundColor: palette.primarySoft }]}>
                <Icon name={f.icon} size={20} color={palette.primary} />
              </View>
              <Text variant="subheading">{t(`landing.features.${f.key}.title`)}</Text>
              <Text tone="secondary">{t(`landing.features.${f.key}.body`)}</Text>
            </Panel>
          ))}
        </View>
      </Container>

      {/* Deck check demo */}
      <Container style={[styles.section, wide && styles.split]}>
        <View style={[styles.splitText, wide && { flex: 1 }]}>
          <Text variant="eyebrow" tone="primary">
            {t('landing.deckEyebrow')}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {t('landing.deckTitle')}
          </Text>
          <Text tone="secondary">{t('landing.deckBody')}</Text>
          {[t('landing.deckPoint1'), t('landing.deckPoint2'), t('landing.deckPoint3')].map((point) => (
            <View key={point} style={styles.point}>
              <Icon name="check-circle" size={18} color={palette.success} />
              <Text style={styles.flex}>{point}</Text>
            </View>
          ))}
        </View>
        <DeckDemo showcase={showcase.data ?? null} wide={wide} />
      </Container>

      {/* Latest set */}
      {showcase.data ? (
        <Container style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text variant="eyebrow" tone="primary">
                {t('landing.latestEyebrow')}
              </Text>
              <Text variant="heading">
                {showcase.data.set.code} · {showcase.data.set.name}
              </Text>
            </View>
            <Link href={{ pathname: '/set/[id]', params: { id: showcase.data.set.id } }} asChild>
              <Button title={t('landing.viewSet')} variant="outline" size="sm" trailingIcon="arrow-right" />
            </Link>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {showcase.data.printings.map((p) => (
              <Link key={p.id} href={{ pathname: '/card/[id]', params: { id: p.card_id, printing: p.id } }} asChild>
                <PressableArea boxStyle={styles.stripCard} activeStyle={styles.lift} accessibilityLabel={`${p.name}, ${p.code}`}>
                  <View style={{ boxShadow: palette.shadow, borderRadius: radius.md }}>
                    <CardImage uri={p.image_url} label={`${p.code} ${p.name}`} />
                  </View>
                </PressableArea>
              </Link>
            ))}
          </ScrollView>
        </Container>
      ) : null}

      {/* Closing CTA */}
      <Container style={styles.section}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
          <Text variant="title" tone="hero" style={styles.center}>
            {t('landing.closingTitle')}
          </Text>
          <Text tone="heroSecondary" style={[styles.center, { maxWidth: 520 }]}>
            {t('landing.closingBody')}
          </Text>
          <View style={[styles.ctaRow, { justifyContent: 'center' }]}>
            <Link href="/auth/sign-up" asChild>
              <Button title={t('landing.ctaPrimary')} size="lg" trailingIcon="arrow-right" />
            </Link>
            <Link href="/auth/sign-in" asChild>
              <Button title={t('account.signIn')} size="lg" variant="hero" />
            </Link>
          </View>
        </LinearGradient>
      </Container>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: palette.border }]}>
        <Container style={styles.footerInner}>
          <Logo size={22} />
          <Text variant="caption" tone="muted" style={styles.footerText}>
            {t('account.about')}
          </Text>
        </Container>
      </View>
    </ScrollView>
  );
}

function CardFan({ showcase, wide }: { showcase: Showcase | null; wide: boolean }) {
  const palette = usePalette();
  const cards = (showcase?.printings ?? []).slice(0, 4);
  const cardWidth = wide ? 190 : 118;
  const angles = [-14, -5, 5, 14];
  return (
    <View
      style={[styles.fan, { height: cardWidth * 1.55, maxWidth: MAX_CONTENT_WIDTH }, wide ? { flex: 1 } : null]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {(cards.length ? cards : Array.from({ length: 4 }, () => null)).map((card, i) => (
        <View
          key={card?.id ?? i}
          style={[
            styles.fanCard,
            {
              width: cardWidth,
              transform: [{ translateX: (i - 1.5) * cardWidth * 0.52 }, { translateY: Math.abs(i - 1.5) * 10 }, { rotate: `${angles[i]}deg` }],
              boxShadow: palette.shadowStrong,
              zIndex: i,
            },
          ]}>
          <CardImage uri={card?.image_url} label={card?.code ?? ''} rounded={radius.lg} priority="high" />
        </View>
      ))}
    </View>
  );
}

function DeckDemo({ showcase, wide }: { showcase: Showcase | null; wide: boolean }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const rows = (showcase?.printings ?? []).slice(4, 8);
  const demo = [
    { need: 4, have: 4 },
    { need: 4, have: 2 },
    { need: 2, have: 0 },
    { need: 1, have: 1 },
  ];
  return (
    <Panel style={[styles.demo, wide && { flex: 1 }]}>
      <View style={styles.rowBetween}>
        <Text variant="subheading">{t('landing.demoDeck')}</Text>
        <Badge label={t('landing.demoProgress')} tone="accent" />
      </View>
      {demo.map((d, i) => {
        const card = rows[i];
        const complete = d.have >= d.need;
        return (
          <View key={i} style={[styles.demoRow, { borderTopColor: palette.border }]}>
            <View style={styles.demoThumb}>
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
            {complete ? (
              <Badge label={`${d.have}/${d.need}`} tone="success" icon="check" />
            ) : (
              <Badge label={t('decks.needMore', { count: d.need - d.have })} tone="danger" />
            )}
          </View>
        );
      })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl, gap: spacing.huge },
  hero: { overflow: 'hidden', paddingTop: spacing.xxxl, paddingBottom: spacing.huge },
  glow: { position: 'absolute', width: 520, height: 520, borderRadius: 260, opacity: 0.22 },
  glowRed: { backgroundColor: '#EF4452', top: -220, right: -120, filter: 'blur(90px)' } as object,
  glowGold: { backgroundColor: '#F4B942', bottom: -300, left: -160, opacity: 0.12, filter: 'blur(100px)' } as object,
  heroInner: { gap: spacing.xxxl },
  heroInnerWide: { flexDirection: 'row', alignItems: 'center' },
  heroText: { gap: spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  h1: { fontSize: 56, lineHeight: 60 },
  h1Narrow: { fontSize: 38, lineHeight: 42 },
  lead: { fontSize: 17, lineHeight: 27, maxWidth: 540 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  fan: { alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  fanCard: { position: 'absolute', borderRadius: radius.lg },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: spacing.xl, marginTop: -spacing.xl },
  stat: { alignItems: 'center', minWidth: 140, gap: 2 },
  section: { gap: spacing.xl },
  sectionHead: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  feature: { flexGrow: 1, gap: spacing.sm },
  featureIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  split: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxxl },
  splitText: { gap: spacing.md },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  demo: { gap: 0 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  demoThumb: { width: 44 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm },
  strip: { gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: 2 },
  stripCard: { width: 150 },
  lift: { transform: [{ translateY: -4 }] },
  cta: { borderRadius: radius.xl, padding: spacing.xxxl, alignItems: 'center', gap: spacing.md, overflow: 'hidden' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xl },
  footerInner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  footerText: { flex: 1, minWidth: 240 },
});
