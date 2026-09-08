import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useT } from '@trokky/trokky/i18n';

/**
 * The in-place panels that walk an editor through enrolment. They render the
 * step; MFASettings owns the state and the requests.
 */

interface TotpQrPanelProps {
  totpSetupData: { qrCode: string; manualEntryKey: string };
  onCopy: (text: string) => void;
  onCancel: () => void;
  onNext: () => void;
}

export function TotpQrPanel({
  totpSetupData,
  onCopy,
  onCancel,
  onNext,
}: TotpQrPanelProps) {
  const { t } = useT('studio');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="font-medium text-gray-900 dark:text-white mb-4">
        {t('mfa.setup.authenticator')}
      </h4>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('mfa.setup.scanQrCode')}
        </p>
        <div className="flex justify-center">
          <img
            src={totpSetupData.qrCode}
            alt="TOTP QR Code"
            className="w-48 h-48 bg-white p-2 rounded"
          />
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('mfa.setup.orEnterManually')}
          </p>
          <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded font-mono text-sm">
            {totpSetupData.manualEntryKey}
            <button
              onClick={() => onCopy(totpSetupData.manualEntryKey)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t('mfa.cancel')}
          </Button>
          <Button onClick={onNext}>
            {t('mfa.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface VerifyPanelProps {
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  error: string | null;
  isProcessing: boolean;
  onCancel: () => void;
  onVerify: () => void;
}

export function TotpVerifyPanel({
  verificationCode,
  onVerificationCodeChange,
  error,
  isProcessing,
  onCancel,
  onVerify,
}: VerifyPanelProps) {
  const { t } = useT('studio');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="font-medium text-gray-900 dark:text-white mb-4">
        {t('mfa.setup.verifyAuthenticatorCode')}
      </h4>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('mfa.setup.enterCodeToVerify')}
        </p>
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <Input
          type="text"
          value={verificationCode}
          onChange={(e) => onVerificationCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="text-center text-2xl tracking-widest font-mono"
          maxLength={6}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t('mfa.cancel')}
          </Button>
          <Button onClick={onVerify} disabled={isProcessing || verificationCode.length !== 6}>
            {isProcessing ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            {t('mfa.verify')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmailVerifyPanel({
  verificationCode,
  onVerificationCodeChange,
  error,
  isProcessing,
  onCancel,
  onVerify,
}: VerifyPanelProps) {
  const { t } = useT('studio');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="font-medium text-gray-900 dark:text-white mb-4">
        {t('mfa.setup.verifyEmailCode')}
      </h4>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('mfa.setup.enterEmailCode')}
        </p>
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <Input
          type="text"
          value={verificationCode}
          onChange={(e) => onVerificationCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="text-center text-2xl tracking-widest font-mono"
          maxLength={6}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t('mfa.cancel')}
          </Button>
          <Button onClick={onVerify} disabled={isProcessing || verificationCode.length !== 6}>
            {isProcessing ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            {t('mfa.verify')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BackupCodesPanelProps {
  backupCodes: string[];
  onCopy: (text: string) => void;
  onDone: () => void;
}

export function BackupCodesPanel({
  backupCodes,
  onCopy,
  onDone,
}: BackupCodesPanelProps) {
  const { t } = useT('studio');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="font-medium text-gray-900 dark:text-white mb-4">
        {t('mfa.setup.saveBackupCodes')}
      </h4>
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('mfa.setup.backupCodesImportant')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded">
          {backupCodes.map((code, idx) => (
            <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded">
              {code}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onCopy(backupCodes.join('\n'))}
          >
            <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
            {t('mfa.copyAll')}
          </Button>
          <Button onClick={onDone}>
            {t('mfa.done')}
          </Button>
        </div>
      </div>
    </div>
  );
}
