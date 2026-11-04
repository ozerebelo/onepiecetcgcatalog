import type { SetKind, SetRow } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableArea } from '@/components/ui/pressable-area';
import { fetchSetPortraits } from '@/lib/api';
import { setDisplayName } from '@/lib/format';
import { poster, tabular } from '@/theme';

import { HEADER_HEIGHT } from './hero';
import { PButton, PHeading, PText, Reveal, web, type PosterLayout } from './kit';

type Group = 'booster' | 'extra' | 'starter' | 'other';
const GROUPS: Group[] = ['booster', 'extra', 'starter', 'other'];
const groupOf = (kind: SetKind): Group => (kind === 'booster' || kind === 'extra' || kind === 'starter' ? kind : 'other');
const MAX_ROWS = 8;
const BAND = ['#F7D457', '#F2C21A'];

/**
 * Every set, as a banded list: tabs for the kinds of product on the left, the sets of the chosen
 * kind as alternating bands on the right, each with three small portraits of its cards.
 */
export function SetList({ layout, sets }: { layout: PosterLayout; sets: SetRow[] }) {
  const { t } = useTranslation();
  const [group, setGroup] = useState<Group>('booster');
  const { phone, margin, size } = layout;
  const byGroup = (g: Group) => sets.filter((s) => groupOf(s.kind) === g);
  const visible = byGroup(group).slice(0, MAX_ROWS);
  const more = byGroup(group).length - visible.length;
  const portraits = useQuery({
    queryKey: ['set-portraits', visible.map((s) => s.id).join(',')],
    queryFn: () => fetchSetPortraits(visible.map((s) => s.id)),
    enabled: visible.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  const tabs = GROUPS.filter((g) => byGroup(g).length > 0).map((g) => {
    const active = g === group;
    return (
      <Pressable
        key={g}
        onPress={() => setGroup(g)}
        role="tab"
        aria-selected={active}
        style={({ hovered }) => [
          styles.tab,
          phone ? styles.tabPhone : styles.tabWide,
          {
            backgroundColor: active ? poster.ink : hovered ? '#E8B60E' : '#F7D457',
          },
          web({
            transitionProperty: 'background-color',
            transitionDuration: '160ms',
            cursor: 'pointer',
          }),
        ]}
      >
        <PText face="medium" size={size.small} color={active ? poster.yellow : poster.ink} leading={1.2}>
          {t(`landing.sets.groups.${g}`)}
        </PText>
        <PText size={size.caption} color={active ? poster.yellow : poster.ink} leading={1.2} style={tabular}>
          {t('landing.sets.count', { count: byGroup(g).length })}
        </PText>
      </Pressable>
    );
  });

  return (
    <View
      style={{
        backgroundColor: poster.yellow,
        paddingHorizontal: margin,
        paddingTop: phone ? 72 : HEADER_HEIGHT + 96,
        paddingBottom: phone ? 72 : 160,
      }}
    >
      <View style={[styles.headRow, phone && styles.headRowPhone]}>
        <Reveal style={{ flex: phone ? undefined : 1 }}>
          <PHeading level={2} size={size.head} color={poster.ink}>
            {t('landing.sets.title')}{' '}
            <PText face="black" size={size.head} color={poster.ink} leading={0.92} style={web({ whiteSpace: 'nowrap' })}>
              {t('landing.sets.titleCode')}
            </PText>
          </PHeading>
        </Reveal>
        <Reveal delay={80}>
          <Link href="/cards" asChild>
            <PButton
              label={t('landing.sets.browse')}
              bg={poster.ink}
              fg={poster.yellow}
              size={size.small}
              boxStyle={phone ? styles.fullButton : null}
            />
          </Link>
        </Reveal>
      </View>
      <Reveal delay={120}>
        <PText size={size.body} color={poster.ink} style={{ maxWidth: 620, marginTop: 20 }}>
          {t('landing.sets.body')}
        </PText>
      </Reveal>

      <View style={[styles.body, phone && styles.bodyPhone]}>
        {phone ? (
          <View role="tablist" style={styles.tabsPhone}>
            {tabs}
          </View>
        ) : (
          <View role="tablist" style={styles.tabsWide}>
            {tabs}
          </View>
        )}
        <View style={styles.bands} role="tabpanel">
          {visible.map((set, i) => (
            <Link key={set.id} href={{ pathname: '/set/[id]', params: { id: set.id } }} asChild>
              <PressableArea
                accessibilityRole="link"
                accessibilityLabel={`${set.code}, ${set.name}`}
                boxStyle={[
                  styles.band,
                  phone ? styles.bandPhone : styles.bandWide,
                  { backgroundColor: BAND[i % 2] },
                  web({
                    transitionProperty: 'transform',
                    transitionDuration: '160ms',
                    cursor: 'pointer',
                  }),
                ]}
                activeStyle={{ transform: [{ translateX: 6 }] }}
              >
                <PText face="black" size={size.lead} color={poster.ink} style={[tabular, phone ? null : styles.code]}>
                  {set.code}
                </PText>
                <View style={styles.flex}>
                  <PText face="medium" size={size.body} color={poster.ink} leading={1.25} numberOfLines={phone ? 2 : 1}>
                    {setDisplayName(set, t(`landing.sets.kind.${groupOf(set.kind)}`))}
                  </PText>
                  <PText size={size.caption} color={poster.ink} leading={1.3} style={tabular}>
                    {t('landing.sets.printings', { count: set.printing_count })}
                  </PText>
                </View>
                <View style={[styles.portraits, phone && styles.portraitsPhone]}>
                  {(portraits.data?.[set.id] ?? []).map((p, j) => (
                    <View key={p.id} style={[styles.portrait, { marginLeft: j ? -10 : 0, zIndex: 3 - j }]}>
                      <Image
                        source={{ uri: p.image_url ?? undefined }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        contentPosition={{ top: '18%', left: '50%' }}
                        accessibilityLabel={p.name}
                      />
                    </View>
                  ))}
                </View>
              </PressableArea>
            </Link>
          ))}
          <Link href="/cards" asChild>
            <PressableArea accessibilityRole="link" boxStyle={[styles.band, styles.more]}>
              <PText face="medium" size={size.small} color={poster.ink} style={styles.underline}>
                {more > 0 ? t('landing.sets.more', { count: more }) : t('landing.sets.all', { count: sets.length })}
              </PText>
            </PressableArea>
          </Link>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  headRowPhone: { flexDirection: 'column', alignItems: 'stretch' },
  fullButton: { alignSelf: 'stretch' },
  body: { flexDirection: 'row', gap: 40, marginTop: 56 },
  bodyPhone: { flexDirection: 'column', gap: 16, marginTop: 32 },
  tabsWide: { width: 170, gap: 6 },
  tabsPhone: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { justifyContent: 'center', paddingHorizontal: 14, gap: 2 },
  tabWide: { height: 64 },
  tabPhone: { height: 60, flexBasis: '48%', flexGrow: 1 },
  bands: { flex: 1, gap: 4 },
  band: { flexDirection: 'row', alignItems: 'center', borderRadius: 0 },
  bandWide: { height: 76, paddingHorizontal: 20, gap: 24 },
  bandPhone: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    flexWrap: 'wrap',
  },
  code: { width: '18%' },
  flex: { flex: 1, minWidth: 0 },
  portraits: { flexDirection: 'row' },
  portraitsPhone: {},
  portrait: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: poster.boneStep,
    borderWidth: 2,
    borderColor: poster.yellow,
  },
  more: { height: 64, paddingHorizontal: 20, backgroundColor: '#F7D457' },
  underline: { textDecorationLine: 'underline' },
});
