import { useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { overlayStore } from '@/lib/notify';
import { WIDE_BREAKPOINT, elevation, fonts, radius, spacing, usePalette } from '@/theme';

import { Button } from './button';
import { Text } from './text';

/** Renders the in-app dialog and the undo bar requested through lib/notify. Mount once, at the root. */
export function OverlayHost() {
  const dialog = useSyncExternalStore(overlayStore.subscribe, overlayStore.dialog, overlayStore.dialog);
  const toast = useSyncExternalStore(overlayStore.subscribe, overlayStore.toast, overlayStore.toast);
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Phones on the web have the bottom tab bar (64px) under the content.
  const bottom = (Platform.OS === 'web' && width < WIDE_BREAKPOINT ? 64 : 0) + insets.bottom + spacing.lg;

  return (
    <>
      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        onRequestClose={() => dialog && overlayStore.settle(dialog.id, false)}>
        <View style={[styles.backdrop, { backgroundColor: palette.overlay }]}>
          {dialog ? (
            <View
              accessibilityRole="alert"
              accessibilityLabel={dialog.title}
              style={[styles.dialog, { backgroundColor: palette.surface, borderColor: palette.rule }, elevation(palette, true)]}>
              <Text variant="heading" style={[styles.title, { borderBottomColor: palette.rule }]}>
                {dialog.title}
              </Text>
              <Text tone="secondary">{dialog.message}</Text>
              <View style={styles.buttons}>
                {dialog.cancelLabel ? (
                  <Button title={dialog.cancelLabel} variant="ghost" onPress={() => overlayStore.settle(dialog.id, false)} />
                ) : null}
                <Button
                  title={dialog.confirmLabel}
                  variant={dialog.destructive ? 'danger' : 'primary'}
                  onPress={() => overlayStore.settle(dialog.id, true)}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {toast ? (
        <View pointerEvents="box-none" style={[styles.toastWrap, { bottom }]}>
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.toast, { backgroundColor: palette.primary }, elevation(palette, true)]}>
            <Text style={[styles.toastText, { color: palette.onPrimary }]} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.actionLabel ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.onAction?.();
                  overlayStore.dismissToast(toast.id);
                }}
                hitSlop={8}
                style={({ hovered }) => [styles.toastAction, hovered && { opacity: 0.8 }]}>
                <Text style={[styles.toastActionText, { color: palette.onPrimary }]}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 440, borderWidth: 1, borderRadius: radius.md, padding: spacing.xl, gap: spacing.md },
  title: { borderBottomWidth: 2, paddingBottom: spacing.sm },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  toastWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 50 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 520,
    minHeight: 48,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
  },
  toastText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, paddingVertical: spacing.sm },
  toastAction: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  toastActionText: { fontFamily: fonts.semibold, fontSize: 14, textDecorationLine: 'underline' },
});
