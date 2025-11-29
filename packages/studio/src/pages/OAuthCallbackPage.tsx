import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';

interface OAuthCallbackPageProps {
  onLoginSuccess: () => void;
}

type CallbackStatus = 'processing' | 'success' | 'error';

/**
 * OAuth Callback Page
 *
 * Handles the OAuth redirect callback from providers (Google).
 * Processes the authorization code and completes login or account linking.
 */
export function OAuthCallbackPage({ onLoginSuccess }: OAuthCallbackPageProps) {
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Extract code and state from URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const urlError = urlParams.get('error');

      // Check for errors from OAuth provider
      if (urlError) {
        const errorDescription = urlParams.get('error_description') || 'Authentication was denied';
        throw new Error(errorDescription);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Get stored OAuth state from sessionStorage
      const storedState = sessionStorage.getItem('oauth_state');
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
      const mode = (sessionStorage.getItem('oauth_mode') || 'login') as 'login' | 'link';

      // Validate state (CSRF protection)
      if (state !== storedState) {
        throw new Error('Invalid state parameter. This may be a security issue.');
      }

      if (!codeVerifier) {
        throw new Error('Missing code verifier. Please try again.');
      }

      // Exchange code for tokens
      const response = await apiClient.post<{
        token?: string;
        refreshToken?: string;
        user?: any;
        expiresAt?: string;
        message?: string;
        provider?: {
          provider: string;
          email: string;
          linkedAt: string;
        };
      }>('/auth/oauth/google/callback', {
        code,
        state,
        codeVerifier,
        mode,
      });

      // Clean up sessionStorage
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');
      sessionStorage.removeItem('oauth_mode');

      if (response.success && response.data) {
        if (mode === 'login') {
          // Login mode: Store tokens and redirect to dashboard
          const { token, refreshToken, user, expiresAt } = response.data;

          if (token && user) {
            // Store tokens
            localStorage.setItem('trokky_auth_token', token);
            if (refreshToken) {
              localStorage.setItem('trokky_refresh_token', refreshToken);
            }

            // Set token in API client
            apiClient.setAuthToken(token);

            // Notify parent of successful login
            setStatus('success');
            setSuccessMessage('Login successful! Redirecting...');

            // Short delay then redirect
            setTimeout(() => {
              onLoginSuccess();
              // Navigate to dashboard
              window.location.href = getBasePath() + '/';
            }, 1000);
          } else {
            throw new Error('Invalid response from server');
          }
        } else {
          // Link mode: Show success and redirect to preferences
          setStatus('success');
          setSuccessMessage(
            response.data.message ||
              `Google account linked successfully (${response.data.provider?.email})`
          );

          // Redirect to user preferences after a short delay
          setTimeout(() => {
            window.location.href = getBasePath() + '/user/preferences';
          }, 2000);
        }
      } else {
        throw new Error(response.error?.message || 'OAuth callback failed');
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');

      // Clean up sessionStorage on error too
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');
      sessionStorage.removeItem('oauth_mode');
    }
  };

  const handleRetry = () => {
    // Redirect to login page
    window.location.href = getBasePath() + '/';
  };

  const getBasePath = () => {
    const config = (window as any).TROKKY_CONFIG;
    return config?.basePath || '';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl text-center">
          {status === 'processing' && (
            <>
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Processing...
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Completing authentication with Google
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Success!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{successMessage}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Authentication Failed
              </h2>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Return to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default OAuthCallbackPage;
