import React from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';

interface InitializationScreenProps {
  status: 'loading' | 'error' | 'config-needed';
  error?: string;
  onManualConfig?: (url: string) => void;
  onRetry?: () => void;
}

export function InitializationScreen({
  status,
  error,
  onManualConfig,
  onRetry
}: InitializationScreenProps) {
  const [manualBackendUrl, setManualBackendUrl] = React.useState('');

  const handleManualConfig = () => {
    if (onManualConfig && manualBackendUrl.trim()) {
      onManualConfig(manualBackendUrl.trim());
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Initializing Trokky Studio
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Discovering backend and loading configuration...
          </p>
        </div>
      </div>
    );
  }

  // Configuration needed state
  if (status === 'config-needed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center mb-6">
            <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">T</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configure Trokky Studio
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              No backend found. Please enter your Trokky backend URL.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Backend URL
              </label>
              <input
                type="url"
                value={manualBackendUrl}
                onChange={(e) => setManualBackendUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleManualConfig();
                  }
                }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter the full URL to your Trokky backend API
              </p>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={handleManualConfig}
                disabled={!manualBackendUrl.trim()}
                className="flex-1"
              >
                Connect
              </Button>
              {onRetry && (
                <Button variant="outline" onClick={onRetry}>
                  Retry Auto-discovery
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Trokky Studio will automatically discover your backend configuration and capabilities.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Initialization Failed
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'An unexpected error occurred'}
          </p>
          {onRetry && (
            <Button onClick={onRetry}>
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}