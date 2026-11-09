import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { fonts, usePalette } from '@/theme';

/** The product name, for labels and titles (the wordmark itself is lowercase). */
export const APP_NAME = 'Yonko';

/**
 * Brand mark: four card slots — a playset, and the Four Emperors (yonko) the app is named after —
 * with the fourth just marked in highlighter.
 * Drawn in ink, so it follows the colour scheme.
 */
export function LogoMark({ size = 28, ink, mark = '#FFE14A' }: { size?: number; ink?: string; mark?: string }) {
  const palette = usePalette();
  const color = ink ?? palette.text;
  // 4 slots of 9 × 26 in a 48-unit box, 3-unit gaps, centred.
  const slots = [0, 1, 2, 3].map((i) => 6 + i * 9.5);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      {slots.map((x, i) =>
        i < 3 ? (
          <Rect key={i} x={x} y="9" width="7" height="30" rx="1.5" fill={color} />
        ) : (
          <Rect key={i} x={x} y="9" width="7" height="30" rx="1.5" fill={mark} stroke={color} strokeWidth="1.6" />
        ),
      )}
    </Svg>
  );
}

export function Logo({ size = 28, color, showName = true }: { size?: number; color?: string; showName?: boolean }) {
  const palette = usePalette();
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={APP_NAME}>
      <LogoMark size={size} ink={color} />
      {showName ? (
        <Text style={[styles.name, { fontSize: size * 0.82, lineHeight: size, color: color ?? palette.text }]} numberOfLines={1}>
          yonko
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.display, letterSpacing: -0.3 },
});
