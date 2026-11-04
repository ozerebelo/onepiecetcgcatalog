import { Epilogue_400Regular } from '@expo-google-fonts/epilogue/400Regular';
import { Epilogue_500Medium } from '@expo-google-fonts/epilogue/500Medium';
import { Epilogue_600SemiBold } from '@expo-google-fonts/epilogue/600SemiBold';
import { Epilogue_700Bold } from '@expo-google-fonts/epilogue/700Bold';
import { Epilogue_900Black } from '@expo-google-fonts/epilogue/900Black';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import { CSS_FONT_WEIGHTS, WEB_FONT_FAMILY, type FontWeight } from '@/theme';

const WEB_FONT_FILES: Record<FontWeight, number> = {
  regular: Epilogue_400Regular,
  medium: Epilogue_500Medium,
  semibold: Epilogue_600SemiBold,
  bold: Epilogue_700Bold,
  black: Epilogue_900Black,
};

/**
 * Web-only setup, run once at startup (no-op on native):
 *  - no Referer on requests, so images never depend on hotlink rules keyed to our domain;
 *  - the Epilogue files registered as ONE font family with real weights. Native platforms load one
 *    family per weight through expo-font instead (see app/_layout.tsx and theme `fonts`).
 *    Browsers only download the weights a page actually uses.
 */
export function setupWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.querySelector('meta[name="referrer"]')) {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
  }
  if (!document.getElementById('app-fonts')) {
    const style = document.createElement('style');
    style.id = 'app-fonts';
    style.textContent = (Object.keys(WEB_FONT_FILES) as FontWeight[])
      .map(
        (weight) =>
          `@font-face{font-family:"${WEB_FONT_FAMILY}";font-style:normal;font-weight:${CSS_FONT_WEIGHTS[weight]};` +
          `font-display:swap;src:url("${Asset.fromModule(WEB_FONT_FILES[weight]).uri}") format("truetype");}`,
      )
      .join('\n');
    document.head.appendChild(style);
  }
}

/** Resolves once the weights used on first paint are ready (or after a short timeout). */
export async function webFontsReady(timeoutMs = 2500): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.fonts) return;
  const loads = (['regular', 'medium', 'semibold', 'bold', 'black'] as FontWeight[]).map((w) =>
    document.fonts.load(`${CSS_FONT_WEIGHTS[w]} 16px "${WEB_FONT_FAMILY}"`),
  );
  await Promise.race([Promise.allSettled(loads), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
