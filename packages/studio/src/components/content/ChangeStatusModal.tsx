import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { useT } from '@trokky/i18n';

export interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: string) => void | Promise<void>;
  selectedCount: number;
  loading?: boolean;
}

export function ChangeStatusModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  loading = false
}: ChangeStatusModalProps) {
  const { t } = useT('studio');
  const [selectedStatus, setSelectedStatus] = useState<string>('published');

  const STATUS_OPTIONS = [
    { value: 'draft', label: t('changeStatus.draft'), description: t('changeStatus.draftDesc') },
    { value: 'published', label: t('changeStatus.published'), description: t('changeStatus.publishedDesc') },
    { value: 'archived', label: t('changeStatus.archived'), description: t('changeStatus.archivedDesc') }
  ];

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm(selectedStatus);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('changeStatus.title')}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('changeStatus.selectStatus', { count: selectedCount })}
            </p>

            <div className="space-y-2">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all",
                    selectedStatus === option.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={selectedStatus === option.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? t('changeStatus.updating') : t('changeStatus.updateDocument', { count: selectedCount })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
