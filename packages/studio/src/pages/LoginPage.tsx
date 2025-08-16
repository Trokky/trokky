import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/auth/login', {
        credentials: {
          username: credentials.username,
          password: credentials.password
        }
      });
      
      if (response.success && response.data) {
        // Handle nested response structure from API
        const actualData = (response.data as any).data || response.data;
        
        if (typeof actualData === 'object' && 
            'token' in actualData && 
            'user' in actualData) {
          const loginData = actualData as {
            token: string;
            user: any;
          };
          
          // Store token in localStorage
          localStorage.setItem('trokky_auth_token', loginData.token);
          
          // Call success callback
          onLoginSuccess(loginData.token, loginData.user);
        } else {
          setError(response.error?.message || 'Login failed');
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

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Trokky Studio - Integrated Content Management
          </p>
        </div>
      </div>
    </div>
  );
}