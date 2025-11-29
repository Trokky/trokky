import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';

interface GoogleLoginButtonProps {
  mode?: 'login' | 'link';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Google OAuth button component
 *
 * Used for:
 * - Login: "Sign in with Google" on login page
 * - Link: "Link Google Account" in user preferences
 */
export function GoogleLoginButton({
  mode = 'login',
  onSuccess,
  onError,
  disabled,
  className = '',
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.post<{
        authUrl: string;
        state: string;
        codeVerifier: string;
      }>('/auth/oauth/google/init', { mode });

      if (response.success && response.data) {
        // Store OAuth state in sessionStorage for callback verification
        sessionStorage.setItem('oauth_state', response.data.state);
        sessionStorage.setItem('oauth_code_verifier', response.data.codeVerifier);
        sessionStorage.setItem('oauth_mode', mode);

        // Redirect to Google
        window.location.href = response.data.authUrl;
      } else {
        const errorMessage = response.error?.message || 'Failed to initialize Google login';
        onError?.(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Google login';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      variant="outline"
      className={`w-full flex items-center justify-center gap-3 h-12 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${className}`}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : (
        <GoogleIcon className="w-5 h-5" />
      )}
      <span className="text-gray-700 dark:text-gray-300">
        {mode === 'link' ? 'Link Google Account' : 'Sign in with Google'}
      </span>
    </Button>
  );
}

/**
 * Google "G" logo
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default GoogleLoginButton;
