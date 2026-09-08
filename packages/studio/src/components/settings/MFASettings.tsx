import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Dialog } from '@/components/ui/Dialog.js';
import { apiClient } from '@/services/api-client';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { useT } from '@trokky/trokky/i18n';
import type { MFAMethodType, MFAStatus, SetupStep, TrustedDevice } from './mfa/types';
import {
  TotpQrPanel,
  TotpVerifyPanel,
  EmailVerifyPanel,
  BackupCodesPanel,
} from './mfa/MFASetupPanels';
import { MFAMethodList } from './mfa/MFAMethodList';

interface MFASettingsProps {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function MFASettings({ onToast }: MFASettingsProps) {
  const { t } = useT('studio');
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [totpSetupData, setTotpSetupData] = useState<{
    qrCode: string;
    manualEntryKey: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [showTrustedDevices, setShowTrustedDevices] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableDialog, setShowDisableDialog] = useState<MFAMethodType | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [showDisableAllDialog, setShowDisableAllDialog] = useState(false);
  const [disableAllPassword, setDisableAllPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toast = onToast || ((msg, type) => console.log(`${type}: ${msg}`));

  // Load MFA status on mount
  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{ data: MFAStatus }>('/auth/mfa/status');
      if (response.success && response.data) {
        setMfaStatus(response.data.data || response.data as any);
      }
    } catch (err) {
      console.error('Failed to load MFA status:', err);
      toast(t('mfa.toast.loadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrustedDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const response = await apiClient.get<{ data: { devices: TrustedDevice[] } }>('/auth/mfa/trusted-devices');
      if (response.success && response.data) {
        // Handle both response structures: { data: { devices: [...] } } and { devices: [...] }
        const data = response.data as any;
        const devices = data.data?.devices || data.devices || [];
        setTrustedDevices(devices);
      }
    } catch (err) {
      console.error('Failed to load trusted devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // TOTP Setup
  const initTOTPSetup = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post<{ data: { qrCode: string; manualEntryKey: string } }>('/auth/mfa/setup/totp', {});
      if (response.success && response.data) {
        setTotpSetupData(response.data.data || response.data as any);
        setSetupStep('totp-qr');
      } else {
        throw new Error(response.error?.message || 'Failed to initialize TOTP setup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.toast.totpInitFailed'));
      toast(t('mfa.toast.totpInitFailed'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyTOTPSetup = async () => {
    if (!verificationCode.trim()) {
      setError(t('mfa.enterCode'));
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post<{ backupCodes?: string[] }>('/auth/mfa/setup/totp/verify', {
        code: verificationCode.trim(),
      });

      if (response.success) {
        const data = response.data as any;
        if (data.backupCodes) {
          setBackupCodes(data.backupCodes);
          setSetupStep('backup-codes');
        } else {
          setSetupStep('idle');
          await loadMFAStatus();
        }
        toast(t('mfa.toast.totpEnabled'), 'success');
      } else {
        throw new Error(response.error?.message || 'Invalid verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.verifying'));
    } finally {
      setIsProcessing(false);
      setVerificationCode('');
    }
  };

  // Email OTP Setup
  const initEmailOTPSetup = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post('/auth/mfa/setup/email', {});
      if (response.success) {
        setSetupStep('email-verify');
        toast(t('mfa.toast.emailCodeSent'), 'success');
      } else {
        throw new Error(response.error?.message || t('mfa.toast.emailSendFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.toast.emailSendFailed'));
      toast(t('mfa.toast.emailSendFailed'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyEmailOTPSetup = async () => {
    if (!verificationCode.trim()) {
      setError(t('mfa.enterCode'));
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post<{ backupCodes?: string[] }>('/auth/mfa/setup/email/verify', {
        code: verificationCode.trim(),
      });

      if (response.success) {
        const data = response.data as any;
        if (data.backupCodes) {
          setBackupCodes(data.backupCodes);
          setSetupStep('backup-codes');
        } else {
          setSetupStep('idle');
          await loadMFAStatus();
        }
        toast(t('mfa.toast.emailEnabled'), 'success');
      } else {
        throw new Error(response.error?.message || 'Invalid verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.verifying'));
    } finally {
      setIsProcessing(false);
      setVerificationCode('');
    }
  };

  // Disable MFA Method
  const disableMFAMethod = async (method: MFAMethodType) => {
    if (!disablePassword) {
      setError(t('mfa.errors.passwordRequired'));
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post('/auth/mfa/disable', {
        method,
        password: disablePassword,
      });

      if (response.success) {
        setShowDisableDialog(null);
        setDisablePassword('');
        await loadMFAStatus();
        toast(method === 'totp' ? t('mfa.toast.authenticatorDisabled') : t('mfa.toast.emailDisabled'), 'success');
      } else {
        throw new Error(response.error?.message || 'Failed to disable MFA');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setIsProcessing(false);
    }
  };

  // Disable All MFA
  const disableAllMFA = async () => {
    if (!disableAllPassword) {
      setError(t('mfa.errors.passwordRequired'));
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post('/auth/mfa/disable-all', {
        password: disableAllPassword,
      });

      if (response.success) {
        setShowDisableAllDialog(false);
        setDisableAllPassword('');
        await loadMFAStatus();
        toast(t('mfa.toast.allDisabled'), 'success');
      } else {
        throw new Error(response.error?.message || 'Failed to disable MFA');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setIsProcessing(false);
    }
  };

  // Regenerate Backup Codes
  const regenerateBackupCodes = async () => {
    if (!regeneratePassword) {
      setError(t('mfa.errors.passwordRequired'));
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const response = await apiClient.post<{ backupCodes: string[] }>('/auth/mfa/backup-codes/regenerate', {
        password: regeneratePassword,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        setBackupCodes(data.backupCodes || []);
        setShowBackupCodes(true);
        setShowRegenerateDialog(false);
        setRegeneratePassword('');
        await loadMFAStatus();
        toast(t('mfa.toast.backupCodesRegenerated'), 'success');
      } else {
        throw new Error(response.error?.message || 'Failed to regenerate backup codes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate backup codes');
    } finally {
      setIsProcessing(false);
    }
  };

  // Revoke Trusted Device
  const revokeTrustedDevice = async (deviceId: string) => {
    try {
      const response = await apiClient.delete(`/auth/mfa/trusted-devices/${deviceId}`);
      if (response.success) {
        setTrustedDevices(prev => prev.filter(d => d.id !== deviceId));
        await loadMFAStatus();
        toast(t('mfa.toast.deviceRevoked'), 'success');
      }
    } catch (err) {
      toast(t('mfa.toast.deviceRevokeFailed'), 'error');
    }
  };

  const revokeAllTrustedDevices = async () => {
    if (!confirm(t('mfa.trustedDevice.confirmRevokeAll'))) return;

    try {
      const response = await apiClient.delete('/auth/mfa/trusted-devices');
      if (response.success) {
        setTrustedDevices([]);
        await loadMFAStatus();
        toast(t('mfa.toast.allDevicesRevoked'), 'success');
      }
    } catch (err) {
      toast(t('mfa.toast.allDevicesRevokeFailed'), 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(t('mfa.copiedToClipboard'), 'info');
  };

  const cancelSetup = () => {
    setSetupStep('idle');
    setTotpSetupData(null);
    setVerificationCode('');
    setError(null);
  };

  const finishBackupCodesSetup = () => {
    setSetupStep('idle');
    setBackupCodes([]);
    loadMFAStatus();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const totpMethod = mfaStatus?.methods.find(m => m.type === 'totp');
  const emailMethod = mfaStatus?.methods.find(m => m.type === 'email');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheckIcon className="h-6 w-6 text-primary-500" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('mfa.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('mfa.subtitle')}
          </p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        {mfaStatus?.enabled ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircleIcon className="h-4 w-4" />
            {t('mfa.enabled')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <ExclamationTriangleIcon className="h-4 w-4" />
            {t('mfa.notEnabled')}
          </span>
        )}
      </div>

      {/* Setup Steps */}
      {setupStep === 'totp-qr' && totpSetupData && (
        <TotpQrPanel
          totpSetupData={totpSetupData}
          onCopy={copyToClipboard}
          onCancel={cancelSetup}
          onNext={() => setSetupStep('totp-verify')}
        />
      )}

      {setupStep === 'totp-verify' && (
        <TotpVerifyPanel
          verificationCode={verificationCode}
          onVerificationCodeChange={setVerificationCode}
          error={error}
          isProcessing={isProcessing}
          onCancel={cancelSetup}
          onVerify={verifyTOTPSetup}
        />
      )}

      {setupStep === 'email-verify' && (
        <EmailVerifyPanel
          verificationCode={verificationCode}
          onVerificationCodeChange={setVerificationCode}
          error={error}
          isProcessing={isProcessing}
          onCancel={cancelSetup}
          onVerify={verifyEmailOTPSetup}
        />
      )}

      {setupStep === 'backup-codes' && backupCodes.length > 0 && (
        <BackupCodesPanel
          backupCodes={backupCodes}
          onCopy={copyToClipboard}
          onDone={finishBackupCodesSetup}
        />
      )}

      {/* Methods List (when not in setup) */}
      {setupStep === 'idle' && (
        <MFAMethodList
          mfaStatus={mfaStatus}
          totpMethod={totpMethod}
          emailMethod={emailMethod}
          isProcessing={isProcessing}
          showTrustedDevices={showTrustedDevices}
          trustedDevices={trustedDevices}
          isLoadingDevices={isLoadingDevices}
          onSetupTOTP={initTOTPSetup}
          onSetupEmailOTP={initEmailOTPSetup}
          onDisableMethod={setShowDisableDialog}
          onRegenerateBackupCodes={() => setShowRegenerateDialog(true)}
          onToggleTrustedDevices={() => {
            setShowTrustedDevices(!showTrustedDevices);
            if (!showTrustedDevices) loadTrustedDevices();
          }}
          onRevokeTrustedDevice={revokeTrustedDevice}
          onRevokeAllTrustedDevices={revokeAllTrustedDevices}
          onDisableAll={() => setShowDisableAllDialog(true)}
        />
      )}

      {/* Disable Dialog */}
      {showDisableDialog && (
        <Dialog
          open
          onClose={() => {
            setShowDisableDialog(null);
            setDisablePassword('');
            setError(null);
          }}
          variant="center"
          size="sm"
          title={showDisableDialog === 'totp' ? t('mfa.disableDialog.authenticator') : t('mfa.disableDialog.email')}
        >
          <Dialog.Body>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('mfa.disableDialog.enterPassword')}
            </p>
            {error && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <Input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Password"
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDisableDialog(null);
                  setDisablePassword('');
                  setError(null);
                }}
              >
                {t('mfa.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => disableMFAMethod(showDisableDialog)}
                disabled={isProcessing || !disablePassword}
              >
                {isProcessing ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                {t('mfa.disableMethod')}
              </Button>
            </div>
          </Dialog.Body>
        </Dialog>
      )}

      {/* Regenerate Backup Codes Dialog */}
      {showRegenerateDialog && (
        <Dialog
          open
          onClose={() => {
            setShowRegenerateDialog(false);
            setRegeneratePassword('');
            setError(null);
          }}
          variant="center"
          size="sm"
          title={t('mfa.regenerateBackupCodes.title')}
        >
          <Dialog.Body>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('mfa.regenerateBackupCodes.description')}
            </p>
            {error && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <Input
              type="password"
              value={regeneratePassword}
              onChange={(e) => setRegeneratePassword(e.target.value)}
              placeholder="Password"
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRegenerateDialog(false);
                  setRegeneratePassword('');
                  setError(null);
                }}
              >
                {t('mfa.cancel')}
              </Button>
              <Button
                onClick={regenerateBackupCodes}
                disabled={isProcessing || !regeneratePassword}
              >
                {isProcessing ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                {t('mfa.regenerate')}
              </Button>
            </div>
          </Dialog.Body>
        </Dialog>
      )}

      {/* Show Backup Codes Dialog (after regeneration) */}
      {showBackupCodes && backupCodes.length > 0 && (
        <Dialog
          open
          onClose={() => {
            setShowBackupCodes(false);
            setBackupCodes([]);
          }}
          variant="center"
          size="md"
          title={t('mfa.setup.newBackupCodes')}
        >
          <Dialog.Body>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('mfa.setup.newBackupCodesImportant')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded">
                {backupCodes.map((code, idx) => (
                  <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded text-center">
                    {code}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(backupCodes.join('\n'))}
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                  {t('mfa.copyAll')}
                </Button>
                <Button
                  onClick={() => {
                    setShowBackupCodes(false);
                    setBackupCodes([]);
                  }}
                >
                  {t('mfa.done')}
                </Button>
              </div>
            </div>
          </Dialog.Body>
        </Dialog>
      )}

      {/* Disable All MFA Dialog */}
      {showDisableAllDialog && (
        <Dialog
          open
          onClose={() => {
            setShowDisableAllDialog(false);
            setDisableAllPassword('');
            setError(null);
          }}
          variant="center"
          size="sm"
          ariaLabel={t('mfa.disableDialog.all')}
        >
          <Dialog.Header>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              {t('mfa.disableDialog.all')}
            </h3>
          </Dialog.Header>
          <Dialog.Body>
            <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                {t('mfa.disableDialog.allWarning')}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('mfa.disableDialog.confirmPassword')}
            </p>
            {error && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <Input
              type="password"
              value={disableAllPassword}
              onChange={(e) => setDisableAllPassword(e.target.value)}
              placeholder="Password"
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDisableAllDialog(false);
                  setDisableAllPassword('');
                  setError(null);
                }}
              >
                {t('mfa.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={disableAllMFA}
                disabled={isProcessing || !disableAllPassword}
              >
                {isProcessing ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                {t('mfa.disableDialog.all')}
              </Button>
            </div>
          </Dialog.Body>
        </Dialog>
      )}
    </div>
  );
}
