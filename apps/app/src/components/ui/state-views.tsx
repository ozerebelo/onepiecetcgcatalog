import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing, usePalette } from '@/theme';

import { Button } from './button';
import { type IconName } from './icon';
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
      <View style={[styles.sheet, { borderTopColor: palette.danger, borderBottomColor: palette.border }]}>
        <Text variant="subheading" tone="danger">
          {t('common.error')}
        </Text>
        <Text tone="secondary">{message}</Text>
        {onRetry ? <Button title={t('common.retry')} variant="outline" size="sm" icon="refresh-cw" onPress={onRetry} boxStyle={styles.action} /> : null}
      </View>
    </View>
  );
}

/** Nothing to list: a printed empty line, a sentence, and (ideally) the one thing to do next. */
export function EmptyView({
  message,
  title,
  action,
}: {
  message: string;
  title?: string;
  /** Kept for callers; empty states are text, not icons. */
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  const palette = usePalette();
  return (
    <View style={styles.center}>
      <View style={[styles.sheet, { borderTopColor: palette.rule, borderBottomColor: palette.border }]}>
        {title ? <Text variant="subheading">{title}</Text> : null}
        <Text tone="secondary">{message}</Text>
        {action ? <Button title={action.label} variant="outline" size="sm" onPress={action.onPress} boxStyle={styles.action} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, minHeight: 220 },
  sheet: { width: '100%', maxWidth: 520, gap: spacing.sm, paddingVertical: spacing.lg, borderTopWidth: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  action: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
