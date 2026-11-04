import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { radius, spacing, usePalette } from '@/theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
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
  const palette = usePalette();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: palette.dangerSoft }]}>
        <Icon name="alert-triangle" size={22} color={palette.danger} />
      </View>
      <Text variant="subheading">{t('common.error')}</Text>
      <Text variant="caption" tone="secondary" style={styles.message}>
        {message}
      </Text>
      {onRetry ? <Button title={t('common.retry')} variant="secondary" icon="refresh-cw" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({
  message,
  title,
  icon = 'inbox',
  action,
}: {
  message: string;
  title?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  const palette = usePalette();
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: palette.surfaceAlt }]}>
        <Icon name={icon} size={22} color={palette.textSecondary} />
      </View>
      {title ? <Text variant="subheading">{title}</Text> : null}
      <Text tone="secondary" style={styles.message}>
        {message}
      </Text>
      {action ? <Button title={action.label} variant="outline" size="sm" onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, minHeight: 220 },
  iconWrap: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center', maxWidth: 440 },
});
