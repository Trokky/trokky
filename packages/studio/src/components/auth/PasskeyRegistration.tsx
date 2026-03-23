import React, { useState } from 'react';
import { useT } from 'trokky/i18n';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { startRegistration } from '@simplewebauthn/browser';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('PasskeyRegistration');

interface PasskeyCredential {
  id: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
  createdAt: string;
  friendlyName?: string;
}

interface PasskeyRegistrationProps {
  onSuccess?: (credential: PasskeyCredential) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Passkey registration component
 *
 * Allows authenticated users to register a new passkey (biometric/security key).
 * Used in account settings to add passkeys for passwordless login.
 */
export function PasskeyRegistration({
  onSuccess,
  onError,
  disabled,
  className = '',
}: PasskeyRegistrationProps) {
  const { t } = useT('studio');
  const [isLoading, setIsLoading] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleRegister = async () => {
    setIsLoading(true);

    try {
      // Step 1: Get registration options from server
      logger.debug('Requesting passkey registration options');
      const optionsResponse = await apiClient.post<{
        challenge: string;
        sessionId: string;
        rp: { id: string; name: string };
        user: { id: string; name: string; displayName: string };
        pubKeyCredParams: Array<{ type: string; alg: number }>;
        excludeCredentials?: Array<{
          id: string;
          type: 'public-key';
          transports?: string[];
        }>;
        authenticatorSelection: object;
        attestation: string;
        timeout: number;
      }>('/auth/passkey/register/options', {
        friendlyName: friendlyName || undefined,
      });

      if (!optionsResponse.success || !optionsResponse.data) {
        const errorMessage = optionsResponse.error?.message || t('passkey.register.optionsFailed', 'Failed to start passkey registration');
        logger.error('Failed to get registration options', { error: errorMessage });
        onError?.(errorMessage);
        return;
      }

      const { sessionId, ...options } = optionsResponse.data;
      logger.debug('Received registration options', { sessionId: sessionId.substring(0, 8) });

      // Step 2: Start browser registration (prompts user for biometric/security key)
      let credential;
      try {
        credential = await startRegistration({
          optionsJSON: options as any,
        });
        logger.debug('Browser registration completed');
      } catch (browserError: any) {
        // Handle user cancellation or other browser errors
        if (browserError.name === 'NotAllowedError') {
          logger.info('User cancelled passkey registration');
          onError?.(t('passkey.register.cancelled', 'Registration was cancelled'));
        } else if (browserError.name === 'InvalidStateError') {
          logger.warn('Passkey already registered');
          onError?.(t('passkey.register.alreadyRegistered', 'This passkey is already registered'));
        } else if (browserError.name === 'NotSupportedError') {
          logger.warn('Passkeys not supported in this browser');
          onError?.(t('passkey.register.notSupported', 'Passkeys are not supported in this browser'));
        } else {
          logger.error('Browser registration failed', { error: browserError.message });
          onError?.(browserError.message || t('passkey.register.failed', 'Passkey registration failed'));
        }
        return;
      }

      // Step 3: Verify the credential with the server
      logger.debug('Verifying registration with server');
      const verifyResponse = await apiClient.post<{
        credential: PasskeyCredential;
      }>('/auth/passkey/register/verify', {
        sessionId,
        credential,
        friendlyName: friendlyName || undefined,
      });

      if (!verifyResponse.success || !verifyResponse.data) {
        const errorMessage = verifyResponse.error?.message || t('passkey.register.verifyFailed', 'Passkey registration verification failed');
        logger.error('Registration verification failed', { error: errorMessage });
        onError?.(errorMessage);
        return;
      }

      logger.info('Passkey registered successfully', {
        credentialId: verifyResponse.data.credential.id.substring(0, 8),
      });

      // Reset state
      setFriendlyName('');
      setShowNameInput(false);

      onSuccess?.(verifyResponse.data.credential);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('passkey.register.failed', 'Passkey registration failed');
      logger.error('Passkey registration error', { error: errorMessage });
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (showNameInput) {
    return (
      <div className={`space-y-3 ${className}`}>
        <input
          type="text"
          value={friendlyName}
          onChange={(e) => setFriendlyName(e.target.value)}
          placeholder={t('passkey.register.namePlaceholder', 'e.g., MacBook Pro Touch ID')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleRegister}
            disabled={disabled || isLoading}
            variant="primary"
            className="flex-1"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              t('passkey.register.continue', 'Continue')
            )}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setShowNameInput(false);
              setFriendlyName('');
            }}
            disabled={isLoading}
            variant="outline"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => setShowNameInput(true)}
      disabled={disabled || isLoading}
      variant="outline"
      className={`flex items-center gap-2 ${className}`}
    >
      <PlusIcon className="w-4 h-4" />
      {t('passkey.register.addPasskey', 'Add Passkey')}
    </Button>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default PasskeyRegistration;
