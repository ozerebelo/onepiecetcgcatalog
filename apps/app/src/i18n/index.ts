import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

/**
 * All user-facing strings live in locales/<lang>.json. To add a language:
 * copy en.json, translate it, and register it in `resources` below.
 */
export const resources = {
  en: { translation: en },
} as const;

export const supportedLanguages = Object.keys(resources);

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources,
  lng: supportedLanguages.includes(deviceLanguage) ? deviceLanguage : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;
