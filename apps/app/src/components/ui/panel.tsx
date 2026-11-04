import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation, radius, spacing, tabular, usePalette } from '@/theme';

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

/** Page title, an optional one-line subtitle, and the page's actions on the right. */
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

export interface Stat {
  label: string;
  value: string;
  /** A short note under the label, e.g. "of 2,884 in the game". */
  hint?: string;
}

/** Related numbers in one panel, split by thin dividers (wraps to two columns on phones). */
export function StatGroup({ stats }: { stats: Stat[] }) {
  const palette = usePalette();
  return (
    <Panel padded={false} style={styles.statGroup}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border }]}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}${stat.hint ? `, ${stat.hint}` : ''}`}>
          <Text variant="title" style={[styles.statValue, tabular]}>
            {stat.value}
          </Text>
          <Text variant="caption" tone="secondary">
            {stat.label}
          </Text>
          {stat.hint ? (
            <Text variant="caption" tone="muted">
              {stat.hint}
            </Text>
          ) : null}
        </View>
      ))}
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
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xs },
  headerText: { flex: 1, minWidth: 240, gap: 6 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  statGroup: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  stat: { flexGrow: 1, flexBasis: 140, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, gap: 2 },
  statValue: { fontSize: 28, lineHeight: 34 },
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: radius.pill },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
