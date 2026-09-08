import { EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { formatFileSize } from '@/utils/format';
import { getBestPreviewVariant } from '@/utils/media';
import { getFileIcon, getVariantCount } from './mediaFilters';
import type { MediaFile, ViewMode } from './types';

interface MediaItemCardProps {
  file: MediaFile;
  viewMode: ViewMode;
  isSelected: boolean;
  canEdit: boolean;
  canDelete: boolean;
  getMediaUrl: (media: MediaFile, variant?: string) => string;
  onItemSelect: (id: string, selected: boolean, shiftKey?: boolean) => void;
  onOpenViewer: (file: MediaFile) => void;
  onEdit: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
}

/**
 * One file in the library, as a grid tile or as a list row.
 */
export function MediaItemCard({
  file,
  viewMode,
  isSelected,
  canEdit,
  canDelete,
  getMediaUrl,
  onItemSelect,
  onOpenViewer,
  onEdit,
  onDelete,
}: MediaItemCardProps) {
  const FileIcon = getFileIcon(file.contentType);
  const isImage = file.contentType.startsWith('image/');
  const variantCount = getVariantCount(file);

  if (viewMode === 'grid') {
    return (
      <div
        className={`group relative bg-white dark:bg-gray-800 rounded-lg border overflow-hidden hover:shadow-md transition-all cursor-pointer ${
          isSelected
            ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg'
            : 'border-gray-200 dark:border-gray-700'
        }`}
        onClick={(e) => {
          if (e.shiftKey && canDelete) {
            e.preventDefault();
            onItemSelect(file.id, true, true);
          } else {
            onOpenViewer(file);
          }
        }}
      >
        {/* Checkbox - always visible when delete permission */}
        {canDelete && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onChange={(checked) => onItemSelect(file.id, checked)}
              aria-label={`Select ${file.metadata?.title || file.filename}`}
            />
          </div>
        )}

        <div className="aspect-square flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          {isImage ? (
            <img
              src={getMediaUrl(file, getBestPreviewVariant(file))}
              alt={file.metadata?.alt || file.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <FileIcon className="h-12 w-12 text-gray-400" />
          )}
        </div>

        {/* Variant count badge */}
        {variantCount > 0 && (
          <div className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded-full">
            {variantCount}
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewer(file);
              }}
            >
              <EyeIcon className="h-4 w-4" />
            </Button>
            {(canEdit || canDelete) && (
              <>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(file);
                    }}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(file);
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {file.metadata?.title || file.filename}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div
        className={`flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-sm transition-all cursor-pointer ${
          isSelected
            ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg'
            : 'border-gray-200 dark:border-gray-700'
        }`}
        onClick={(e) => {
          if (e.shiftKey && canDelete) {
            e.preventDefault();
            onItemSelect(file.id, true, true);
          } else {
            onOpenViewer(file);
          }
        }}
      >
        {/* Checkbox for list view */}
        {canDelete && (
          <div
            className="flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onChange={(checked) => onItemSelect(file.id, checked)}
              aria-label={`Select ${file.metadata?.title || file.filename}`}
            />
          </div>
        )}

        <div className="flex-shrink-0">
          {isImage ? (
            <img
              src={getMediaUrl(file, getBestPreviewVariant(file))}
              alt={file.metadata?.alt || file.filename}
              className="w-12 h-12 object-cover rounded"
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
              <FileIcon className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {file.metadata?.title || file.filename}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(file.size)} • {file.contentType}
          </p>
          {file.metadata?.alt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {file.metadata.alt}
            </p>
          )}
        </div>

        {(canEdit || canDelete) && (
          <div className="flex space-x-1">
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(file);
                }}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file);
                }}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
}
