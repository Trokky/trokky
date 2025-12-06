import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { CheckCircleIcon, XCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface AuthorizationInfo {
  client: {
    id: string;
    name: string;
    description?: string;
    logoUrl?: string;
    homepageUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
  };
  scopes: string[];
  redirectUri: string;
  state: string;
  codeChallenge: string;
  hasExistingConsent?: boolean;
}

type AuthStatus = 'loading' | 'pending' | 'redirecting' | 'error';

/**
 * OAuth2 Authorization Page
 *
 * Handles the consent screen for Authorization Code Flow with PKCE.
 * External applications redirect here to request user authorization.
 */
export function AuthorizePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [authInfo, setAuthInfo] = useState<AuthorizationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract query parameters
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const scope = searchParams.get('scope');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');

  useEffect(() => {
    if (!clientId || !redirectUri || !responseType || !state || !codeChallenge) {
      setStatus('error');
      setError('Missing required authorization parameters');
      return;
    }

    validateAuthorizationRequest();
  }, [clientId, redirectUri, responseType, scope, state, codeChallenge]);

  const validateAuthorizationRequest = async () => {
    try {
      // Build the validation URL with all params
      const params = new URLSearchParams();
      params.set('response_type', responseType || '');
      params.set('client_id', clientId || '');
      params.set('redirect_uri', redirectUri || '');
      if (scope) params.set('scope', scope);
      params.set('state', state || '');
      params.set('code_challenge', codeChallenge || '');
      params.set('code_challenge_method', codeChallengeMethod || 'S256');

      const response = await apiClient.get<AuthorizationInfo>(
        `/auth/authorize?${params.toString()}`
      );

      if (response.success && response.data) {
        setAuthInfo(response.data);

        // Auto-approve if user has existing consent for all requested scopes
        // Stay in 'loading' state during auto-approve to avoid UI flicker
        if (response.data.hasExistingConsent) {
          // Don't change status - keep showing loading spinner
          // This prevents the visual glitch from rapid state changes
          await autoApprove(response.data);
        } else {
          setStatus('pending');
        }
      } else {
        setStatus('error');
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Invalid authorization request';
        setError(errorMsg);
      }
    } catch (err: any) {
      setStatus('error');
      const errorMsg = err?.message || 'Failed to validate authorization request';
      setError(errorMsg);
    }
  };

  const autoApprove = async (info: AuthorizationInfo) => {
    try {
      const response = await apiClient.post<{ redirectUrl: string }>('/auth/authorize', {
        action: 'approve',
        client_id: info.client.id,
        redirect_uri: info.redirectUri,
        scopes: info.scopes,
        state: info.state,
        code_challenge: info.codeChallenge
      });

      if (response.success && response.data?.redirectUrl) {
        // Redirect immediately - no state change needed, user will leave the page
        window.location.href = response.data.redirectUrl;
      } else {
        // If auto-approve fails, fall back to showing consent screen
        setStatus('pending');
      }
    } catch {
      // If auto-approve fails, fall back to showing consent screen
      setStatus('pending');
    }
  };

  const handleAuthorize = async () => {
    if (!authInfo) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<{ redirectUrl: string }>('/auth/authorize', {
        action: 'approve',
        client_id: authInfo.client.id,
        redirect_uri: authInfo.redirectUri,
        scopes: authInfo.scopes,
        state: authInfo.state,
        code_challenge: authInfo.codeChallenge
      });

      if (response.success && response.data?.redirectUrl) {
        setStatus('redirecting');
        // Redirect to the client application with the authorization code
        window.location.href = response.data.redirectUrl;
      } else {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Authorization failed';
        setError(errorMsg);
        setStatus('error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to authorize';
      setError(errorMsg);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!authInfo) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<{ redirectUrl: string }>('/auth/authorize', {
        action: 'deny',
        client_id: authInfo.client.id,
        redirect_uri: authInfo.redirectUri,
        scopes: authInfo.scopes,
        state: authInfo.state,
        code_challenge: authInfo.codeChallenge
      });

      if (response.success && response.data?.redirectUrl) {
        setStatus('redirecting');
        window.location.href = response.data.redirectUrl;
      } else {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to deny authorization';
        setError(errorMsg);
        setStatus('error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to deny';
      setError(errorMsg);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatScope = (scope: string): string => {
    switch (scope) {
      case 'openid': return 'Access your identity';
      case 'profile': return 'Access your profile information';
      case 'content:read': return 'Read content';
      case 'content:write': return 'Create and update content';
      case 'content:delete': return 'Delete content';
      case 'media:read': return 'Read media files';
      case 'media:write': return 'Upload media files';
      case 'offline_access': return 'Stay logged in';
      default: return scope;
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Validating authorization request...
            </p>
          </div>
        );

      case 'pending':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Authorize Application
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {authInfo?.client.name}
                </span>
                {' '}wants to access your account
              </p>
              {authInfo?.client.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                  {authInfo.client.description}
                </p>
              )}
            </div>

            {authInfo?.scopes && authInfo.scopes.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  This will allow the application to:
                </p>
                <ul className="space-y-2">
                  {authInfo.scopes.map((scope, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircleIcon className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                      {formatScope(scope)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {authInfo?.client.homepageUrl && (
              <div className="text-center text-sm">
                <a
                  href={authInfo.client.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Visit application website
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleDeny}
                disabled={isSubmitting}
              >
                Deny
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleAuthorize}
                disabled={isSubmitting}
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : 'Authorize'}
              </Button>
            </div>

            <p className="text-xs text-center text-gray-500 dark:text-gray-500">
              By authorizing, you allow this application to access your data according to the permissions listed above.
            </p>
          </div>
        );

      case 'redirecting':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <LoadingSpinner size="lg" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Redirecting...
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              You are being redirected back to the application.
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <XCircleIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Authorization Error
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {error || 'An unexpected error occurred'}
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
            >
              Return to Studio
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Trokky
          </h1>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
