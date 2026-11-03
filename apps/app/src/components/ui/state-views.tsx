import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing, usePalette } from '@/theme';

import { Button } from './button';
import { Text } from './text';

export function LoadingView({ label }: { label?: string }) {
  const palette = usePalette();
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <ActivityIndicator color={palette.primary} size="large" />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <View style={styles.center}>
      <Text variant="subheading">{t('common.error')}</Text>
      <Text variant="caption" tone="secondary" style={styles.message}>
        {message}
      </Text>
      {onRetry ? <Button title={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({ message, action }: { message: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.center}>
      <Text tone="secondary" style={styles.message}>
        {message}
      </Text>
      {action ? <Button title={action.label} variant="ghost" onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, minHeight: 200 },
  message: { textAlign: 'center', maxWidth: 420 },
});
