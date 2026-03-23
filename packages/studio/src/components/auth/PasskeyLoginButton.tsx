import React, { useState } from 'react';
import { useT } from 'trokky/i18n';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { startAuthentication } from '@simplewebauthn/browser';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('PasskeyLoginButton');

interface PasskeyLoginButtonProps {
  onSuccess?: (data: {
    token: string;
    refreshToken: string;
    user: any;
    expiresAt: string;
  }) => void;
  onMFARequired?: (data: {
    mfaToken: string;
    methods: string[];
    expiresIn: number;
  }) => void;
  onMFASetupRequired?: (data: {
    setupToken: string;
    allowedMethods: string[];
    message: string;
    expiresIn: number;
  }) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Passkey login button component
 *
 * Allows users to authenticate using WebAuthn/Passkeys (biometrics, security keys).
 * This is a primary authentication method, not MFA.
 */
export function PasskeyLoginButton({
  onSuccess,
  onMFARequired,
  onMFASetupRequired,
  onError,
  disabled,
  className = '',
}: PasskeyLoginButtonProps) {
  const { t } = useT('studio');
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      // Step 1: Get authentication options from server
      logger.debug('Requesting passkey authentication options');
      const optionsResponse = await apiClient.post<{
        challenge: string;
        sessionId: string;
        rpId: string;
        allowCredentials?: Array<{
          id: string;
          type: 'public-key';
          transports?: string[];
        }>;
        userVerification: string;
        timeout: number;
      }>('/auth/passkey/login/options', {});

      if (!optionsResponse.success || !optionsResponse.data) {
        const errorMessage = optionsResponse.error?.message || t('passkey.optionsFailed', 'Failed to start passkey authentication');
        logger.error('Failed to get passkey options', { error: errorMessage });
        onError?.(errorMessage);
        return;
      }

      const { sessionId, ...options } = optionsResponse.data;
      logger.debug('Received passkey options', { sessionId: sessionId.substring(0, 8) });

      // Step 2: Start browser authentication (prompts user for biometric/security key)
      let credential;
      try {
        credential = await startAuthentication({
          optionsJSON: options as any,
        });
        logger.debug('Browser authentication completed');
      } catch (browserError: any) {
        // Handle user cancellation or other browser errors
        if (browserError.name === 'NotAllowedError') {
          logger.info('User cancelled passkey authentication');
          onError?.(t('passkey.cancelled', 'Authentication was cancelled'));
        } else if (browserError.name === 'NotSupportedError') {
          logger.warn('Passkeys not supported in this browser');
          onError?.(t('passkey.notSupported', 'Passkeys are not supported in this browser'));
        } else {
          logger.error('Browser authentication failed', { error: browserError.message });
          onError?.(browserError.message || t('passkey.authFailed', 'Passkey authentication failed'));
        }
        return;
      }

      // Step 3: Verify the credential with the server
      logger.debug('Verifying passkey with server');
      const verifyResponse = await apiClient.post<{
        // Success response
        token?: string;
        refreshToken?: string;
        user?: any;
        expiresAt?: string;
        // MFA required response
        requiresMFA?: boolean;
        mfaToken?: string;
        methods?: string[];
        // MFA setup required response
        requiresMFASetup?: boolean;
        setupToken?: string;
        allowedMethods?: string[];
        message?: string;
        expiresIn?: number;
      }>('/auth/passkey/login/verify', {
        sessionId,
        credential,
        deviceId: getDeviceId(),
      });

      if (!verifyResponse.success || !verifyResponse.data) {
        const errorMessage = verifyResponse.error?.message || t('passkey.verifyFailed', 'Passkey verification failed');
        logger.error('Passkey verification failed', { error: errorMessage });
        onError?.(errorMessage);
        return;
      }

      const data = verifyResponse.data;

      // Handle different response types
      if (data.requiresMFA && data.mfaToken) {
        logger.info('MFA required after passkey authentication');
        onMFARequired?.({
          mfaToken: data.mfaToken,
          methods: data.methods || [],
          expiresIn: data.expiresIn || 300,
        });
      } else if (data.requiresMFASetup && data.setupToken) {
        logger.info('MFA setup required after passkey authentication');
        onMFASetupRequired?.({
          setupToken: data.setupToken,
          allowedMethods: data.allowedMethods || [],
          message: data.message || '',
          expiresIn: data.expiresIn || 900,
        });
      } else if (data.token && data.refreshToken && data.user) {
        logger.info('Passkey authentication successful', { userId: data.user.id });
        onSuccess?.({
          token: data.token,
          refreshToken: data.refreshToken,
          user: data.user,
          expiresAt: data.expiresAt || '',
        });
      } else {
        logger.error('Unexpected response from passkey verification');
        onError?.(t('passkey.unexpectedResponse', 'Unexpected response from server'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('passkey.authFailed', 'Passkey authentication failed');
      logger.error('Passkey authentication error', { error: errorMessage });
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
        <PasskeyIcon className="w-5 h-5" />
      )}
      <span className="text-gray-700 dark:text-gray-300">
        {t('passkey.signIn', 'Sign in with Passkey')}
      </span>
    </Button>
  );
}

/**
 * Get or generate a device ID for trusted device tracking
 */
function getDeviceId(): string {
  const STORAGE_KEY = 'trokky_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);

  if (!deviceId) {
    // Generate a new device ID
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    deviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Passkey/Fingerprint icon
 */
function PasskeyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h1v1a1 1 0 001 1h1v1a1 1 0 001 1h2a1 1 0 001-1v-4.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"
        className="fill-current text-gray-600 dark:text-gray-300"
      />
      <circle
        cx="12"
        cy="9"
        r="2"
        className="fill-current text-white dark:text-gray-800"
      />
    </svg>
  );
}

export default PasskeyLoginButton;
