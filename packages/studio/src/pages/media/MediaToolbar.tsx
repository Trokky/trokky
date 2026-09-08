import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ViewColumnsIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useT } from '@trokky/trokky/i18n';
import type { SortDirection, SortField, ViewMode } from './types';

interface MediaToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onToggleFilterSidebar: () => void;
  sortBy: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * Search, sort, page size and the grid/list switch.
 */
export function MediaToolbar({
  searchQuery,
  onSearchQueryChange,
  onToggleFilterSidebar,
  sortBy,
  sortDirection,
  onSortChange,
  itemsPerPage,
  onItemsPerPageChange,
  viewMode,
  onViewModeChange,
}: MediaToolbarProps) {
  const { t } = useT('studio');

  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-4">
      {/* Search */}
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder={t('media.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {/* Filter toggle for mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onToggleFilterSidebar}
        >
          <FunnelIcon className="h-4 w-4" />
        </Button>

        {/* Sort dropdown */}
        <select
          value={`${sortBy}-${sortDirection}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split('-') as [SortField, SortDirection];
            onSortChange(field, dir);
          }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="date-desc">{t('media.sort.dateDesc')}</option>
          <option value="date-asc">{t('media.sort.dateAsc')}</option>
          <option value="name-asc">{t('media.sort.nameAsc')}</option>
          <option value="name-desc">{t('media.sort.nameDesc')}</option>
          <option value="size-desc">{t('media.sort.sizeDesc')}</option>
          <option value="size-asc">{t('media.sort.sizeAsc')}</option>
        </select>

        {/* Items per page selector */}
        <select
          value={itemsPerPage}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            onItemsPerPageChange(value);
          }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="28">28 {t('media.perPage')}</option>
          <option value="56">56 {t('media.perPage')}</option>
          <option value="84">84 {t('media.perPage')}</option>
          <option value="112">112 {t('media.perPage')}</option>
        </select>

        {/* View mode toggle */}
        <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-3 py-2 text-sm transition-colors ${
              viewMode === 'grid'
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <ViewColumnsIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-2 text-sm transition-colors border-l border-gray-200 dark:border-gray-600 ${
              viewMode === 'list'
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Bars3Icon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
