import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import type { I18nConfig, SupportedLocale } from './types.js';
import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, SUPPORTED_LOCALES } from './types.js';

// Import locale files - using standard JSON imports
import enCommon from '../locales/en/common.json';
import enStudio from '../locales/en/studio.json';
import enFields from '../locales/en/fields.json';
import enAuth from '../locales/en/auth.json';
import enErrors from '../locales/en/errors.json';

import frCommon from '../locales/fr/common.json';
import frStudio from '../locales/fr/studio.json';
import frFields from '../locales/fr/fields.json';
import frAuth from '../locales/fr/auth.json';
import frErrors from '../locales/fr/errors.json';

/**
 * All translations bundled by locale and namespace
 */
export const resources = {
  en: {
    common: enCommon,
    studio: enStudio,
    fields: enFields,
    auth: enAuth,
    errors: enErrors,
  },
  fr: {
    common: frCommon,
    studio: frStudio,
    fields: frFields,
    auth: frAuth,
    errors: frErrors,
  },
} as const;

/**
 * Storage key for persisting language preference
 */
export const LANGUAGE_STORAGE_KEY = 'trokky_language';

/**
 * Check if a locale is supported
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Get the current language from storage or detect from browser
 */
export function getStoredLanguage(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && isValidLocale(stored)) {
    return stored;
  }
  return null;
}

/**
 * Store the language preference
 */
export function setStoredLanguage(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
}

/**
 * Initialize i18next with Trokky configuration
 */
export function initI18n(config: I18nConfig = {}): typeof i18n {
  const {
    defaultLocale = DEFAULT_LOCALE,
    fallbackLocale = DEFAULT_LOCALE,
    detectBrowserLanguage = true,
    debug = false,
  } = config;

  // Only initialize once
  if (i18n.isInitialized) {
    return i18n;
  }

  const i18nInstance = i18n.createInstance();

  // Add language detector if browser detection is enabled
  if (detectBrowserLanguage && typeof window !== 'undefined') {
    i18nInstance.use(LanguageDetector);
  }

  i18nInstance.use(initReactI18next).init({
    resources,
    lng: getStoredLanguage() || defaultLocale,
    fallbackLng: fallbackLocale,
    defaultNS: DEFAULT_NAMESPACE,
    ns: ['common', 'studio', 'fields', 'auth', 'errors'],

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: detectBrowserLanguage ? {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    } : undefined,

    debug,

    // Missing key handling
    saveMissing: debug,
    missingKeyHandler: debug
      ? (lngs, ns, key) => {
          console.warn(`[i18n] Missing translation: ${ns}:${key} for ${lngs.join(', ')}`);
        }
      : undefined,
  });

  return i18nInstance;
}

/**
 * Get the default i18n instance (for use outside React)
 */
export function getI18n(): typeof i18n {
  if (!i18n.isInitialized) {
    initI18n();
  }
  return i18n;
}

export { i18n };
