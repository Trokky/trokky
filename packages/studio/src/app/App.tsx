import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    checkAuth();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Loading Studio...
          </h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Handle password reset routes (accessible without authentication)
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

    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <AppRouter />
      <SessionTimeoutWarningContainer />
      <ToastContainer />
      <ConfirmDialogContainer />
    </>
  );
}

export function App() {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  useEffect(() => {
    // Initialize API client synchronously - config is already available
    apiClient.initialize();
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
    const handleSettingsUpdate = async (event: CustomEvent) => {
      const settings = event.detail?.settings;
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

    window.addEventListener('trokky:settings:updated', handleSettingsUpdate as EventListener);

    return () => {
      window.removeEventListener('trokky:settings:updated', handleSettingsUpdate as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StudioContextProvider branding={branding}>
          <div className="App">
            <AppContent />
          </div>
        </StudioContextProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}