import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { GoogleLoginButton } from './GoogleLoginButton';
import { useT } from '@trokky/i18n';

interface OAuthProvider {
  provider: 'google' | 'github' | 'microsoft';
  providerId: string;
  email: string;
  linkedAt: string;
  lastUsedAt?: string;
}

interface OAuthStatus {
  providers: {
    google: boolean;
    github?: boolean;
    microsoft?: boolean;
  };
}

/**
 * OAuth Providers List Component
 *
 * Shows connected OAuth accounts and allows linking/unlinking.
 * Used in User Preferences page.
 */
export function OAuthProvidersList() {
  const { t } = useT('studio');
  const { user, refetch: refetchUser } = useCurrentUser();
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get linked providers from user object
  const linkedProviders: OAuthProvider[] = (user as any)?.oauthProviders || [];

  useEffect(() => {
    fetchOAuthStatus();
  }, []);

  const fetchOAuthStatus = async () => {
    try {
      const response = await apiClient.get<OAuthStatus>('/auth/oauth/status');
      if (response.success && response.data) {
        setOauthStatus(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = async (provider: string) => {
    setUnlinkingProvider(provider);
    setMessage(null);

    try {
      const response = await apiClient.delete<{ message: string }>(
        `/auth/oauth/${provider}/unlink`
      );

      if (response.success) {
        // Refresh user data from server
        await refetchUser();
        setMessage({ type: 'success', text: t('oauth.unlinkSuccess', { provider: getProviderName(provider) }) });
      } else {
        throw new Error(response.error?.message || t('oauth.unlinkFailed'));
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('oauth.unlinkFailed'),
      });
    } finally {
      setUnlinkingProvider(null);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleLinkSuccess = async () => {
    setMessage({ type: 'success', text: t('oauth.accountLinked') });
    // Refresh user data from server
    await refetchUser();
  };

  const handleLinkError = (error: string) => {
    setMessage({ type: 'error', text: error });
    setTimeout(() => setMessage(null), 5000);
  };

  const getProviderName = (provider: string): string => {
    const names: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
    };
    return names[provider] || provider;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return <GoogleIcon className="w-5 h-5" />;
      case 'github':
        return <GitHubIcon className="w-5 h-5" />;
      case 'microsoft':
        return <MicrosoftIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const isProviderLinked = (provider: string): boolean => {
    return linkedProviders.some((p) => p.provider === provider);
  };

  const getLinkedProvider = (provider: string): OAuthProvider | undefined => {
    return linkedProviders.find((p) => p.provider === provider);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  // Check if any OAuth provider is configured
  const hasAnyProviderConfigured = oauthStatus?.providers?.google;

  if (!hasAnyProviderConfigured) {
    return null; // Don't show the section if no OAuth providers are configured
  }

  return (
    <div className="space-y-4">
      {/* Status Messages */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Google Provider */}
      {oauthStatus?.providers?.google && (
        <ProviderRow
          provider="google"
          isLinked={isProviderLinked('google')}
          linkedData={getLinkedProvider('google')}
          isUnlinking={unlinkingProvider === 'google'}
          onUnlink={() => handleUnlink('google')}
          onLinkSuccess={handleLinkSuccess}
          onLinkError={handleLinkError}
          getProviderIcon={getProviderIcon}
          getProviderName={getProviderName}
          formatDate={formatDate}
          t={t}
        />
      )}

      {/* Future: GitHub, Microsoft, etc. */}
    </div>
  );
}

interface ProviderRowProps {
  provider: string;
  isLinked: boolean;
  linkedData?: OAuthProvider;
  isUnlinking: boolean;
  onUnlink: () => void;
  onLinkSuccess: () => void;
  onLinkError: (error: string) => void;
  getProviderIcon: (provider: string) => React.ReactNode;
  getProviderName: (provider: string) => string;
  formatDate: (date: string) => string;
  t: (key: string, params?: Record<string, string>) => string;
}

function ProviderRow({
  provider,
  isLinked,
  linkedData,
  isUnlinking,
  onUnlink,
  onLinkSuccess,
  onLinkError,
  getProviderIcon,
  getProviderName,
  formatDate,
  t,
}: ProviderRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">{getProviderIcon(provider)}</div>
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {getProviderName(provider)}
          </h4>
          {isLinked && linkedData ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {linkedData.email} - {t('oauth.linked', { date: formatDate(linkedData.linkedAt) })}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('oauth.notConnected')}</p>
          )}
        </div>
      </div>

      <div>
        {isLinked ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnlink}
            disabled={isUnlinking}
            className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {isUnlinking ? <LoadingSpinner size="sm" /> : t('oauth.unlink')}
          </Button>
        ) : provider === 'google' ? (
          <GoogleLoginButton
            mode="link"
            onSuccess={onLinkSuccess}
            onError={onLinkError}
            className="!w-auto !h-auto py-1.5 px-3 text-sm"
          />
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t('oauth.comingSoon')}
          </Button>
        )}
      </div>
    </div>
  );
}

// Provider Icons
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

export default OAuthProvidersList;
