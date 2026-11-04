import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, spacing, usePalette } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (forms, detail pages). Lists should pass false and scroll themselves. */
  scroll?: boolean;
  /** Narrow centered column for forms. */
  narrow?: boolean;
  /** Full-bleed content (landing page sections handle their own width). */
  bleed?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}

/** Page container: theme background, safe areas, and a centered max-width column on wide screens. */
export function Screen({ children, scroll = false, narrow = false, bleed = false, edges = ['top'], contentStyle }: ScreenProps) {
  const palette = usePalette();
  const column = bleed ? [styles.bleed, contentStyle] : [styles.column, narrow && styles.narrow, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={column}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.flex, column]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Content style for a full-width list (Screen `bleed`): the list itself spans the window, so its
 * scrollbar sits at the window edge, while its content stays in the centered max-width column.
 */
export const listColumn: ViewStyle = {
  width: '100%',
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: 'center',
  paddingHorizontal: spacing.lg,
  paddingBottom: spacing.xxxl,
  flexGrow: 1,
};

/** Centered max-width column for use inside full-bleed pages. */
export function Container({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.lg },
  bleed: { width: '100%' },
  narrow: { maxWidth: 460, paddingTop: spacing.xl },
});
