import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme';

/**
 * Brand mark: a ship's wheel in straw-hat yellow on a red tile.
 * Original artwork (not derived from any One Piece logo).
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  const spokes = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no">
      <Rect x="0" y="0" width="64" height="64" rx="16" fill="#ED4B44" />
      <G stroke="#F2C21A" strokeLinecap="round">
        {spokes.map((angle) => (
          <Line
            key={angle}
            x1="32"
            y1="32"
            x2={32 + 23 * Math.cos((angle * Math.PI) / 180)}
            y2={32 + 23 * Math.sin((angle * Math.PI) / 180)}
            strokeWidth="4"
          />
        ))}
        <Circle cx="32" cy="32" r="15" fill="none" strokeWidth="4.5" />
      </G>
      <Circle cx="32" cy="32" r="6" fill="#F2C21A" />
      <Circle cx="32" cy="32" r="2.5" fill="#ED4B44" />
    </Svg>
  );
}

export function Logo({ size = 30, color, showName = true }: { size?: number; color?: string; showName?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="Nakama Binder">
      <LogoMark size={size} />
      {showName ? (
        <Text style={[styles.name, { fontSize: size * 0.62, color }]} numberOfLines={1}>
          Nakama Binder
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { ...fonts.bold, letterSpacing: -0.4 },
});
