import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@binder/core';
import { useSyncExternalStore } from 'react';

/**
 * The card language the whole app shows: English or Japanese, never both mixed. Search results,
 * card pages, the collection (and its playsets), decks and quick adds all follow it. Remembered on
 * the device; English until the user switches.
 */
const KEY = 'yonko.cardLanguage';
let current: Language = 'en';
const listeners = new Set<() => void>();

function set(language: Language) {
  if (language === current) return;
  current = language;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, language).catch(() => {});
}

// Restore the saved choice (storage is unavailable while rendering on the server).
if (typeof window !== 'undefined' || typeof navigator !== 'undefined') {
  AsyncStorage.getItem(KEY)
    .then((saved) => {
      if (saved === 'en' || saved === 'ja') set(saved);
    })
    .catch(() => {});
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => current;
const serverSnapshot = (): Language => 'en';

export function useCardLanguage(): [Language, (language: Language) => void] {
  return [useSyncExternalStore(subscribe, snapshot, serverSnapshot), set];
}
