import i18n from '@/i18n';

import { errorMessage } from './validation';

/**
 * In-app dialogs and the undo bar, shown by <OverlayHost /> (components/ui/overlays.tsx, mounted once
 * in the root layout). Callers stay imperative: `await confirmAction(...)`, `notifyError(e)`,
 * `showToast(...)` — no browser pop-ups, the same look on web and native.
 */
export interface DialogRequest {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  /** Destructive confirmations get a red-pen button. */
  destructive: boolean;
  /** Absent for plain notices (one button). */
  cancelLabel?: string;
  resolve: (ok: boolean) => void;
}

export interface ToastRequest {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

type Listener = () => void;
let nextId = 1;
let dialogs: DialogRequest[] = [];
let toast: ToastRequest | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const overlayStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  dialog: () => dialogs[0] ?? null,
  toast: () => toast,
  settle(id: number, ok: boolean) {
    const found = dialogs.find((d) => d.id === id);
    dialogs = dialogs.filter((d) => d.id !== id);
    found?.resolve(ok);
    emit();
  },
  dismissToast(id: number) {
    if (toast?.id !== id) return;
    toast = null;
    emit();
  },
};

function openDialog(request: Omit<DialogRequest, 'id' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    dialogs = [...dialogs, { ...request, id: nextId++, resolve }];
    emit();
  });
}

/** An error, in plain words, with a single OK. */
export function notifyError(error: unknown) {
  void openDialog({ title: i18n.t('common.error'), message: errorMessage(error), confirmLabel: i18n.t('common.ok'), destructive: false });
}

/** Yes/no confirmation. Resolves true only when the user confirms. */
export function confirmAction(title: string, message: string, confirmLabel: string, destructive = true): Promise<boolean> {
  return openDialog({ title, message, confirmLabel, destructive, cancelLabel: i18n.t('common.cancel') });
}

/** A short message at the bottom of the screen, optionally with one action (e.g. Undo). Replaces any current one. */
export function showToast(message: string, action?: { label: string; onPress: () => void }, durationMs = 5000) {
  if (toastTimer) clearTimeout(toastTimer);
  const id = nextId++;
  toast = { id, message, actionLabel: action?.label, onAction: action?.onPress };
  emit();
  toastTimer = setTimeout(() => overlayStore.dismissToast(id), durationMs);
}
