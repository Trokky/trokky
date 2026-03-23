import { useTranslation, UseTranslationOptions } from 'react-i18next';
import { useCallback } from 'react';

import type { TranslationNamespace, SupportedLocale } from './types.js';
import { SUPPORTED_LOCALES, LOCALE_NAMES } from './types.js';
import { setStoredLanguage, isValidLocale } from './config.js';

/**
 * Hook for accessing translations with a specific namespace
 *
 * @example
 * ```tsx
 * // Using studio namespace
 * const { t } = useT('studio');
 * return <h1>{t('users.title')}</h1>;
 *
 * // Using multiple namespaces
 * const { t } = useT(['studio', 'common']);
 * return <button>{t('common:actions.save')}</button>;
 * ```
 */
export function useT(
  ns: TranslationNamespace | TranslationNamespace[] = 'common',
  options?: UseTranslationOptions<TranslationNamespace>
) {
  return useTranslation(ns, options);
}

/**
 * Hook for managing locale/language
 *
 * @example
 * ```tsx
 * const { locale, setLocale, locales, getLocaleName } = useLocale();
 *
 * return (
 *   <select value={locale} onChange={(e) => setLocale(e.target.value)}>
 *     {locales.map((l) => (
 *       <option key={l} value={l}>{getLocaleName(l)}</option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useLocale() {
  const { i18n } = useTranslation();

  const locale = i18n.language as SupportedLocale;

  const setLocale = useCallback(
    (newLocale: string) => {
      if (isValidLocale(newLocale)) {
        i18n.changeLanguage(newLocale);
        setStoredLanguage(newLocale);
      } else {
        console.warn(`[i18n] Attempted to set unsupported locale: ${newLocale}`);
      }
    },
    [i18n]
  );

  const getLocaleName = useCallback((localeCode: SupportedLocale): string => {
    return LOCALE_NAMES[localeCode] || localeCode;
  }, []);

  return {
    /** Current locale */
    locale,
    /** Change the current locale */
    setLocale,
    /** All supported locales */
    locales: SUPPORTED_LOCALES,
    /** Get display name for a locale */
    getLocaleName,
    /** Raw i18n instance for advanced use cases */
    i18n,
  };
}

/**
 * Hook specifically for error message translations
 *
 * @example
 * ```tsx
 * const { tError } = useErrorTranslation();
 *
 * // Translate error with code
 * return <span>{tError('DOCUMENT_NOT_FOUND')}</span>;
 *
 * // With interpolation
 * return <span>{tError('VALIDATION_FAILED', { field: 'email' })}</span>;
 * ```
 */
export function useErrorTranslation() {
  const { t } = useTranslation('errors');

  const tError = useCallback(
    (errorCode: string, options?: Record<string, unknown>): string => {
      const key = `codes.${errorCode}`;
      const translated = String(t(key, options as never));

      // If translation equals key, it wasn't found - return a formatted version
      if (translated === key) {
        return errorCode.replace(/_/g, ' ').toLowerCase();
      }
      return translated;
    },
    [t]
  );

  return { tError, t };
}

/**
 * Hook for field-related translations
 *
 * @example
 * ```tsx
 * const { tField, tValidation, tPlaceholder } = useFieldTranslation();
 *
 * return (
 *   <div>
 *     <label>{tField('string', 'label')}</label>
 *     <input placeholder={tPlaceholder('string')} />
 *     {error && <span>{tValidation('required')}</span>}
 *   </div>
 * );
 * ```
 */
export function useFieldTranslation() {
  const { t } = useTranslation('fields');

  const tField = useCallback(
    (fieldType: string, key: string, options?: Record<string, unknown>): string => {
      return String(t(`types.${fieldType}.${key}`, options as never));
    },
    [t]
  );

  const tValidation = useCallback(
    (rule: string, options?: Record<string, unknown>): string => {
      return String(t(`validation.${rule}`, options as never));
    },
    [t]
  );

  const tPlaceholder = useCallback(
    (fieldType: string): string => {
      return String(t(`types.${fieldType}.placeholder`, { defaultValue: '' }));
    },
    [t]
  );

  return { tField, tValidation, tPlaceholder, t };
}
