import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation, radius, spacing, usePalette } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Raised content container: the basic building block of every page. */
export function Panel({
  children,
  style,
  padded = true,
  raised = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  raised?: boolean;
}) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: palette.surface, borderColor: palette.border },
        raised && elevation(palette),
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );
}

/** Eyebrow + title + optional subtitle and trailing actions. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? (
          <Text variant="eyebrow" tone="primary">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.headerActions}>{actions}</View> : null}
    </View>
  );
}

/** Section title inside a page. */
export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="heading" style={styles.flex} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function StatTile({ label, value, icon, hint }: { label: string; value: string; icon?: IconName; hint?: string }) {
  const palette = usePalette();
  return (
    <Panel style={styles.stat}>
      <View style={styles.statTop}>
        <Text variant="label" tone="muted" style={styles.flex}>
          {label}
        </Text>
        {icon ? (
          <View style={[styles.statIcon, { backgroundColor: palette.primarySoft }]}>
            <Icon name={icon} size={15} color={palette.primary} />
          </View>
        ) : null}
      </View>
      <Text variant="title">{value}</Text>
      {hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </Panel>
  );
}

export function ProgressBar({ value, tone = 'primary', height = 8 }: { value: number; tone?: 'primary' | 'success' | 'accent'; height?: number }) {
  const palette = usePalette();
  const color = tone === 'success' ? palette.success : tone === 'accent' ? palette.accent : palette.primary;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { height, backgroundColor: palette.surfaceAlt }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'accent'; icon?: IconName }) {
  const palette = usePalette();
  const colors = {
    neutral: [palette.surfaceAlt, palette.textSecondary],
    primary: [palette.primarySoft, palette.primary],
    success: [palette.successSoft, palette.success],
    danger: [palette.dangerSoft, palette.danger],
    accent: [palette.accentSoft, palette.accent],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[0] }]}>
      {icon ? <Icon name={icon} size={12} color={colors[1]} /> : null}
      <Text variant="caption" weight="semibold" style={{ color: colors[1] }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.lg, paddingTop: spacing.xl },
  headerText: { flex: 1, minWidth: 240, gap: spacing.xs },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  stat: { flex: 1, minWidth: 150, gap: spacing.xs },
  statTop: { flexDirection: 'row', alignItems: 'center' },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: radius.pill },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
