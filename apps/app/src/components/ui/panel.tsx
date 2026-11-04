import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, tabular, usePalette } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** A panel on the sheet: white fill, 1px edge, soft corners, no shadow. */
export function Panel({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

/** The page's title row: a noun h1, an optional one-line subtitle, and the page's actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text variant="title" accessibilityRole="header" aria-level={1}>
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
      <Text variant="heading" style={styles.flex} accessibilityRole="header" aria-level={2}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export interface Kpi {
  label: string;
  value: string;
  /** A short note under the value, e.g. "of 2,884". */
  hint?: string;
}

/** KPIs as one container split by 1px dividers (never a row of icon tiles). */
export function KpiStrip({ items }: { items: Kpi[] }) {
  const palette = usePalette();
  return (
    <View style={[styles.kpis, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={[styles.kpi, i > 0 && { borderLeftWidth: 1, borderLeftColor: palette.border }]}
          accessibilityLabel={`${item.label}: ${item.value}${item.hint ? `, ${item.hint}` : ''}`}>
          <Text variant="label" tone="secondary">
            {item.label}
          </Text>
          <Text variant="title" style={tabular}>
            {item.value}
          </Text>
          {item.hint ? (
            <Text variant="caption" tone="secondary">
              {item.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ value, tone = 'accent', height = 6 }: { value: number; tone?: 'accent' | 'neutral'; height?: number }) {
  const palette = usePalette();
  const color = tone === 'accent' ? palette.accent : palette.text;
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

/** A status pill: pale fill with a dark ink of the same hue. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'success' | 'danger'; icon?: IconName }) {
  const palette = usePalette();
  const [bg, fg] = {
    neutral: [palette.surfaceAlt, palette.textSecondary],
    success: [palette.successSoft, palette.successInk],
    danger: [palette.dangerSoft, palette.dangerInk],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text variant="figure" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, borderWidth: 1 },
  padded: { padding: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.sm },
  headerText: { flex: 1, minWidth: 220, gap: spacing.xs },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  kpi: { flexGrow: 1, flexBasis: 150, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, gap: 2 },
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: radius.pill },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
