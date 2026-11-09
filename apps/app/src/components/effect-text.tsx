import { parseEffectText, type EffectSegment } from '@binder/core';
import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { KEYWORD_STYLES, KeywordTag } from '@/components/ui/tcg';
import { Text } from '@/components/ui/text';
import { fonts, radius, spacing, usePalette } from '@/theme';

/** i18n id of a keyword's rules note ("On K.O." → "OnKO", "DON!! x1" → "donX"). */
export function ruleId(key: string): string {
  return key.replace(/[^A-Za-z]/g, '');
}

/** Opens the Cards search for one card type (trait), or for a card name. */
export function showType(type: string) {
  router.push({ pathname: '/cards', params: { type } });
}
export function showCardName(name: string) {
  router.push({ pathname: '/cards', params: { q: name } });
}

/**
 * A card's effect (or trigger) text the way the printed card shows it: keyword labels in their
 * colours ([On Play] blue, [Counter] red, [Trigger] yellow, [Blocker] orange…) — tap one for a short
 * rules note — card types as links to every card of that type, and card names as links to the card.
 */
export function EffectText({ text }: { text: string }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const segments = useMemo(() => parseEffectText(text), [text]);
  const [note, setNote] = useState<Extract<EffectSegment, { type: 'keyword' }> | null>(null);

  return (
    <View style={styles.wrap}>
      <Text selectable style={styles.text}>
        {segments.map((s, i) => {
          if (s.type === 'text') return <Fragment key={i}>{s.text}</Fragment>;
          if (s.type === 'keyword') {
            const style = KEYWORD_STYLES[s.kind];
            return (
              <Text
                key={i}
                onPress={() => setNote((current) => (current?.key === s.key ? null : s))}
                accessibilityRole="button"
                accessibilityHint={t('rules.hint')}
                style={[styles.keyword, { backgroundColor: style.background, color: style.color }]}>
                {` ${s.text} `}
              </Text>
            );
          }
          // Types and card names are links into the Cards search.
          return (
            <Text
              key={i}
              onPress={() => (s.type === 'trait' ? showType(s.text) : showCardName(s.text))}
              accessibilityRole="link"
              style={[styles.link, { color: palette.text, textDecorationColor: palette.borderStrong }]}>
              {s.type === 'trait' ? `{${s.text}}` : `[${s.text}]`}
            </Text>
          );
        })}
      </Text>
      {note ? (
        <View style={[styles.note, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]} accessibilityLiveRegion="polite">
          <KeywordTag kind={note.kind} label={note.text} />
          <Text variant="caption" style={styles.noteText}>
            {t(`rules.${ruleId(note.key)}`)}
          </Text>
          <Pressable onPress={() => setNote(null)} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Icon name="x" size={16} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  text: { lineHeight: 26 },
  keyword: { fontFamily: fonts.semibold, fontSize: 13, borderRadius: 3 },
  link: { textDecorationLine: 'underline' },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  noteText: { flex: 1 },
});
