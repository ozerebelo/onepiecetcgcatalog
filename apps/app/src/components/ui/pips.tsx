import { StyleSheet, View } from 'react-native';

import { PLAYSET, fonts, usePalette } from '@/theme';

import { Text } from './text';

/**
 * Playset slots: four marks, one per copy a deck may hold. Owned copies are highlighted; copies
 * beyond a playset show as "+n". The signature mark of the app (cards, checklists, decks).
 */
export function Pips({ owned, need, size = 'md' }: { owned: number; need?: number; size?: 'sm' | 'md' }) {
  const palette = usePalette();
  const slots = Math.max(PLAYSET, need ?? 0);
  const extra = owned - slots;
  const w = size === 'sm' ? 5 : 6;
  const h = size === 'sm' ? 10 : 12;
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: slots }, (_, i) => {
        const filled = i < owned;
        // When a target is given (a deck slot), slots it needs but you don't own are drawn in red pen.
        const missing = need !== undefined && !filled && i < need;
        return (
          <View
            key={i}
            style={[
              styles.pip,
              { width: w, height: h },
              filled
                ? { backgroundColor: palette.highlight, borderColor: palette.text }
                : { borderColor: missing ? palette.danger : palette.slot },
              need !== undefined && i >= need && !filled && styles.unused,
            ]}
          />
        );
      })}
      {extra > 0 ? <Text style={[styles.extra, { color: palette.textSecondary }]}>+{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pip: { borderWidth: 1, borderRadius: 1 },
  unused: { opacity: 0.35 },
  extra: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 14, marginLeft: 3 },
});
