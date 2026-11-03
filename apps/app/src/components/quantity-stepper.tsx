import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, usePalette } from '@/theme';

import { Text } from './ui/text';

interface QuantityStepperProps {
  quantity: number;
  onChange: (delta: number) => void;
  /** Used in accessibility labels, e.g. "OP01-016". */
  label: string;
  size?: 'regular' | 'small';
}

/** [−] 3 [+] control for owned copies. */
export function QuantityStepper({ quantity, onChange, label, size = 'regular' }: QuantityStepperProps) {
  const { t } = useTranslation();
  const palette = usePalette();
  const dimension = size === 'small' ? 30 : 44;

  const button = (delta: number, symbol: string, a11y: string, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(delta)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { width: dimension, height: dimension, backgroundColor: palette.surfaceAlt, borderColor: palette.border },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
      ]}>
      <Text variant={size === 'small' ? 'subheading' : 'heading'}>{symbol}</Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {button(-1, '−', t('collection.removeOne', { card: label }), quantity <= 0)}
      <Text
        variant={size === 'small' ? 'subheading' : 'heading'}
        style={[styles.count, { minWidth: size === 'small' ? 28 : 40 }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('collection.ownedCount', { count: quantity })}>
        {quantity}
      </Text>
      {button(1, '+', t('collection.addOne', { card: label }), quantity >= 9999)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  button: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  count: { textAlign: 'center', fontVariant: ['tabular-nums'] },
});
