/**
 * Internationalization Types
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

// Re-export all i18n types from @trokky/types
export type {
  SupportedLocale,
  TranslationNamespace,
  I18nConfig,
  DetectionOrder,
  LanguagePreference
} from '../types/index.js'

export {
  DEFAULT_NAMESPACE,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES
} from '../types/index.js'
