import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './Router';
import { apiClient } from '@/services/api-client';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SessionTimeoutWarningContainer } from '@/components/auth/SessionTimeoutWarning';
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

  logger.info('AppContent render', { isAuthenticated, isLoading });

  const handleLoginSuccess = () => {
    logger.info('Login successful, rechecking auth state');
    checkAuth();
  };

  if (isLoading) {
    logger.info('Showing loading screen');
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
    logger.info('Not authenticated, showing login page');
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  logger.info('Authenticated, showing app router');
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
        <div className="App">
          <AppContent />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}