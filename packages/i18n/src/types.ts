/**
 * Supported locales in Trokky
 */
export type SupportedLocale = 'en' | 'fr';

/**
 * Namespace definitions for translations
 */
export type TranslationNamespace =
  | 'common'
  | 'studio'
  | 'fields'
  | 'auth'
  | 'errors';

/**
 * Default namespace used when none is specified
 */
export const DEFAULT_NAMESPACE: TranslationNamespace = 'common';

/**
 * Default locale when user preference is not set
 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * All supported locales
 */
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr'];

/**
 * Locale display names for language selector
 */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  fr: 'Francais',
};

/**
 * i18n configuration options
 */
export interface I18nConfig {
  /** Default locale to use */
  defaultLocale?: SupportedLocale;
  /** Supported locales */
  supportedLocales?: SupportedLocale[];
  /** Fallback locale when translation is missing */
  fallbackLocale?: SupportedLocale;
  /** Whether to detect browser language */
  detectBrowserLanguage?: boolean;
  /** Debug mode - logs missing translations */
  debug?: boolean;
}

/**
 * Language detection order
 */
export type DetectionOrder =
  | 'userPreference'
  | 'localStorage'
  | 'navigator'
  | 'htmlTag';

/**
 * Language preference stored in user profile
 */
export interface LanguagePreference {
  locale: SupportedLocale;
  updatedAt?: string;
}
