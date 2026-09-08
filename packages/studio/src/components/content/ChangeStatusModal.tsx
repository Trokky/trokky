import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog.js';
import { cn } from '@/utils/cn';
import { useT } from '@trokky/trokky/i18n';

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

  const handleConfirm = async () => {
    await onConfirm(selectedStatus);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      variant="center"
      size="sm"
      title={t('changeStatus.title')}
    >
      <Dialog.Body>
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
      </Dialog.Body>

      <Dialog.Footer>
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
      </Dialog.Footer>
    </Dialog>
  );
}
