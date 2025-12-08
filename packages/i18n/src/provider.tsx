import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';

import type { I18nConfig, SupportedLocale } from './types.js';
import { initI18n, getStoredLanguage, setStoredLanguage } from './config.js';

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
  const [i18nInstance, setI18nInstance] = useState<I18nInstance | null>(null);

  useEffect(() => {
    // Initialize i18n
    const instance = initI18n(config);

    // Set initial locale if provided
    if (initialLocale) {
      instance.changeLanguage(initialLocale);
      setStoredLanguage(initialLocale);
    }

    // Listen for language changes
    const handleLanguageChanged = (lng: string) => {
      if (onLanguageChange) {
        onLanguageChange(lng as SupportedLocale);
      }
    };

    instance.on('languageChanged', handleLanguageChanged);
    setI18nInstance(instance);

    return () => {
      instance.off('languageChanged', handleLanguageChanged);
    };
  }, [config, initialLocale, onLanguageChange]);

  // Show nothing while initializing
  if (!i18nInstance) {
    return <>{children}</>;
  }

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
