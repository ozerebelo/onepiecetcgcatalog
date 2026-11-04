import { Platform } from 'react-native';

/**
 * Card images are loaded straight from the official card list. Sending no
 * Referer keeps image requests from depending on hotlink rules keyed to our
 * domain. Runs once on web; no-op on native (native requests send no Referer).
 */
export function setupWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.querySelector('meta[name="referrer"]')) {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
  }
}
