import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Checkbox } from '@/components/ui/Checkbox';
import { apiClient } from '@/services/api-client';
import {
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  KeyIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { useT } from '@trokky/i18n';

type MFAMethod = 'totp' | 'email';

interface MFAVerificationProps {
  mfaToken: string;
  methods: MFAMethod[];
  onSuccess: (token: string, user: any) => void;
  onBack: () => void;
  onError: (error: string) => void;
}

export function MFAVerification({
  mfaToken,
  methods,
  onSuccess,
  onBack,
  onError,
}: MFAVerificationProps) {
  const { t } = useT('studio');
  const [code, setCode] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod | 'backup'>(
    methods.includes('totp') ? 'totp' : methods[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount and method change
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedMethod]);

  // Auto-send email code when email method is selected
  useEffect(() => {
    if (selectedMethod === 'email' && !codeSent) {
      handleSendEmailCode();
    }
  }, [selectedMethod]);

  const handleSendEmailCode = async () => {
    setIsSendingCode(true);
    setError(null);

    try {
      const response = await apiClient.post('/auth/mfa/send-code', {
        mfaToken,
      });

      if (response.success) {
        setCodeSent(true);
      } else {
        setError(response.error?.message || 'Failed to send code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setError(t('mfa.enterCode'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate device ID for trust feature
      const deviceId = trustDevice ? generateDeviceId() : undefined;
      const deviceName = trustDevice ? getDeviceName() : undefined;

      const endpoint =
        selectedMethod === 'backup' ? '/auth/mfa/verify-backup' : '/auth/mfa/verify';

      const response = await apiClient.post<{
        token: string;
        refreshToken: string;
        user: any;
        warning?: string;
      }>(endpoint, {
        mfaToken,
        code: code.trim(),
        method: selectedMethod === 'backup' ? undefined : selectedMethod,
        trustDevice,
        deviceId,
        deviceName,
      });

      if (response.success && response.data) {
        // Store tokens
        if (response.data.token) {
          await apiClient.storeTokens(response.data.token, response.data.refreshToken);
        }

        // Show warning if low backup codes
        if (response.data.warning) {
          console.warn('MFA Warning:', response.data.warning);
        }

        onSuccess(response.data.token, response.data.user);
      } else {
        setError(response.error?.message || 'Verification failed');
        setCode('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits for OTP, or alphanumeric + dash for backup codes
    const value = selectedMethod === 'backup'
      ? e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
      : e.target.value.replace(/[^0-9]/g, '');
    setCode(value);
  };

  const getMethodIcon = (method: MFAMethod | 'backup') => {
    switch (method) {
      case 'totp':
        return <DevicePhoneMobileIcon className="h-5 w-5" />;
      case 'email':
        return <EnvelopeIcon className="h-5 w-5" />;
      case 'backup':
        return <KeyIcon className="h-5 w-5" />;
    }
  };

  const getMethodLabel = (method: MFAMethod | 'backup') => {
    switch (method) {
      case 'totp':
        return t('mfa.authenticatorApp');
      case 'email':
        return t('mfa.emailCode');
      case 'backup':
        return t('mfa.backupCode');
    }
  };

  const getMethodDescription = (method: MFAMethod | 'backup') => {
    switch (method) {
      case 'totp':
        return t('mfa.totpDescription');
      case 'email':
        return codeSent
          ? t('mfa.emailDescriptionSent')
          : t('mfa.emailDescriptionPending');
      case 'backup':
        return t('mfa.backupDescription');
    }
  };

  const availableMethods: (MFAMethod | 'backup')[] = [...methods, 'backup'];

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="ml-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t('mfa.title')}
        </h2>
      </div>

      {/* Method Selection */}
      {availableMethods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {availableMethods.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => {
                setSelectedMethod(method);
                setCode('');
                setError(null);
                if (method === 'email') {
                  setCodeSent(false);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMethod === method
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {getMethodIcon(method)}
              {getMethodLabel(method)}
            </button>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {getMethodDescription(selectedMethod)}
      </p>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50/80 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Verification Form */}
      <form onSubmit={handleVerify} className="space-y-4">
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder={
              selectedMethod === 'backup' ? 'XXXX-XXXX' : '000000'
            }
            required
            disabled={isLoading || (selectedMethod === 'email' && isSendingCode)}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern={selectedMethod === 'backup' ? '[A-Z0-9]{4}-[A-Z0-9]{4}' : '[0-9]{6}'}
            maxLength={selectedMethod === 'backup' ? 9 : 6}
            className="w-full text-center text-2xl tracking-widest font-mono bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 focus:border-primary-500 focus:ring-0 transition-colors"
          />
        </div>

        {/* Trust Device Checkbox */}
        <div className="flex items-center">
          <Checkbox
            id="trust-device"
            checked={trustDevice}
            onChange={setTrustDevice}
            className="mr-2"
          />
          <label
            htmlFor="trust-device"
            className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
          >
            {t('mfa.trustDevice')}
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium text-base transition-colors"
          disabled={isLoading || !code.trim()}
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              {t('mfa.verifying')}
            </>
          ) : (
            t('mfa.verify')
          )}
        </Button>

        {/* Resend email code */}
        {selectedMethod === 'email' && codeSent && (
          <button
            type="button"
            onClick={handleSendEmailCode}
            disabled={isSendingCode}
            className="w-full text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            {isSendingCode ? t('mfa.sendingCode') : t('mfa.resendCode')}
          </button>
        )}
      </form>
    </div>
  );
}

// Helper functions for device identification
function generateDeviceId(): string {
  // Generate a consistent device fingerprint
  const stored = localStorage.getItem('trokky_device_id');
  if (stored) return stored;

  const id = crypto.randomUUID();
  localStorage.setItem('trokky_device_id', id);
  return id;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown';

  // Detect browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}
