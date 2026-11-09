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
  if (!document.getElementById('playset-browser-surfaces')) {
    const style = document.createElement('style');
    style.id = 'playset-browser-surfaces';
    style.textContent = BROWSER_SURFACES;
    document.head.appendChild(style);
  }
}

/**
 * The parts the browser draws (selection, caret, focus ring, scrollbars), themed from the palette in
 * src/theme (paper / carbon). Selecting text marks it in highlighter, like the rest of the app.
 */
const BROWSER_SURFACES = `
::selection { background: #FFE14A; color: #141414; }
html { scrollbar-color: #BDBDB4 transparent; }
* { caret-color: #141414; }
:focus-visible { outline: 2px solid #141414; outline-offset: 2px; border-radius: 3px; }
@media (prefers-color-scheme: dark) {
  html { scrollbar-color: #4A4A45 transparent; }
  * { caret-color: #F1F1EA; }
  :focus-visible { outline-color: #F1F1EA; }
}
`;
