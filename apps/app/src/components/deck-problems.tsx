import type { DeckProblem } from '@binder/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing, usePalette } from '@/theme';

import { Icon } from './ui/icon';
import { Text } from './ui/text';

/** Tournament-rule warnings (1 leader, 50 cards, max 4 copies). Informational, never blocking. */
export function DeckProblems({ problems }: { problems: DeckProblem[] }) {
  const { t } = useTranslation();
  const palette = usePalette();
  if (problems.length === 0) {
    return (
      <View style={styles.row}>
        <Icon name="check-circle" size={16} color={palette.success} />
        <Text variant="caption" tone="success">
          {t('decks.problems.none')}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {problems.map((p, i) => (
        <View key={i} style={styles.row}>
          <Icon name="alert-triangle" size={16} color={palette.accent} />
          <Text variant="caption" tone="secondary" style={styles.flex}>
            {p.kind === 'noLeader'
              ? t('decks.problems.noLeader')
              : p.kind === 'multipleLeaders'
                ? t('decks.problems.multipleLeaders', { count: p.count })
                : p.kind === 'wrongSize'
                  ? t('decks.problems.wrongSize', { count: p.count })
                  : t('decks.problems.tooManyCopies', { card: p.cardId, count: p.count })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
