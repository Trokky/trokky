import { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { useT } from '@trokky/trokky/i18n';

export type ViewType = 'list' | 'grid' | 'table' | 'calendar' | 'kanban';

export interface ViewConfig {
  type: ViewType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

export interface FilterConfig {
  id: string;
  label: string;
  field: string;
  type: 'text' | 'select' | 'date' | 'boolean';
  options?: Array<{ label: string; value: any }>;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  label: string;
}

export interface ContentViewControlsProps {
  // View configuration
  availableViews: ViewConfig[];
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  
  // Filters
  availableFilters: FilterConfig[];
  activeFilters: Record<string, any>;
  onFilterChange: (filterId: string, value: any) => void;
  onClearFilters: () => void;
  
  // Sorting
  availableSorts: SortConfig[];
  currentSort: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  
  // Actions
  onCreateNew?: () => void;
  createNewLabel?: string;
  
  // Item count
  totalItems?: number;
  selectedItems?: number;
  
  // Bulk actions
  bulkActions?: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
  }>;
  onBulkAction?: (actionId: string) => void;
}

export function ContentViewControls({
  availableViews,
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  availableFilters,
  activeFilters,
  onFilterChange,
  onClearFilters,
  availableSorts,
  currentSort,
  onSortChange,
  onCreateNew,
  createNewLabel,
  totalItems = 0,
  selectedItems = 0,
  bulkActions = [],
  onBulkAction
}: ContentViewControlsProps) {
  const { t } = useT('studio');
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const effectiveSearchPlaceholder = searchPlaceholder || t('nav.searchPlaceholder');
  const effectiveCreateLabel = createNewLabel || t('common.create');

  const activeFilterCount = Object.values(activeFilters).filter(v =>
    v !== undefined && v !== null && v !== ''
  ).length;

  const hasActiveFilters = activeFilterCount > 0;

  // Handle click outside to close sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSorts(false);
      }
    };

    if (showSorts) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSorts]);
  
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Main controls bar */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Search and filters */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={effectiveSearchPlaceholder}
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter toggle */}
            {availableFilters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  hasActiveFilters && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                )}
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                {t('contentView.filters')}
                {activeFilterCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200 rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            )}

            {/* Sort dropdown */}
            {availableSorts.length > 0 && (
              <div ref={sortDropdownRef} className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSorts(!showSorts)}
                  className={cn(
                    currentSort && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                  )}
                >
                  <ArrowsUpDownIcon className="h-4 w-4 mr-2" />
                  {t('contentView.sort')}
                  {currentSort && (
                    <span className="ml-2 text-xs">
                      {availableSorts.find(s => s.field === currentSort.field)?.label || currentSort.field}
                    </span>
                  )}
                </Button>

                {showSorts && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                    <div className="py-1">
                      {availableSorts.map((sort) => (
                        <div key={sort.field}>
                          <button
                            onClick={() => {
                              onSortChange(sort.field, 'asc');
                              setShowSorts(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700",
                              currentSort?.field === sort.field && currentSort?.direction === 'asc' &&
                              "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                            )}
                          >
                            {t('contentView.sortAsc', { label: sort.label })}
                          </button>
                          <button
                            onClick={() => {
                              onSortChange(sort.field, 'desc');
                              setShowSorts(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700",
                              currentSort?.field === sort.field && currentSort?.direction === 'desc' &&
                              "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                            )}
                          >
                            {t('contentView.sortDesc', { label: sort.label })}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {t('contentView.clearAll')}
              </Button>
            )}
          </div>
          
          {/* Right side - View switcher and actions */}
          <div className="flex items-center space-x-4">
            {/* Item count */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedItems > 0 ? (
                <span>
                  {t('contentView.selectedOfTotal', { selected: selectedItems, total: totalItems, count: selectedItems })}
                </span>
              ) : (
                <span>
                  {t('contentView.itemsCount', { count: totalItems })}
                </span>
              )}
            </div>
            
            {/* Bulk actions */}
            {selectedItems > 0 && bulkActions.length > 0 && (
              <div className="flex items-center space-x-2">
                {bulkActions.map((action) => (
                  <Button
                    key={action.id}
                    size="sm"
                    variant={action.variant === 'destructive' ? 'outline' : 'outline'}
                    onClick={() => onBulkAction?.(action.id)}
                    disabled={action.disabled}
                    className={cn(
                      action.variant === 'destructive' && 
                      "text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:border-red-700"
                    )}
                  >
                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
            
            {/* View switcher - only show when there are multiple views */}
            {availableViews.filter(v => v.enabled).length > 1 && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {availableViews.filter(v => v.enabled).map((view) => (
                  <button
                    key={view.type}
                    onClick={() => onViewChange(view.type)}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      currentView === view.type
                        ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                    title={view.title}
                  >
                    <view.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            )}
            
            {/* Create new button */}
            {onCreateNew && (
              <Button onClick={onCreateNew}>
                <PlusIcon className="h-4 w-4 mr-2" />
                {effectiveCreateLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Filters panel */}
      {showFilters && availableFilters.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableFilters.map((filter) => (
              <div key={filter.id}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {filter.label}
                </label>
                {filter.type === 'text' && (
                  <input
                    type="text"
                    value={activeFilters[filter.id] || ''}
                    onChange={(e) => onFilterChange(filter.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={t('contentView.filterBy', { label: filter.label.toLowerCase() })}
                  />
                )}
                {filter.type === 'select' && (
                  <select
                    value={activeFilters[filter.id] || ''}
                    onChange={(e) => onFilterChange(filter.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('contentView.allLabel', { label: filter.label })}</option>
                    {filter.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {filter.type === 'boolean' && (
                  <select
                    value={activeFilters[filter.id] || ''}
                    onChange={(e) => onFilterChange(filter.id, e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('contentView.all')}</option>
                    <option value="true">{t('contentView.yes')}</option>
                    <option value="false">{t('contentView.no')}</option>
                  </select>
                )}
                {filter.type === 'date' && (
                  <input
                    type="date"
                    value={activeFilters[filter.id] || ''}
                    onChange={(e) => onFilterChange(filter.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}