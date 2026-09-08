import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  KeyIcon,
  ComputerDesktopIcon,
  TrashIcon,
  ArrowPathIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useT } from '@trokky/trokky/i18n';
import type { MFAMethod, MFAMethodType, MFAStatus, TrustedDevice } from './types';

/**
 * The idle view: one row per method, plus backup codes, trusted devices and
 * the disable-everything block.
 */
interface MFAMethodListProps {
  mfaStatus: MFAStatus | null;
  totpMethod?: MFAMethod;
  emailMethod?: MFAMethod;
  isProcessing: boolean;
  showTrustedDevices: boolean;
  trustedDevices: TrustedDevice[];
  isLoadingDevices: boolean;
  onSetupTOTP: () => void;
  onSetupEmailOTP: () => void;
  onDisableMethod: (method: MFAMethodType) => void;
  onRegenerateBackupCodes: () => void;
  onToggleTrustedDevices: () => void;
  onRevokeTrustedDevice: (deviceId: string) => void;
  onRevokeAllTrustedDevices: () => void;
  onDisableAll: () => void;
}

export function MFAMethodList({
  mfaStatus,
  totpMethod,
  emailMethod,
  isProcessing,
  showTrustedDevices,
  trustedDevices,
  isLoadingDevices,
  onSetupTOTP,
  onSetupEmailOTP,
  onDisableMethod,
  onRegenerateBackupCodes,
  onToggleTrustedDevices,
  onRevokeTrustedDevice,
  onRevokeAllTrustedDevices,
  onDisableAll,
}: MFAMethodListProps) {
  const { t } = useT('studio');

  return (
    <div className="space-y-4">
      {/* Authenticator App */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DevicePhoneMobileIcon className="h-8 w-8 text-gray-400" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                {t('mfa.authenticatorApp')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('mfa.authenticatorAppDesc')}
              </p>
            </div>
          </div>
          {totpMethod?.enabled ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 dark:text-green-400">{t('mfa.enabled')}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onDisableMethod('totp')}
              >
                {t('mfa.disableMethod')}
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={onSetupTOTP} disabled={isProcessing}>
              {t('mfa.setUp')}
            </Button>
          )}
        </div>
      </div>

      {/* Email Verification */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <EnvelopeIcon className="h-8 w-8 text-gray-400" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                {t('mfa.emailVerification')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('mfa.emailVerificationDesc')}
              </p>
            </div>
          </div>
          {emailMethod?.enabled ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 dark:text-green-400">{t('mfa.enabled')}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onDisableMethod('email')}
              >
                {t('mfa.disableMethod')}
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={onSetupEmailOTP} disabled={isProcessing}>
              {t('mfa.setUp')}
            </Button>
          )}
        </div>
      </div>

      {/* Backup Codes */}
      {mfaStatus?.enabled && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyIcon className="h-8 w-8 text-gray-400" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {t('mfa.backupCodes')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('mfa.backupCodesRemaining', { count: mfaStatus.backupCodesRemaining })}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRegenerateBackupCodes}
              disabled={isProcessing}
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              {t('mfa.regenerate')}
            </Button>
          </div>
        </div>
      )}

      {/* Trusted Devices */}
      {mfaStatus?.enabled && mfaStatus.trustedDevicesCount > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ComputerDesktopIcon className="h-8 w-8 text-gray-400" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {t('mfa.trustedDevices')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('mfa.trustedDevicesCount', { count: mfaStatus.trustedDevicesCount })}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleTrustedDevices}
            >
              {showTrustedDevices ? t('mfa.hide') : t('mfa.manage')}
            </Button>
          </div>
          {showTrustedDevices && (
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {isLoadingDevices ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : trustedDevices.length > 0 ? (
                <>
                  {trustedDevices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('mfa.trustedDevice.trusted', { date: new Date(device.trustedAt).toLocaleDateString() })}
                        </p>
                      </div>
                      <button
                        onClick={() => onRevokeTrustedDevice(device.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {trustedDevices.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                      onClick={onRevokeAllTrustedDevices}
                    >
                      {t('mfa.revokeAll')}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  {t('common.loading')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disable All MFA Button */}
      {mfaStatus?.enabled && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">
                  {t('mfa.disable.all')}
                </h4>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t('mfa.disable.allDesc')}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={onDisableAll}
                disabled={isProcessing}
              >
                <XCircleIcon className="h-4 w-4 mr-1" />
                {t('mfa.disable.all')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
