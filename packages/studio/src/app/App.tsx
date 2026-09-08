import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrokkyI18nProvider, useT, type I18nConfig } from '@trokky/trokky/i18n';
import { AppRouter } from './Router';
import { apiClient } from '@/services/api-client';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SessionTimeoutWarningContainer } from '@/components/auth/SessionTimeoutWarning';
import { ToastContainer } from '@/components/ui/Toast';
import { ConfirmDialogContainer } from '@/components/ui/ConfirmDialog';
import { StudioContextProvider } from '@/contexts/StudioContext';
import { createStudioLogger } from '@/utils/logger';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchBranding, applyBrandColors, BrandingConfig } from '@/utils/branding';
import '@/utils/debug'; // Load debug utilities

/**
 * Get i18n configuration from window.TROKKY_CONFIG or use defaults
 */
function getI18nConfig(): I18nConfig {
  const windowConfig = (window as any).TROKKY_CONFIG;
  const i18nConfig = windowConfig?.i18n;

  return {
    defaultLocale: i18nConfig?.defaultLocale || 'en',
    supportedLocales: i18nConfig?.supportedLocales || ['en', 'fr'],
    fallbackLocale: i18nConfig?.fallbackLocale || 'en',
    detectBrowserLanguage: i18nConfig?.detectBrowserLanguage ?? true,
    debug: i18nConfig?.debug ?? import.meta.env.DEV,
  };
}

// Configure the API client once, at import time, before any component renders
// or any hook fires a request. `initialize()` is idempotent, so nothing
// downstream needs to guard against an unconfigured client.
apiClient.initialize();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function AppContent() {
  const { t } = useT('common');
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const logger = createStudioLogger('AppContent');
  const lastStateRef = useRef<{ isAuthenticated?: boolean; isLoading?: boolean }>({});
  
  // Update document title from settings when authenticated
  useDocumentTitle(isAuthenticated);

  // Only log when auth state actually changes, not on every render
  useEffect(() => {
    const currentState = { isAuthenticated, isLoading };
    const lastState = lastStateRef.current;
    
    // Only log if state actually changed
    if (lastState.isAuthenticated !== isAuthenticated || lastState.isLoading !== isLoading) {
      logger.debug('Auth state changed', currentState);
      lastStateRef.current = currentState;
    }
  }, [isAuthenticated, isLoading, logger]);

  const handleLoginSuccess = () => {
    logger.info('Login successful, rechecking auth state');

    // Check if there's a pending OAuth redirect
    const oauthRedirect = sessionStorage.getItem('trokky_oauth_redirect');
    if (oauthRedirect) {
      sessionStorage.removeItem('trokky_oauth_redirect');
      logger.info('Redirecting to OAuth flow', { url: oauthRedirect });
      window.location.href = oauthRedirect;
      return;
    }

    checkAuth();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            {t('app.loadingStudio')}
          </h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Handle routes accessible without authentication
    const currentPath = window.location.pathname;
    const basePath = (window as any).TROKKY_CONFIG?.basePath || '';
    const normalizedPath = currentPath.replace(basePath, '');

    if (normalizedPath === '/forgot-password') {
      return <ForgotPasswordPage />;
    }

    if (normalizedPath === '/reset-password') {
      return <ResetPasswordPage />;
    }

    if (normalizedPath === '/oauth/callback') {
      return <OAuthCallbackPage onLoginSuccess={handleLoginSuccess} />;
    }

    // OAuth authorization routes - redirect to login first, preserving OAuth params
    if (normalizedPath === '/auth/authorize' || normalizedPath === '/auth/device') {
      // Store the full URL so we can redirect back after login
      const fullUrl = window.location.href;
      sessionStorage.setItem('trokky_oauth_redirect', fullUrl);
      return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }

    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <AppRouter />
      <SessionTimeoutWarningContainer />
      {/* Portalled into document.body, above the dialog layer: toasts and
          confirms carry the z-toast token, dialogs the z-overlay token */}
      {createPortal(
        // data-dialog-exempt keeps this layer out of the background-inert sweep:
        // a toast raised while a dialog is open must stay dismissible and
        // announceable, and it paints above the dialog on the z-toast token.
        <div data-dialog-exempt="">
          <ToastContainer />
          <ConfirmDialogContainer />
        </div>,
        document.body
      )}
    </>
  );
}

export function App() {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  // Get i18n config from window.TROKKY_CONFIG (memoized to prevent re-initialization)
  const i18nConfig = useMemo(() => getI18nConfig(), []);

  useEffect(() => {
    const logger = createStudioLogger('App');
    logger.info('Trokky Studio started');

    // Load and apply branding globally
    const loadBranding = async () => {
      const fetchedBranding = await fetchBranding();
      setBranding(fetchedBranding);
      applyBrandColors(fetchedBranding);

      // Update document title immediately
      if (fetchedBranding.title) {
        document.title = fetchedBranding.title;
      }
    };

    loadBranding();

    // Listen for settings updates to refresh branding
    const handleSettingsUpdate = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const settings = detail?.settings;
      if (settings) {
        const updatedBranding: BrandingConfig = {
          title: settings.studioTitle,
          organizationName: settings.organizationName,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          logo: settings.logo
        };
        setBranding(updatedBranding);
        applyBrandColors(updatedBranding);

        // Update document title
        if (updatedBranding.title) {
          document.title = updatedBranding.title;
        }
      }
    };

    window.addEventListener('trokky:settings:updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('trokky:settings:updated', handleSettingsUpdate);
    };
  }, []);

  return (
    <TrokkyI18nProvider config={i18nConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StudioContextProvider branding={branding}>
            <div className="App">
              <AppContent />
            </div>
          </StudioContextProvider>
        </AuthProvider>
      </QueryClientProvider>
    </TrokkyI18nProvider>
  );
}