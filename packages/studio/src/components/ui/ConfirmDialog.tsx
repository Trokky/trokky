import React, { useState, useEffect, useCallback } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useT } from '@trokky/trokky/i18n';
import { Dialog } from './Dialog.js';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onCancel
}) => {
  const { t } = useT('studio');
  const resolvedConfirmText = confirmText || t('confirmDialog.defaultConfirm');
  const resolvedCancelText = cancelText || t('confirmDialog.defaultCancel');

  const styles =
    variant === 'danger'
      ? {
          icon: <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />,
          iconBg: 'bg-red-100 dark:bg-red-900/20',
          confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
        }
      : {
          icon: <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />,
          iconBg: 'bg-amber-100 dark:bg-amber-900/20',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
        };

  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      variant="center"
      size="md"
      ariaLabel={title || message}
    >
      <Dialog.Body padded={false} className="px-4 pb-4 pt-5 sm:p-6">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={resolvedCancelText}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="sm:flex sm:items-start">
          {/* Icon */}
          <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${styles.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
            {styles.icon}
          </div>

          {/* Content */}
          <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
            {title && (
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            <div className="mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm sm:w-auto ${styles.confirmButton} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
          >
            {resolvedConfirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {resolvedCancelText}
          </button>
        </div>
      </Dialog.Body>
    </Dialog>
  );
};

interface ConfirmationState {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  resolve?: (value: boolean) => void;
}

export const ConfirmDialogContainer: React.FC = () => {
  const [confirmState, setConfirmState] = useState<ConfirmationState>({
    isOpen: false,
    message: ''
  });

  useEffect(() => {
    const handleConfirmRequest = (event: CustomEvent<{
      message: string;
      title?: string;
      confirmText?: string;
      cancelText?: string;
      variant?: 'default' | 'danger';
      resolve: (value: boolean) => void;
    }>) => {
      const { message, title, confirmText, cancelText, variant, resolve } = event.detail;
      
      setConfirmState({
        isOpen: true,
        message,
        title,
        confirmText,
        cancelText,
        variant,
        resolve
      });
    };

    window.addEventListener('studio:confirm', handleConfirmRequest as EventListener);

    return () => {
      window.removeEventListener('studio:confirm', handleConfirmRequest as EventListener);
    };
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.resolve?.(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState.resolve]);

  const handleCancel = useCallback(() => {
    confirmState.resolve?.(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState.resolve]);

  return (
    <ConfirmDialog
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      variant={confirmState.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
};

export default ConfirmDialog;