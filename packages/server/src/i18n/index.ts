/**
 * @trokky/i18n - Internationalization support for Trokky CMS
 *
 * @example
 * ```tsx
 * import { TrokkyI18nProvider, useT, useLocale } from '@trokky/i18n';
 *
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <TrokkyI18nProvider>
 *       <MyComponent />
 *     </TrokkyI18nProvider>
 *   );
 * }
 *
 * // Use translations in components
 * function MyComponent() {
 *   const { t } = useT('studio');
 *   const { locale, setLocale, locales } = useLocale();
 *
 *   return (
 *     <div>
 *       <h1>{t('nav.content')}</h1>
 *       <select value={locale} onChange={(e) => setLocale(e.target.value)}>
 *         {locales.map((l) => <option key={l} value={l}>{l}</option>)}
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */

// Provider
export { TrokkyI18nProvider } from './provider.js';
export type { TrokkyI18nProviderProps, I18nContextValue } from './provider.js';

// Hooks
export { useT, useLocale, useErrorTranslation, useFieldTranslation } from './hooks.js';

// Configuration
export {
  initI18n,
  getI18n,
  i18n,
  resources,
  LANGUAGE_STORAGE_KEY,
  isValidLocale,
  getStoredLanguage,
  setStoredLanguage,
} from './config.js';

// Types
export type {
  SupportedLocale,
  TranslationNamespace,
  I18nConfig,
  DetectionOrder,
  LanguagePreference,
} from './types.js';

export {
  DEFAULT_NAMESPACE,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
} from './types.js';
