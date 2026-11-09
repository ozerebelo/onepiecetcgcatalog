import { CATEGORIES, COLORS, RARITIES, rarityShort } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CardFilters } from '@/components/card-filters';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { ColorMark, RarityTag } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { collectionKeys } from '@/hooks/use-collection';
import { fetchOwnedSets, type ArtFilter, type PlaysetFilter } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { titleCase } from '@/lib/format';
import { useAuth } from '@/providers/auth';
import { fonts, radius, spacing, tabular, usePalette } from '@/theme';

const PLAYABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'Don');
const COSTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const PLAYSETS: readonly PlaysetFilter[] = ['full', 'incomplete', 'extra'];
const ARTS: readonly ArtFilter[] = ['base', 'alt'];
const SETS_SHOWN = 8;

/** The sets you own cards from in the app's card language, newest first, with owned printings. */
export function useOwnedSets() {
  const { user } = useAuth();
  const [language] = useCardLanguage();
  return useQuery({
    queryKey: [...collectionKeys.all(user?.id ?? 'anon'), 'owned-sets', language],
    queryFn: () => fetchOwnedSets(language),
    enabled: Boolean(user),
  });
}

/**
 * Every way to narrow a collection, as one printed index: playset status, art, set,
 * colour, type, cost, rarity, sort. A sidebar beside the grid on wide screens, inline on phones.
 */
export function CollectionFilterPanel<S extends string>({
  filters: f,
  sortOptions,
  sortLabel,
}: {
  filters: CardFilters<S>;
  sortOptions: readonly S[];
  sortLabel: (sort: S) => string;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const sets = useOwnedSets();
  const [allSets, setAllSets] = useState(false);
  const setList = sets.data ?? [];
  // Selected sets stay visible even when the list is folded.
  const shownSets = allSets ? setList : setList.filter((s, i) => i < SETS_SHOWN || f.setCodes.includes(s.code));

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text variant="heading" style={styles.flex}>
          {t('collection.filterPanel.title')}
        </Text>
        {f.activeFilterCount > 0 ? (
          <Pressable onPress={f.clearFilters} accessibilityRole="button" hitSlop={8} style={styles.clear}>
            <Text variant="caption" weight="semibold" style={styles.underline}>
              {t('collection.filterPanel.clear', { count: f.activeFilterCount })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Section label={t('collection.filterPanel.playset')}>
        {PLAYSETS.map((p) => (
          <Chip
            key={p}
            label={t(`collection.filterPanel.playsets.${p}`)}
            selected={f.playset === p}
            onPress={() => f.togglePlayset(p)}
          />
        ))}
      </Section>

      <Section label={t('collection.filterPanel.art')}>
        {ARTS.map((a) => (
          <Chip key={a} label={t(`collection.filterPanel.arts.${a}`)} selected={f.art === a} onPress={() => f.toggleArt(a)} />
        ))}
      </Section>


      {setList.length > 0 ? (
        <Section label={t('collection.filterPanel.sets')} column>
          {shownSets.map((s) => {
            const selected = f.setCodes.includes(s.code);
            return (
              <Pressable
                key={s.code}
                onPress={() => f.toggleSet(s.code)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${s.code} ${titleCase(s.name)}, ${t('collection.filterPanel.ownedPrintings', { count: s.owned })}`}
                style={({ hovered }) => [styles.setRow, hovered && { backgroundColor: palette.surfaceAlt }]}>
                <View
                  style={[
                    styles.box,
                    {
                      borderColor: selected ? palette.text : palette.slot,
                      backgroundColor: selected ? palette.highlight : 'transparent',
                    },
                  ]}>
                  {selected ? <Icon name="check" size={12} color={palette.onHighlight} /> : null}
                </View>
                <Text variant="mono" style={styles.setCode}>
                  {s.code}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
                  {titleCase(s.name)}
                </Text>
                <Text variant="caption" tone="muted" style={tabular}>
                  {s.owned}
                </Text>
              </Pressable>
            );
          })}
          {setList.length > SETS_SHOWN ? (
            <Pressable onPress={() => setAllSets((v) => !v)} accessibilityRole="button" hitSlop={6} style={styles.more}>
              <Text variant="caption" weight="semibold" style={styles.underline}>
                {allSets ? t('collection.filterPanel.fewerSets') : t('collection.filterPanel.allSets', { count: setList.length })}
              </Text>
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      <Section label={t('search.color')}>
        {COLORS.map((color) => (
          <Chip
            key={color}
            label={t(`colors.${color}`)}
            leading={<ColorMark colors={[color]} size={11} />}
            selected={f.colors.includes(color)}
            onPress={() => f.toggleColor(color)}
          />
        ))}
      </Section>

      <Section label={t('search.category')}>
        {PLAYABLE_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={t(`categories.${category}`)}
            selected={f.categories.includes(category)}
            onPress={() => f.toggleCategory(category)}
          />
        ))}
      </Section>

      <Section label={t('search.cost')}>
        {COSTS.map((value) => {
          const selected = f.cost === value;
          return (
            // Cost as the card prints it: a number in a circle.
            <Pressable
              key={value}
              onPress={() => f.toggleCost(value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${t('card.cost')} ${value}`}
              hitSlop={3}
              style={({ hovered }) => [
                styles.cost,
                {
                  borderColor: selected ? palette.text : palette.borderStrong,
                  backgroundColor: selected ? palette.highlight : hovered ? palette.surfaceAlt : 'transparent',
                },
              ]}>
              <Text style={[styles.costText, { color: selected ? palette.onHighlight : palette.text }]}>{value}</Text>
            </Pressable>
          );
        })}
      </Section>

      <Section label={t('search.rarity')}>
        {RARITIES.map((rarity) => (
          <Chip
            key={rarity}
            label={rarityShort(rarity)}
            accessibilityLabel={t(`rarities.${rarity}`)}
            selected={f.rarities.includes(rarity)}
            onPress={() => f.toggleRarity(rarity)}
          />
        ))}
      </Section>

      <Section label={t('search.sort')}>
        {sortOptions.map((s) => (
          <Chip key={s} label={sortLabel(s)} selected={f.sort === s} onPress={() => f.setSort(s)} />
        ))}
      </Section>
    </View>
  );
}

function Section({ label, children, column = false }: { label: string; children: ReactNode; column?: boolean }) {
  const palette = usePalette();
  return (
    <View style={[styles.section, { borderTopColor: palette.border }]}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View style={column ? styles.column : styles.chips}>{children}</View>
    </View>
  );
}

/** What the grid is narrowed by, as removable tokens above it. */
export function ActiveFilters<S extends string>({ filters: f }: { filters: CardFilters<S> }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const tokens: { key: string; label: ReactNode; text: string; onRemove: () => void }[] = [
    ...(f.playset
      ? [
          {
            key: 'playset',
            text: t(`collection.filterPanel.playsets.${f.playset}`),
            label: null,
            onRemove: () => f.togglePlayset(f.playset!),
          },
        ]
      : []),
    ...(f.art
      ? [{ key: 'art', text: t(`collection.filterPanel.arts.${f.art}`), label: null, onRemove: () => f.toggleArt(f.art!) }]
      : []),
    ...f.setCodes.map((code) => ({ key: `set-${code}`, text: code, label: null, onRemove: () => f.toggleSet(code) })),
    ...f.colors.map((c) => ({
      key: `color-${c}`,
      text: t(`colors.${c}`),
      label: <ColorMark colors={[c]} size={9} />,
      onRemove: () => f.toggleColor(c),
    })),
    ...f.categories.map((c) => ({
      key: `cat-${c}`,
      text: t(`categories.${c}`),
      label: null,
      onRemove: () => f.toggleCategory(c),
    })),
    ...(f.cost != null
      ? [{ key: 'cost', text: `${t('card.cost')} ${f.cost}`, label: null, onRemove: () => f.toggleCost(f.cost!) }]
      : []),
    ...f.rarities.map((r) => ({
      key: `rar-${r}`,
      text: t(`rarities.${r}`),
      label: <RarityTag code={rarityShort(r)} />,
      onRemove: () => f.toggleRarity(r),
    })),
  ];
  if (tokens.length === 0) return null;
  return (
    <View style={styles.tokens}>
      {tokens.map((token) => (
        <Pressable
          key={token.key}
          onPress={token.onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('collection.filterPanel.remove', { filter: token.text })}
          style={({ hovered }) => [
            styles.token,
            { borderColor: palette.text, backgroundColor: hovered ? palette.surfaceAlt : palette.surface },
          ]}>
          {token.label}
          <Text variant="caption" weight="semibold">
            {token.text}
          </Text>
          <Icon name="x" size={13} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  flex: { flex: 1, minWidth: 0 },
  clear: { paddingVertical: spacing.xs },
  underline: { textDecorationLine: 'underline' },
  section: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  column: { gap: 0 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  box: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  setCode: { width: 64 },
  more: { alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  cost: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  costText: { fontFamily: fonts.monoBold, fontSize: 13, lineHeight: 16 },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  token: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingLeft: spacing.sm,
    paddingRight: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
