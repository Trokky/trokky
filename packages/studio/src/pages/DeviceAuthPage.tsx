import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { CheckCircleIcon, XCircleIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useT } from '@trokky/i18n';

interface DeviceCodeInfo {
  clientId: string;
  clientName?: string;
  clientDescription?: string;
  scopes: string[];
  expiresIn: number;
}

type AuthStatus = 'loading' | 'pending' | 'authorized' | 'denied' | 'expired' | 'error';

export function DeviceAuthPage() {
  const { t } = useT('studio');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [deviceInfo, setDeviceInfo] = useState<DeviceCodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setError(t('auth.device.noCode'));
      return;
    }

    fetchDeviceInfo();
  }, [code]);

  const fetchDeviceInfo = async () => {
    try {
      const response = await apiClient.get<DeviceCodeInfo>(`/auth/device/verify?code=${code}`);
      if (response.success && response.data) {
        setDeviceInfo(response.data);
        setStatus('pending');
      } else {
        setStatus('error');
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : response.error?.message || t('auth.device.fetchError');
        setError(errorMsg);
      }
    } catch (err: any) {
      setStatus('error');
      const errorMsg = err?.message || t('auth.device.connectError');
      setError(errorMsg);
    }
  };

  const handleAuthorize = async () => {
    if (!code) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/auth/device/verify', {
        user_code: code,
        action: 'authorize'
      });

      if (response.success) {
        setStatus('authorized');
      } else {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : response.error?.message || t('auth.device.authError');
        setError(errorMsg);
        setStatus('error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || t('auth.device.authError');
      setError(errorMsg);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!code) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/auth/device/verify', {
        user_code: code,
        action: 'deny'
      });

      if (response.success) {
        setStatus('denied');
      } else {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : response.error?.message || t('auth.device.denyError');
        setError(errorMsg);
        setStatus('error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || t('auth.device.denyError');
      setError(errorMsg);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatScopes = (scope: string): string[] => {
    return scope.split(' ').filter(Boolean).map(s => {
      switch (s) {
        case 'openid': return t('auth.device.scopes.openid');
        case 'profile': return t('auth.device.scopes.profile');
        case 'content:read': return t('auth.device.scopes.contentRead');
        case 'content:write': return t('auth.device.scopes.contentWrite');
        case 'content:delete': return t('auth.device.scopes.contentDelete');
        case 'media:read': return t('auth.device.scopes.mediaRead');
        case 'media:write': return t('auth.device.scopes.mediaWrite');
        case 'offline_access': return t('auth.device.scopes.offlineAccess');
        default: return s;
      }
    });
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('auth.device.loading')}</p>
          </div>
        );

      case 'pending':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <ComputerDesktopIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('auth.device.authorizeDevice')}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                  {deviceInfo?.clientName || deviceInfo?.clientId || 'Trokky CLI'}
                </span>
                {' '}{t('auth.device.requestingAccess')}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.device.deviceCode')}
              </p>
              <p className="font-mono text-2xl font-bold text-center text-gray-900 dark:text-white tracking-wider">
                {code}
              </p>
            </div>

            {deviceInfo?.scopes && deviceInfo.scopes.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('auth.device.allowApplication')}
                </p>
                <ul className="space-y-2">
                  {formatScopes(deviceInfo.scopes.join(' ')).map((scope, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircleIcon className="w-4 h-4 mr-2 text-green-500" />
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleDeny}
                disabled={isSubmitting}
              >
                {t('auth.device.deny')}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleAuthorize}
                disabled={isSubmitting}
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : t('auth.device.authorize')}
              </Button>
            </div>
          </div>
        );

      case 'authorized':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('auth.device.authorized')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {t('auth.device.authorizedMessage')}
            </p>
            <Button
              variant="secondary"
              onClick={() => window.close()}
            >
              {t('auth.device.closeWindow')}
            </Button>
          </div>
        );

      case 'denied':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <XCircleIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('auth.device.denied')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {t('auth.device.deniedMessage')}
            </p>
            <Button
              variant="secondary"
              onClick={() => window.close()}
            >
              {t('auth.device.closeWindow')}
            </Button>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <XCircleIcon className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('auth.device.expired')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {t('auth.device.expiredMessage')}
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
              {t('auth.device.error')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {error || t('common.error')}
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
            >
              {t('auth.device.returnToStudio')}
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
            {t('auth.device.pageTitle')}
          </h1>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
