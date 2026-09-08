/**
 * FieldDrawer - right-hand drawer for editing a top-level complex field.
 *
 * Shared by ObjectField and ArrayField, which previously carried identical
 * hand-rolled drawers.
 */

import React from 'react';
import { useT } from '@trokky/trokky/i18n';
import { Dialog } from '@/components/ui/Dialog.js';

export interface FieldDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Function to close the drawer */
  onClose: () => void;
  /** Drawer heading */
  title: React.ReactNode;
  /** Optional text rendered next to the heading */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export function FieldDrawer({ isOpen, onClose, title, subtitle, children }: FieldDrawerProps) {
  const { t } = useT('fields');

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      variant="drawer-right"
      size="lg"
      surface="bg-white dark:bg-gray-900"
      ariaLabel={typeof title === 'string' ? title : undefined}
    >
      <Dialog.Header className="bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</span>
          )}
        </div>
      </Dialog.Header>

      <Dialog.Body padded={false} className="px-6 py-6">
        {children}
      </Dialog.Body>

      <Dialog.Footer className="bg-gray-50 dark:bg-gray-800/50">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {t('modal.done')}
        </button>
      </Dialog.Footer>
    </Dialog>
  );
}
