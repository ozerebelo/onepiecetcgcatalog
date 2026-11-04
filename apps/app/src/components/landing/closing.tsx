import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableArea } from '@/components/ui/pressable-area';
import { fonts, poster, tabular } from '@/theme';

import { PText, Reveal, web, type PosterLayout } from './kit';

/** The closing sentence has a blank in it, and the blank is the sign-up form. */
export function Closing({ layout }: { layout: PosterLayout }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const { phone, margin, size } = layout;
  const S = size.title; // a statement, not a headline
  const go = () => {
    const value = email.trim();
    router.push(value ? { pathname: '/auth/sign-up', params: { email: value } } : '/auth/sign-up');
  };
  const blank = (
    <TextInput
      value={email}
      onChangeText={setEmail}
      onSubmitEditing={go}
      placeholder={t('landing.closing.placeholder')}
      placeholderTextColor={poster.inkSoft}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      accessibilityLabel={t('auth.email')}
      style={[
        {
          ...fonts.medium,
          fontSize: S,
          height: Math.round(S * 1.4),
          color: poster.ink,
          backgroundColor: poster.boneStep,
          paddingHorizontal: 14,
        },
        phone ? styles.blankPhone : { width: Math.round(S * 10.5), marginHorizontal: 12 },
        web({ outlineStyle: 'none' }),
      ]}
    />
  );
  const submit = (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      aria-label={t('landing.ctaPrimary')}
      style={({ hovered, pressed }) => [
        {
          backgroundColor: poster.green,
          height: Math.round(S * 1.4),
          paddingHorizontal: 16,
          justifyContent: 'center',
        },
        !phone && { marginLeft: 12 },
        (hovered || pressed) && { transform: [{ translateY: -2 }] },
        web({
          transitionProperty: 'transform',
          transitionDuration: '160ms',
          cursor: 'pointer',
        }),
      ]}
    >
      <PText face="black" size={S} leading={1.1} color={poster.ink}>
        {t('landing.closing.submit')}
      </PText>
    </Pressable>
  );

  return (
    <View
      style={{
        backgroundColor: poster.bone,
        paddingHorizontal: margin,
        paddingTop: phone ? 88 : 200,
        paddingBottom: phone ? 72 : 160,
      }}
    >
      <Reveal>
        <PText
          face="black"
          size={size.head}
          leading={0.92}
          track={-0.04}
          color={poster.ink}
          role="heading"
          aria-level={2}
          style={{ marginBottom: 32 }}
        >
          {t('landing.closing.title')}
        </PText>
      </Reveal>
      <Reveal delay={80} style={[styles.sentence, phone && styles.sentencePhone]}>
        <PText face="medium" size={S} leading={1.4} color={poster.ink}>
          {t('landing.closing.before')}
        </PText>
        {blank}
        {phone ? (
          <View style={styles.lastLine}>
            <PText face="medium" size={S} leading={1.4} color={poster.ink}>
              {t('landing.closing.after')}
            </PText>
            {submit}
          </View>
        ) : (
          <>
            <PText face="medium" size={S} leading={1.4} color={poster.ink}>
              {t('landing.closing.after')}
            </PText>
            {submit}
          </>
        )}
      </Reveal>
      <Reveal delay={140}>
        <PText size={size.small} color={poster.ink} style={{ marginTop: 24, maxWidth: 560 }}>
          {t('landing.closing.note')}
        </PText>
      </Reveal>
    </View>
  );
}

/** The footer: the last rows of a board of filled tiles. */
export function Footer({ layout, stats }: { layout: PosterLayout; stats: { cards: string; printings: string; sets: string } }) {
  const { t } = useTranslation();
  const { phone, wide, width, size } = layout;
  const compact = !wide;
  const gap = phone ? 6 : 8;
  const pad = phone ? 20 : 24;
  const tile = (bg: string) => ({ backgroundColor: bg, padding: pad });
  const links: {
    href: '/cards' | '/sets' | '/collection' | '/decks' | '/auth/sign-in';
    label: string;
  }[] = [
    { href: '/cards', label: t('tabs.cards') },
    { href: '/sets', label: t('tabs.sets') },
    { href: '/collection', label: t('tabs.collection') },
    { href: '/decks', label: t('tabs.decks') },
    { href: '/auth/sign-in', label: t('account.signIn') },
  ];

  const statement = (
    <View style={[tile(poster.boneStep), styles.between, compact ? styles.fullTile : { flex: 4 }]}>
      <PText size={size.lead} leading={1.3} color={poster.ink}>
        {t('landing.footer.statement')}
      </PText>
      <PText size={size.caption} color={poster.ink} style={{ marginTop: 24 }}>
        {t('account.about')}
      </PText>
    </View>
  );
  const nav = (
    <View style={[tile(poster.boneStep), compact ? styles.halfTile : { flex: 3 }, { gap: 6 }]} role="navigation">
      {links.map((l) => (
        <Link key={l.href} href={l.href} asChild>
          <PressableArea accessibilityRole="link" activeStyle={{ opacity: 0.6 }}>
            <PText face="medium" size={size.small} color={poster.ink}>
              {l.label}
            </PText>
          </PressableArea>
        </Link>
      ))}
    </View>
  );
  const updated = (
    <View style={[tile(poster.boneStep), styles.between, compact ? styles.halfTile : { flex: 2 }]}>
      <PText size={size.small} color={poster.ink}>
        {t('landing.footer.updated')}
      </PText>
    </View>
  );
  const numbers = (
    <View style={[tile(poster.boneStep), styles.between, compact ? styles.fullTile : { flex: 3 }]}>
      {[
        [stats.cards, t('landing.stats.cards')],
        [stats.printings, t('landing.stats.printings')],
        [stats.sets, t('landing.stats.sets')],
      ].map(([value, label]) => (
        <View key={label} style={styles.statRow}>
          <PText face="black" size={size.lead} color={poster.ink} style={tabular}>
            {value}
          </PText>
          <PText size={size.small} color={poster.ink}>
            {label}
          </PText>
        </View>
      ))}
    </View>
  );
  const wordmark = (
    <View style={[tile(poster.ink), styles.center, compact ? [styles.fullTile, { height: phone ? 160 : 240 }] : { flex: 9, height: 320 }]}>
      <PText
        face="black"
        size={phone ? size.head : compact ? size.display : Math.min(size.display, Math.floor(((width - 24 - gap) * 0.75 - pad * 2) / 7.4))}
        leading={1}
        track={-0.05}
        color={poster.bone}
        aria-hidden
      >
        Nakama Binder
      </PText>
    </View>
  );
  const invite = (
    <Link href="/auth/sign-up" asChild>
      <PressableArea
        accessibilityRole="link"
        boxStyle={[
          tile(poster.green),
          styles.between,
          compact ? [styles.fullTile, { height: 160 }] : { flex: 3, height: 320 },
          web({ cursor: 'pointer' }),
        ]}
        activeStyle={{ backgroundColor: '#1FCB4C' }}
      >
        <PText face="black" size={size.title} leading={1.05} track={-0.02} color={poster.ink}>
          {t('landing.ctaPrimary')}
        </PText>
        <View style={styles.arrow}>
          <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
            <Path d="M8 48 L48 8 M18 8 H48 V38" stroke={poster.ink} strokeWidth={4} strokeLinecap="square" />
          </Svg>
        </View>
      </PressableArea>
    </Link>
  );

  return (
    <View style={{ backgroundColor: poster.bone, padding: phone ? 8 : 12, gap }} role="contentinfo">
      {compact ? (
        <>
          {wordmark}
          {invite}
          <View style={[styles.row, { gap }]}>
            {nav}
            {updated}
          </View>
          {numbers}
          {statement}
        </>
      ) : (
        <>
          <View style={[styles.row, { gap, minHeight: 220 }]}>
            {statement}
            {nav}
            {updated}
            {numbers}
          </View>
          <View style={[styles.row, { gap }]}>
            {wordmark}
            {invite}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 12,
  },
  sentencePhone: { flexDirection: 'column', alignItems: 'stretch' },
  blankPhone: { alignSelf: 'stretch', marginVertical: 10 },
  lastLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row' },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },
  fullTile: { width: '100%' },
  halfTile: { flex: 1 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  arrow: { alignSelf: 'flex-end' },
});
