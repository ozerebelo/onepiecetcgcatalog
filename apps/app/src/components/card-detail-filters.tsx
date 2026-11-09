import { FILTER_KEYWORDS, keywordKind } from '@binder/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { CardFilters } from '@/components/card-filters';
import { Chip } from '@/components/ui/chip';
import { KEYWORD_STYLES } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { fetchCardTypes } from '@/lib/api';
import { useCardLanguage } from '@/lib/card-language';
import { POWERS } from '@/lib/filter-values';
import { spacing } from '@/theme';

const ATTRIBUTES = ['Slash', 'Strike', 'Ranged', 'Special', 'Wisdom'] as const;
const COUNTERS = [0, 1000, 2000] as const;
const TYPES_SHOWN = 12;

export type FilterSection = ComponentType<{ label: string; children: ReactNode }>;

/**
 * The card-detail filters players use: type (trait), attribute, counter, power, keywords (+ has a
 * Trigger) and words in the effect text. Rendered inside either filter panel, which supplies its
 * own section layout.
 */
export function CardDetailFilters<S extends string>({ filters: f, Section }: { filters: CardFilters<S>; Section: FilterSection }) {
  const { t } = useTranslation();
  return (
    <>
      <Section label={t('search.type')}>
        <TypePicker filters={f} />
      </Section>
      <Section label={t('search.attribute')}>
        {ATTRIBUTES.map((a) => (
          <Chip key={a} label={t(`attributes.${a}`)} selected={f.attributes.includes(a)} onPress={() => f.toggleAttribute(a)} />
        ))}
      </Section>
      <Section label={t('search.counter')}>
        {COUNTERS.map((c) => (
          <Chip key={c} label={c === 0 ? t('search.noCounter') : `+${c}`} selected={f.counters.includes(c)} onPress={() => f.toggleCounter(c)} />
        ))}
      </Section>
      <Section label={t('search.power')}>
        {POWERS.map((p, i) => (
          <Chip
            key={p}
            label={i === POWERS.length - 1 ? t('search.powerOrMore', { power: p }) : String(p)}
            selected={f.power === p}
            onPress={() => f.togglePower(p)}
          />
        ))}
      </Section>
      <Section label={t('search.keywords')}>
        {FILTER_KEYWORDS.map((k) => (
          <Chip
            key={k}
            label={k}
            dotColor={KEYWORD_STYLES[keywordKind(k) ?? 'timing'].background}
            selected={f.keywords.includes(k)}
            onPress={() => f.toggleKeyword(k)}
          />
        ))}
        <Chip label={t('search.hasTrigger')} dotColor={KEYWORD_STYLES.trigger.background} selected={f.hasTrigger} onPress={f.toggleHasTrigger} />
      </Section>
      <Section label={t('search.effect')}>
        <View style={styles.field}>
          <TextField
            value={f.effect}
            onChangeText={f.setEffect}
            placeholder={t('search.effectPlaceholder')}
            accessibilityLabel={t('search.effect')}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </Section>
    </>
  );
}

/** Find a card type among ~200: the most common ones first, or the ones matching what you type. */
function TypePicker<S extends string>({ filters: f }: { filters: CardFilters<S> }) {
  const { t } = useTranslation();
  const [language] = useCardLanguage();
  const [find, setFind] = useState('');
  const types = useQuery({
    queryKey: ['card-types', language],
    queryFn: () => fetchCardTypes(language),
    staleTime: 60 * 60 * 1000,
  });
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return (types.data ?? [])
      .filter((x) => !f.types.includes(x.type) && (!q || x.type.toLowerCase().includes(q)))
      .slice(0, TYPES_SHOWN);
  }, [types.data, find, f.types]);

  return (
    <View style={styles.types}>
      <View style={styles.field}>
        <TextField
          value={find}
          onChangeText={setFind}
          placeholder={t('search.findType')}
          accessibilityLabel={t('search.findType')}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.chips}>
        {f.types.map((type) => (
          <Chip key={type} label={type} selected onPress={() => f.toggleType(type)} />
        ))}
        {shown.map((x) => (
          <Chip key={x.type} label={x.type} accessibilityLabel={`${x.type}, ${x.cards}`} onPress={() => f.toggleType(x.type)} />
        ))}
        {types.isSuccess && shown.length === 0 && f.types.length === 0 ? (
          <Text variant="caption" tone="secondary">
            {t('search.noTypes')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  types: { gap: spacing.sm, width: '100%' },
  field: { width: '100%', maxWidth: 360 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
