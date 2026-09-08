import React, { useEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';

import type { I18nConfig, SupportedLocale } from './types.js';
import { initI18n, setStoredLanguage } from './config.js';

export interface TrokkyI18nProviderProps {
  /** Children to render */
  children: React.ReactNode;
  /** i18n configuration options */
  config?: I18nConfig;
  /** Initial locale (overrides stored/detected locale) */
  initialLocale?: SupportedLocale;
  /** Callback when language changes */
  onLanguageChange?: (locale: SupportedLocale) => void;
}

/**
 * Provider component for Trokky internationalization
 *
 * @example
 * ```tsx
 * // Basic usage
 * <TrokkyI18nProvider>
 *   <App />
 * </TrokkyI18nProvider>
 *
 * // With configuration
 * <TrokkyI18nProvider
 *   config={{ defaultLocale: 'fr', debug: true }}
 *   onLanguageChange={(locale) => console.log('Language changed to', locale)}
 * >
 *   <App />
 * </TrokkyI18nProvider>
 * ```
 */
export function TrokkyI18nProvider({
  children,
  config,
  initialLocale,
  onLanguageChange,
}: TrokkyI18nProviderProps): React.ReactElement {
  // Initialize i18n synchronously - it's safe because init() is sync with bundled resources
  const i18nInstance = useMemo(() => {
    const instance = initI18n(config);

    // Set initial locale if provided
    if (initialLocale) {
      instance.changeLanguage(initialLocale);
      setStoredLanguage(initialLocale);
    }

    return instance;
  }, [config, initialLocale]);

  // Set up language change listener
  useEffect(() => {
    if (!onLanguageChange) return;

    const handleLanguageChanged = (lng: string) => {
      onLanguageChange(lng as SupportedLocale);
    };

    i18nInstance.on('languageChanged', handleLanguageChanged);

    return () => {
      i18nInstance.off('languageChanged', handleLanguageChanged);
    };
  }, [i18nInstance, onLanguageChange]);

  return (
    <I18nextProvider i18n={i18nInstance}>
      {children}
    </I18nextProvider>
  );
}

/**
 * Context for accessing i18n configuration
 * Useful for components that need to know supported locales, etc.
 */
export interface I18nContextValue {
  /** Current locale */
  locale: SupportedLocale;
  /** Change locale */
  setLocale: (locale: SupportedLocale) => void;
  /** Supported locales */
  supportedLocales: SupportedLocale[];
}
