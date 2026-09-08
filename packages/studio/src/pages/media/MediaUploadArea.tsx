import React from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useT } from '@trokky/trokky/i18n';

interface MediaUploadAreaProps {
  isDragging: boolean;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onUploadClick: () => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * The drop zone at the top of the library.
 */
export function MediaUploadArea({
  isDragging,
  isUploading,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onUploadClick,
  onFileInputChange,
}: MediaUploadAreaProps) {
  const { t } = useT('studio');

  return (
    <div className="mb-8">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <PhotoIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            <Button
              variant="ghost"
              className="text-primary-600 hover:text-primary-500"
              onClick={onUploadClick}
              disabled={isUploading}
            >
              {isUploading ? t('common.loading') : t('media.browseFiles')}
            </Button>{' '}
            {t('media.or')} {t('media.dragAndDrop')}
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            PNG, JPG, GIF, MP4, PDF up to 100MB
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
          onChange={onFileInputChange}
        />
      </div>
    </div>
  );
}
