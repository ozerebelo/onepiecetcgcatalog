import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CardImage } from '@/components/card-image';
import { PressableArea } from '@/components/ui/pressable-area';
import type { LandingPrinting } from '@/lib/api';
import { poster } from '@/theme';

import { PButton, PText, Reveal, web, type PosterLayout } from './kit';

export const HEADER_HEIGHT = 68;
/** Multiplied: about #2E2C2A on the bone field and #2F0F0E on the red one. */
const HEADLINE_INK = '#333333';

/**
 * Headline across two fields: bone above, red below, meeting on a hard seam. The two-line headline
 * straddles the seam and changes ink where it crosses (two stacked copies, each clipped to its field).
 * Below the fold the red field continues and the newest set's red cards rise out of it.
 */
export function Hero({
  layout,
  cards,
  cardCount,
  onSeam,
}: {
  layout: PosterLayout;
  cards: LandingPrinting[];
  cardCount: string;
  /** Reports where the seam and the bottom are, for the header's chapter colours. */
  onSeam: (seam: number, bottom: number) => void;
}) {
  const { t } = useTranslation();
  const { size, phone, margin, width } = layout;
  const screen = Math.max(layout.height, phone ? 640 : 680);
  const F = size.display;
  const LH = Math.round(F * 0.88);
  // Line two is cut through its upper third by the seam.
  const seam = Math.max(phone ? screen * 0.46 : screen * 0.5, HEADER_HEIGHT + 24 + LH * 1.34);
  const headTop = seam - LH * 1.34;
  const total = Math.round(screen * 1.3);
  const title = `${t('landing.titleLine1')}\n${t('landing.titleLine2')}`;

  const cardWidth = phone ? Math.round(width * 0.34) : Math.min(230, Math.round(width * 0.14));
  const shown = cards.slice(0, phone ? 5 : 7);
  const headline = {
    fontSize: F,
    lineHeight: LH,
    letterSpacing: -0.045 * F,
    textAlign: 'center' as const,
    position: 'absolute' as const,
    left: margin,
    right: margin,
  };

  return (
    <View style={{ height: total, overflow: 'hidden' }} onLayout={() => onSeam(seam, total)}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: poster.bone, bottom: undefined, height: seam }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: poster.red, top: seam }]} />

      {/* One headline across the seam. Multiplied onto the fields it reads near-black on the bone and
          deep red where it sinks into the red, so the ink changes exactly at the seam. */}
      <PText
        face="black"
        size={F}
        color={HEADLINE_INK}
        role="heading"
        aria-level={1}
        style={[headline, { top: headTop, mixBlendMode: 'multiply' }]}
      >
        {title}
      </PText>

      <View
        style={[
          styles.below,
          {
            top: headTop + LH * 2 + (phone ? 28 : 40),
            paddingHorizontal: margin,
          },
        ]}
      >
        <Reveal delay={120}>
          <PText size={phone ? size.body : size.lead} color={poster.ink} style={[styles.center, { maxWidth: phone ? 340 : 620 }]}>
            {t('landing.lead')}
          </PText>
        </Reveal>
        <Reveal delay={200} style={styles.actions}>
          <Link href="/auth/sign-up" asChild>
            <PButton label={t('landing.ctaPrimary')} bg={poster.ink} fg={poster.bone} size={size.small} />
          </Link>
          <Link href="/cards" asChild>
            <PressableArea boxStyle={styles.textLink} accessibilityRole="link">
              <PText face="medium" size={size.small} color={poster.ink} style={styles.underline}>
                {t('landing.ctaSecondary', { count: cardCount })}
              </PText>
            </PressableArea>
          </Link>
        </Reveal>
      </View>

      {/* The newest set's red cards, rising out of the red field and cut by the next chapter. */}
      <View
        style={[
          styles.cards,
          {
            top: Math.round(screen * (phone ? 0.9 : 0.86)),
            gap: phone ? 10 : 16,
          },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {shown.map((card, i) => (
          <Reveal key={card.id} delay={260 + i * 70}>
            <View
              style={[
                {
                  width: cardWidth,
                  marginTop: Math.abs(i - (shown.length - 1) / 2) * (phone ? 14 : 22),
                },
                web({
                  transitionProperty: 'transform',
                  transitionDuration: '300ms',
                }),
              ]}
            >
              <CardImage uri={card.image_url} label={`${card.code} ${card.name}`} rounded={0} priority="high" />
            </View>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  below: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 28,
  },
  center: { textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  textLink: { minHeight: 48, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  cards: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
