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
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}

/** Page container: theme background, safe areas, and a centered max-width column on wide screens. */
export function Screen({ children, scroll = false, narrow = false, edges = ['top'], contentStyle }: ScreenProps) {
  const palette = usePalette();
  const column = [styles.column, narrow && styles.narrow, contentStyle];

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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg },
  narrow: { maxWidth: 440, paddingTop: spacing.xl, gap: spacing.lg },
});
