import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './Router';
import { InitializationScreen } from './InitializationScreen';
import { apiClient } from '@/services/api-client';
import type { BackendCapabilities } from '@/types';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

interface AppState {
  status: 'loading' | 'ready' | 'error' | 'config-needed';
  error?: string;
  capabilities?: BackendCapabilities;
}

export function App() {
  const [appState, setAppState] = useState<AppState>({ status: 'loading' });

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setAppState({ status: 'loading' });
      
      // Initialize API client
      await apiClient.initialize();
      
      // Get backend capabilities
      const capabilities = apiClient.getCapabilities();
      
      setAppState({ 
        status: 'ready',
        capabilities: capabilities || undefined
      });
      
      console.log('✅ Trokky Studio initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Trokky Studio:', error);
      setAppState({ 
        status: 'config-needed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleManualConfig = async (url: string) => {
    try {
      setAppState({ status: 'loading' });
      
      // Create new API client with manual URL
      const manualClient = new (apiClient.constructor as any)(url);
      await manualClient.initialize();
      
      // Replace the global client
      Object.setPrototypeOf(apiClient, manualClient);
      Object.assign(apiClient, manualClient);
      
      const capabilities = apiClient.getCapabilities();
      
      setAppState({ 
        status: 'ready',
        capabilities: capabilities || undefined
      });
      
    } catch (error) {
      setAppState({ 
        status: 'config-needed',
        error: error instanceof Error ? error.message : 'Failed to connect to backend'
      });
    }
  };

  const handleRetry = () => {
    initializeApp();
  };

  // Show initialization screen for non-ready states
  if (appState.status !== 'ready') {
    return (
      <InitializationScreen
        status={appState.status}
        error={appState.error}
        onManualConfig={handleManualConfig}
        onRetry={handleRetry}
      />
    );
  }

  // Ready state - render the main app
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <AppRouter />
      </div>
    </QueryClientProvider>
  );
}