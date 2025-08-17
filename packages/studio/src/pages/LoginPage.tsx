import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { storageService, STORAGE_KEYS } from '@/utils/storage';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface LoginPageProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [backendUrl, setBackendUrl] = useState('');

  useEffect(() => {
    // Check if backend URL is configured via server injection or build time
    const config = (window as any).TROKKY_CONFIG;
    const injectedBackendUrl = config?.backendUrl;
    const buildTimeBackendUrl = import.meta.env.VITE_BACKEND_URL;
    
    if (injectedBackendUrl || buildTimeBackendUrl) {
      // Hide advanced section since backend is pre-configured
      setBackendUrl(injectedBackendUrl || buildTimeBackendUrl);
    } else {
      // Show advanced section and load from localStorage or default
      const savedUrl = storageService.get<string>(STORAGE_KEYS.BACKEND_URL);
      if (savedUrl) {
        setBackendUrl(savedUrl);
        setShowAdvanced(true); // Show advanced since user has customized it
      } else {
        // Default to current origin with /api
        const defaultUrl = `${window.location.origin}/api`;
        setBackendUrl(defaultUrl);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Save backend URL to localStorage and reinitialize API client (only if not pre-configured)
      const config = (window as any).TROKKY_CONFIG;
      const isPreConfigured = import.meta.env.VITE_BACKEND_URL || config?.backendUrl;
      
      if (backendUrl && !isPreConfigured) {
        storageService.set(STORAGE_KEYS.BACKEND_URL, backendUrl);
        // Reinitialize API client with new backend URL
        apiClient.setBackendUrl(backendUrl);
      }
      const response = await apiClient.login(credentials.username, credentials.password, rememberMe);
      
      if (response.success && response.data) {
        // The login method already returns the correct structure
        const loginData = response.data;
        
        if (loginData.token && loginData.user) {
          // Token is already stored by the login method
          // Call success callback
          onLoginSuccess(loginData.token, loginData.user);
        } else {
          setError('Invalid login response');
        }
      } else {
        setError(response.error?.message || 'Login failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: 'username' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  // Get branding from config
  const config = (window as any).TROKKY_CONFIG;
  const branding = config?.branding || { title: 'Trokky Studio' };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {branding.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in to access your content management system
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email or Username
            </label>
            <Input
              type="text"
              value={credentials.username}
              onChange={handleInputChange('username')}
              placeholder="admin@example.com"
              required
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <Input
              type="password"
              value={credentials.password}
              onChange={handleInputChange('password')}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onChange={setRememberMe}
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Remember me for 7 days
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !credentials.username || !credentials.password}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {/* Only show advanced settings if no backend URL is configured */}
        {!import.meta.env.VITE_BACKEND_URL && !(window as any).TROKKY_CONFIG?.backendUrl && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              {showAdvanced ? (
                <ChevronDownIcon className="h-4 w-4 mr-1" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 mr-1" />
              )}
              Advanced Settings
            </button>
            
            {showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Backend URL
                </label>
                <Input
                  type="url"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="https://example.com/cms-api"
                  disabled={isLoading}
                  className="text-sm"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Enter the full backend API URL including the API path.
                  Example: https://example.com/cms-api
                </p>
                {backendUrl && backendUrl !== `${window.location.origin}/api` && (
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    Connecting to: {backendUrl}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Trokky Studio - Integrated Content Management
          </p>
        </div>
      </div>
    </div>
  );
}