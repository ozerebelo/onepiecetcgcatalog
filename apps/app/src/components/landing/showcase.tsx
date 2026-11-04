import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import type { LandingPrinting } from '@/lib/api';
import { poster } from '@/theme';

import { HEADER_HEIGHT } from './hero';
import { PHeading, PText, Reveal, web, type PosterLayout } from './kit';

const PANEL_TONES = [poster.bone, poster.yellow, poster.green, poster.red, poster.boneStep, poster.yellow];

/**
 * "One card, many printings": cards crossing a held black stage. On wide web the stage is pinned
 * while the page scrolls and the track of printings travels right to left; elsewhere the printings
 * simply stack.
 */
export function Showcase({
  layout,
  printings,
  scrollY,
  offset,
}: {
  layout: PosterLayout;
  printings: LandingPrinting[];
  scrollY: Animated.Value;
  /** Where this section starts on the page. */
  offset: number;
}) {
  const { t } = useTranslation();
  const [top, setTop] = useState(0);
  const items = printings.slice(0, layout.wide ? 4 : 6);
  const name = items[0]?.name ?? '';
  const heading = t('landing.showcaseTitle', { count: printings.length });
  const pinned = Platform.OS === 'web' && layout.wide && items.length > 1;

  if (!items.length) return null;

  if (!pinned) {
    const { margin, size } = layout;
    return (
      <View
        style={{
          backgroundColor: poster.black,
          paddingHorizontal: margin,
          paddingTop: 96,
          paddingBottom: 120,
          gap: 24,
        }}
      >
        <Reveal>
          <PHeading level={2} size={size.head} color={poster.paper}>
            {heading}
          </PHeading>
        </Reveal>
        <Reveal delay={80}>
          <PText size={size.body} color={poster.paper} style={{ maxWidth: 560 }}>
            {t('landing.showcaseBody', { name })}
          </PText>
        </Reveal>
        <View style={{ gap: 24, marginTop: 16 }}>
          {items.map((p, i) => (
            <Reveal key={p.id} delay={60}>
              <PrintingCard
                printing={p}
                tone={PANEL_TONES[i % PANEL_TONES.length]}
                width={layout.width - margin * 2}
                layout={layout}
                phone
              />
            </Reveal>
          ))}
        </View>
      </View>
    );
  }

  const { width, height, margin, size } = layout;
  const stage = Math.max(height, 640);
  const cardW = Math.round(Math.min(600, Math.max(400, width * 0.4), (stage - HEADER_HEIGHT - 96) / 0.78));
  const cardsTop = Math.round((stage - cardW * 0.78) / 2 + HEADER_HEIGHT / 2);
  const gap = 40;
  const startX = Math.round(width * 0.42); // the first card starts left of centre, the next ones queue to the right
  const trackW = items.length * cardW + (items.length - 1) * gap;
  const endX = width - margin - trackW; // the last card ends on the right margin
  const travel = Math.max(0, startX - endX);
  const translateX = scrollY.interpolate({
    inputRange: [offset + top, offset + top + travel],
    // The stage is clipped at the page margins; positions are relative to its left edge.
    outputRange: [startX - margin, endX - margin],
    extrapolate: 'clamp',
  });

  // The heading scrolls away in the normal flow; then the stage pins and the printings travel across it.
  return (
    <View style={{ backgroundColor: poster.black }}>
      <View style={[styles.headRow, { paddingHorizontal: margin, paddingTop: HEADER_HEIGHT + 96 }]}>
        <Reveal style={styles.flex}>
          <PHeading level={2} size={size.head} color={poster.paper}>
            {heading}
          </PHeading>
        </Reveal>
        <Reveal delay={80} style={{ width: Math.min(440, Math.round(width * 0.3)) }}>
          <PText size={size.body} color={poster.paper}>
            {t('landing.showcaseBody', { name })}
          </PText>
        </Reveal>
      </View>
      <View style={{ height: stage + travel }} onLayout={(e) => setTop(e.nativeEvent.layout.y)}>
        <View style={[{ height: stage, overflow: 'hidden', marginHorizontal: margin }, web({ position: 'sticky', top: 0 })]}>
          <Animated.View
            style={[
              styles.track,
              {
                width: trackW,
                gap,
                top: cardsTop,
                transform: [{ translateX }],
              },
            ]}
          >
            {items.map((p, i) => (
              <PrintingCard key={p.id} printing={p} tone={PANEL_TONES[i % PANEL_TONES.length]} width={cardW} layout={layout} />
            ))}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function PrintingCard({
  printing,
  tone,
  width,
  layout,
  phone = false,
}: {
  printing: LandingPrinting;
  tone: string;
  width: number;
  layout: PosterLayout;
  phone?: boolean;
}) {
  const { t } = useTranslation();
  const height = phone ? Math.round(width * 0.75) + 130 : Math.round(width * 0.78);
  const pictureH = phone ? Math.round(width * 0.75) : Math.round(height * 0.68);
  const kind =
    printing.variant === 'base'
      ? t('landing.printing.base')
      : printing.variant === 'parallel'
        ? t('landing.printing.parallel')
        : t('landing.printing.reprint');
  const language = printing.language === 'ja' ? t('landing.printing.japanese') : t('landing.printing.english');
  return (
    <View style={{ width, height }} accessibilityLabel={`${kind}, ${language}, ${printing.code}`}>
      <View
        style={{
          height: pictureH,
          backgroundColor: poster.blackStep,
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: printing.image_url ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={{ top: '12%', left: '50%' }}
          transition={200}
          accessibilityLabel={`${printing.name} ${printing.code}`}
        />
      </View>
      <View style={[styles.panel, { backgroundColor: tone, padding: phone ? 20 : 28 }]}>
        <PText face="black" size={layout.size.title} leading={1} track={-0.03} color={poster.ink} style={styles.flex}>
          {kind}
        </PText>
        <PText size={layout.size.small} color={poster.ink} style={[styles.right, { maxWidth: phone ? 150 : 240 }]}>
          {`${language}\n${printing.code}`}
        </PText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, flexDirection: 'row' },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 48 },
  panel: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  flex: { flex: 1 },
  right: { textAlign: 'right' },
});
