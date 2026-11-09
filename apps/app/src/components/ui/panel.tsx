import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, tabular, usePalette } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** A printed sheet: flat surface with a hairline edge (no shadow). */
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
        !raised && { backgroundColor: 'transparent' },
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );
}

/** Page title, an optional one-line subtitle, and the page's actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.header, { borderBottomColor: palette.rule }]}>
      <View style={styles.headerText}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.headerActions}>{actions}</View> : null}
    </View>
  );
}

/** Section title inside a page, under a printed rule. */
export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.sectionTitle, { borderTopColor: palette.rule }]}>
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

/** Related numbers in one ruled row, split by hairlines (wraps to two columns on phones). */
export function StatGroup({ stats }: { stats: Stat[] }) {
  const palette = usePalette();
  return (
    <View style={[styles.statGroup, { borderColor: palette.border }]}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border }]}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}${stat.hint ? `, ${stat.hint}` : ''}`}>
          <Text variant="eyebrow" tone="secondary">
            {stat.label}
          </Text>
          <Text variant="title" style={[styles.statValue, tabular]}>
            {stat.value}
          </Text>
          {stat.hint ? (
            <Text variant="caption" tone="muted">
              {stat.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Completion, marked in highlighter on a printed track. */
/** `tone` is accepted for older callers but ignored: progress is always marked in highlighter. */
export function ProgressBar({ value, height = 6 }: { value: number; tone?: 'primary' | 'success' | 'accent'; height?: number }) {
  const palette = usePalette();
  const color = palette.highlight;
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

/** A small stamped label. `accent` is highlighted; the others are outlined in their colour. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'accent'; icon?: IconName }) {
  const palette = usePalette();
  const [bg, fg, border] = {
    neutral: ['transparent', palette.textSecondary, palette.borderStrong],
    primary: ['transparent', palette.text, palette.text],
    success: ['transparent', palette.success, palette.success],
    danger: ['transparent', palette.danger, palette.danger],
    accent: [palette.highlight, palette.onHighlight, palette.highlight],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text variant="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: spacing.lg, gap: spacing.md },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 2,
  },
  headerText: { flex: 1, minWidth: 240, gap: 6 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: 2, paddingTop: spacing.md },
  flex: { flex: 1 },
  statGroup: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { flexGrow: 1, flexBasis: 140, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: 4 },
  statValue: { fontSize: 32, lineHeight: 36 },
  track: { borderRadius: 1, overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
