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
    // Auto-detect system theme preference
    const detectTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    detectTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      if (!localStorage.getItem('theme')) {
        detectTheme();
      }
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    // Check if backend URL is configured via server injection or build time
    const config = (window as any).TROKKY_CONFIG;
    const injectedBackendUrl = config?.backendUrl;
    const buildTimeBackendUrl = import.meta.env.VITE_BACKEND_URL;
    
    if (injectedBackendUrl || buildTimeBackendUrl) {
      // Hide advanced section since backend is pre-configured
      setBackendUrl(injectedBackendUrl || buildTimeBackendUrl);
    } else {
      // Load from localStorage or default but keep panel closed
      const savedUrl = storageService.get<string>(STORAGE_KEYS.BACKEND_URL);
      if (savedUrl) {
        setBackendUrl(savedUrl);
      } else {
        // Default to current origin with /api
        const defaultUrl = `${window.location.origin}/api`;
        setBackendUrl(defaultUrl);
      }
    }

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-sm">

        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
          {error && (
            <div className="mb-6 p-3 bg-red-50/80 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Input
                  type="text"
                  value={credentials.username}
                  onChange={handleInputChange('username')}
                  placeholder="Email or username"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                  className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
                />
              </div>

              <div>
                <Input
                  type="password"
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  placeholder="Password"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onChange={setRememberMe}
                  className="mr-2"
                />
                <span className="text-gray-600 dark:text-gray-400">Stay signed in</span>
              </label>

              {/* Only show advanced settings if no backend URL is configured */}
              {!import.meta.env.VITE_BACKEND_URL && !(window as any).TROKKY_CONFIG?.backendUrl && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {showAdvanced ? (
                    <ChevronDownIcon className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 mr-1" />
                  )}
                  Advanced
                </button>
              )}
            </div>

            {/* Advanced settings panel */}
            {!import.meta.env.VITE_BACKEND_URL && !(window as any).TROKKY_CONFIG?.backendUrl && showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg border border-gray-200/30 dark:border-gray-700/30">
                <Input
                  type="url"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="Backend URL"
                  disabled={isLoading}
                  className="text-sm bg-transparent border-gray-300 dark:border-gray-600 px-4 py-2"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Custom backend API endpoint
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium text-base transition-colors"
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
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Trokky Studio
          </p>
        </div>
      </div>
    </div>
  );
}