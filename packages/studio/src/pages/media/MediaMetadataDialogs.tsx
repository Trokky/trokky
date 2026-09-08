import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useT } from '@trokky/trokky/i18n';
import type { MediaFile } from './types';

/**
 * The three metadata modals: edit a file's title and alt text, confirm a
 * single delete, confirm a bulk delete.
 */

interface MediaEditModalProps {
  isOpen: boolean;
  editingFile: MediaFile;
  onEditingFileChange: (file: MediaFile) => void;
  onClose: () => void;
  onSave: () => void;
}

export function MediaEditModal({
  isOpen,
  editingFile,
  onEditingFileChange,
  onClose,
  onSave,
}: MediaEditModalProps) {
  const { t } = useT('studio');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('media.editMetadata')}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.title') || 'Title'}
          </label>
          <Input
            value={editingFile.metadata?.title || ''}
            onChange={(e) => onEditingFileChange({
              ...editingFile,
              metadata: { ...editingFile.metadata, title: e.target.value }
            })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Alt Text
          </label>
          <Input
            value={editingFile.metadata?.alt || ''}
            onChange={(e) => onEditingFileChange({
              ...editingFile,
              metadata: { ...editingFile.metadata, alt: e.target.value }
            })}
          />
        </div>
        <div className="flex space-x-3 pt-4">
          <Button onClick={onSave} className="flex-1">
            {t('common.save')}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface MediaDeleteModalProps {
  isOpen: boolean;
  editingFile: MediaFile;
  onClose: () => void;
  onConfirm: () => void;
}

export function MediaDeleteModal({
  isOpen,
  editingFile,
  onClose,
  onConfirm,
}: MediaDeleteModalProps) {
  const { t } = useT('studio');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('media.delete')}
    >
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-1" />
          <div>
            <p className="text-gray-900 dark:text-white">
              {t('media.confirmDelete')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              <strong>{editingFile.metadata?.title || editingFile.filename}</strong>
            </p>
          </div>
        </div>
        <div className="flex space-x-3 pt-4">
          <Button
            variant="danger"
            onClick={onConfirm}
            className="flex-1"
          >
            {t('common.delete')}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface MediaBulkDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function MediaBulkDeleteModal({
  isOpen,
  selectedCount,
  isDeleting,
  onClose,
  onConfirm,
}: MediaBulkDeleteModalProps) {
  const { t } = useT('studio');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('media.deleteSelected')}
    >
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-1" />
          <div>
            <p className="text-gray-900 dark:text-white">
              {t('media.confirmBulkDelete', { count: selectedCount })}
            </p>
          </div>
        </div>
        <div className="flex space-x-3 pt-4">
          <Button
            variant="danger"
            onClick={onConfirm}
            className="flex-1"
            disabled={isDeleting}
          >
            {isDeleting ? t('common.loading') : t('common.delete')}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
