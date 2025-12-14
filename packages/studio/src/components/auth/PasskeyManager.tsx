import React, { useState, useEffect, useCallback } from 'react';
import { useT } from '@trokky/i18n';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { PasskeyRegistration } from './PasskeyRegistration';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('PasskeyManager');

interface PasskeyCredential {
  id: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
  createdAt: string;
  lastUsedAt?: string;
  friendlyName?: string;
}

interface PasskeyManagerProps {
  className?: string;
}

/**
 * Passkey management component
 *
 * Lists all registered passkeys and allows users to:
 * - Add new passkeys
 * - Rename existing passkeys
 * - Delete passkeys
 */
export function PasskeyManager({ className = '' }: PasskeyManagerProps) {
  const { t } = useT('studio');
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const checkPasskeyStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<{ enabled: boolean }>('/auth/passkey/status');
      if (response.success && response.data) {
        setIsConfigured(response.data.enabled);
        return response.data.enabled;
      }
      setIsConfigured(false);
      return false;
    } catch (err) {
      logger.warn('Failed to check passkey status', { error: err });
      setIsConfigured(false);
      return false;
    }
  }, []);

  const loadCredentials = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ credentials: PasskeyCredential[] }>(
        '/auth/passkey/credentials'
      );

      if (response.success && response.data) {
        setCredentials(response.data.credentials);
        logger.debug('Loaded passkey credentials', {
          count: response.data.credentials.length,
        });
      } else {
        setError(response.error?.message || t('passkey.manager.loadFailed', 'Failed to load passkeys'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('passkey.manager.loadFailed', 'Failed to load passkeys');
      logger.error('Failed to load credentials', { error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const init = async () => {
      const enabled = await checkPasskeyStatus();
      if (enabled) {
        await loadCredentials();
      } else {
        setIsLoading(false);
      }
    };
    init();
  }, [checkPasskeyStatus, loadCredentials]);

  const handleRename = async (credentialId: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const response = await apiClient.patch(`/auth/passkey/credentials/${credentialId}`, {
        friendlyName: editingName.trim(),
      });

      if (response.success) {
        logger.info('Renamed passkey credential');
        setCredentials((prev) =>
          prev.map((c) =>
            c.id === credentialId ? { ...c, friendlyName: editingName.trim() } : c
          )
        );
        setEditingId(null);
        setEditingName('');
      } else {
        logger.error('Failed to rename credential', { error: response.error?.message });
        setError(response.error?.message || t('passkey.manager.renameFailed', 'Failed to rename passkey'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('passkey.manager.renameFailed', 'Failed to rename passkey');
      logger.error('Rename error', { error: errorMessage });
      setError(errorMessage);
    }
  };

  const handleDelete = async (credentialId: string) => {
    try {
      setDeletingId(credentialId);
      const response = await apiClient.delete(`/auth/passkey/credentials/${credentialId}`);

      if (response.success) {
        logger.info('Deleted passkey credential');
        setCredentials((prev) => prev.filter((c) => c.id !== credentialId));
      } else {
        logger.error('Failed to delete credential', { error: response.error?.message });
        setError(response.error?.message || t('passkey.manager.deleteFailed', 'Failed to delete passkey'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('passkey.manager.deleteFailed', 'Failed to delete passkey');
      logger.error('Delete error', { error: errorMessage });
      setError(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRegistrationSuccess = (credential: PasskeyCredential) => {
    setCredentials((prev) => [...prev, credential]);
    setError(null);
  };

  const handleRegistrationError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getDeviceIcon = (deviceType: string, backedUp: boolean) => {
    if (backedUp) {
      return <CloudIcon className="w-5 h-5 text-blue-500" />;
    }
    return <KeyIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <LoadingSpinner />
      </div>
    );
  }

  // Show message when passkeys aren't configured on the server
  if (isConfigured === false) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-6">
          <KeyIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {t('passkey.manager.notConfigured', 'Passkey authentication is not enabled')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {t(
              'passkey.manager.notConfiguredDescription',
              'Passkey authentication needs to be configured by an administrator in the server settings.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {credentials.length === 0 ? (
        <div className="text-center py-6">
          <KeyIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('passkey.manager.noPasskeys', "You haven't set up any passkeys yet.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            {t(
              'passkey.manager.description',
              'Passkeys let you sign in without a password using your fingerprint, face, or security key.'
            )}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {credentials.map((credential) => (
            <li
              key={credential.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                {getDeviceIcon(credential.deviceType, credential.backedUp)}
                <div>
                  {editingId === credential.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRename(credential.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(credential.id);
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingName('');
                        }
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      autoFocus
                    />
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white">
                      {credential.friendlyName || t('passkey.manager.unnamed', 'Passkey')}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('passkey.manager.added', 'Added')} {formatDate(credential.createdAt)}
                    {credential.lastUsedAt && (
                      <> &middot; {t('passkey.manager.lastUsed', 'Last used')} {formatDate(credential.lastUsedAt)}</>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {credential.backedUp
                      ? t('passkey.manager.synced', 'Synced across devices')
                      : t('passkey.manager.deviceOnly', 'This device only')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingId !== credential.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(credential.id);
                      setEditingName(credential.friendlyName || '');
                    }}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(credential.id)}
                  disabled={deletingId === credential.id}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  {deletingId === credential.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <PasskeyRegistration
          onSuccess={handleRegistrationSuccess}
          onError={handleRegistrationError}
        />
      </div>
    </div>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default PasskeyManager;
