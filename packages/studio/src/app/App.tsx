import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './Router';
import { apiClient } from '@/services/api-client';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SessionTimeoutWarningContainer } from '@/components/auth/SessionTimeoutWarning';
import { StudioContextProvider } from '@/contexts/StudioContext';
import { createStudioLogger } from '@/utils/logger';

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
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <AppRouter />
      <SessionTimeoutWarningContainer />
    </>
  );
}

export function App() {
  useEffect(() => {
    // Initialize API client synchronously - it's integrated so config is already available
    apiClient.initialize();
    const logger = createStudioLogger('App');
    logger.info('Trokky Studio started in integrated mode');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StudioContextProvider>
          <div className="App">
            <AppContent />
          </div>
        </StudioContextProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}