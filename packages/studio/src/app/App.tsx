import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './Router';
import { apiClient } from '@/services/api-client';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function App() {
  useEffect(() => {
    // Initialize API client synchronously - it's integrated so config is already available
    apiClient.initialize();
    console.log('✅ Trokky Studio started in integrated mode');
  }, []);

  // No initialization screen - go straight to the app
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <AppRouter />
      </div>
    </QueryClientProvider>
  );
}