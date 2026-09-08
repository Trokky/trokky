import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useT } from '@trokky/trokky/i18n';

interface MediaBulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  isDeleting: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

/**
 * The strip that appears above the grid once files are ticked.
 */
export function MediaBulkActionsBar({
  selectedCount,
  totalCount,
  isDeleting,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
}: MediaBulkActionsBarProps) {
  const { t } = useT('studio');

  return (
    <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={selectedCount === totalCount}
            indeterminate={selectedCount > 0 && selectedCount < totalCount}
            onChange={onSelectAll}
            aria-label={t('common.selectAll')}
          />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {t('media.selected', { count: selectedCount })}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
        >
          {t('media.clearFilters')}
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          className="text-blue-600 dark:text-blue-400"
        >
          {selectedCount === totalCount ? t('common.deselectAll') : t('common.selectAll')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onBulkDelete}
          disabled={isDeleting}
        >
          <TrashIcon className="h-4 w-4 mr-2" />
          {isDeleting ? t('common.loading') : t('media.deleteSelected')}
        </Button>
      </div>
    </div>
  );
}
