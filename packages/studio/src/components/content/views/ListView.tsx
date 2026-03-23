import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { Checkbox } from '@/components/ui/Checkbox';
import { useStudioContext } from '@/contexts/StudioContext';
import { getSmartDocumentTitle, getDocumentValue } from '@/utils/documentTitle';
import { useT } from 'trokky/i18n';
import type { Document } from '@/types';

export interface ListColumn {
  key: string;
  title: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, document: Document) => React.ReactNode;
}

export interface ListViewProps {
  documents: Document[];
  columns: ListColumn[];
  schemaName: string;
  loading?: boolean;
  selectedItems: string[];
  onItemSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onDocumentAction?: (documentId: string, action: string) => void;
  /** Function to check if user can delete a specific document */
  canDelete?: (document: Document) => boolean;
}

export function ListView({
  documents,
  columns,
  schemaName,
  loading = false,
  selectedItems,
  onItemSelect,
  onSelectAll,
  sortField,
  sortDirection,
  onSort,
  onDocumentAction,
  canDelete
}: ListViewProps) {
  const { t } = useT('studio');
  const navigate = useNavigate();
  const studioContext = useStudioContext();
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);

  const allSelected = documents.length > 0 && selectedItems.length === documents.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < documents.length;
  
  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the specific dropdown that's open
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log('Click outside dropdown detected, closing dropdown');
        setActionsOpen(null);
      }
    };

    if (actionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [actionsOpen]);
  
  const handleSort = (column: ListColumn) => {
    if (!column.sortable || !onSort) return;

    // Smart field detection for title column - use actual field name from documents
    let fieldToSort = column.key;
    if (column.key === 'title' && documents && documents.length > 0) {
      // Check if documents have 'name' field, otherwise use 'title'
      fieldToSort = documents[0].name ? 'name' : 'title';
    }

    const newDirection = sortField === fieldToSort && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(fieldToSort, newDirection);
  };
  
  const formatValue = (value: any, column: ListColumn, doc: Document) => {
    if (column.render) {
      return column.render(value, doc);
    }
    
    // Special handling for title-like columns - use smart title logic
    if (column.key === 'title' || column.key === 'name') {
      const smartTitle = getSmartDocumentTitle(doc);
      if (smartTitle !== 'Untitled') {
        return smartTitle;
      }
    }
    
    if (value === null || value === undefined) {
      return <span className="text-gray-400">—</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <span className={cn(
          "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
          value
            ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
        )}>
          {value ? t('contentViews.yes') : t('contentViews.no')}
        </span>
      );
    }

    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return new Date(value).toLocaleDateString();
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : <span className="text-gray-400">{t('contentViews.empty')}</span>;
    }
    
    return String(value);
  };
  
  const getDocumentId = (doc: Document) => doc.id || doc._id;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('contentViews.loadingDocuments')}</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">{t('contentViews.noDocumentsFound')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={listRef} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {/* Selection column */}
              <th className="px-3 py-3 text-left w-8">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                />
              </th>
              
              {/* Data columns */}
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider",
                    column.sortable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600",
                    column.width && `w-${column.width}`,
                    // Set specific widths for columns
                    index === 0 && "w-96", // Title column gets more space
                    index === 1 && "w-24", // Status column
                    index === 2 && "w-24", // Created column
                    index === 3 && "w-24"  // Updated column
                  )}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        <ChevronUpIcon 
                          className={cn(
                            "h-3 w-3 -mb-1",
                            sortField === column.key && sortDirection === 'asc'
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-400"
                          )} 
                        />
                        <ChevronDownIcon 
                          className={cn(
                            "h-3 w-3",
                            sortField === column.key && sortDirection === 'desc'
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-400"
                          )} 
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
              
              {/* Actions column */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">
                {t('contentViews.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {documents.map((doc) => {
              const docId = getDocumentId(doc);
              const isSelected = selectedItems.includes(docId);
              
              return (
                <tr 
                  key={docId} 
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                    isSelected && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                >
                  {/* Selection cell */}
                  <td className="px-3 py-4 whitespace-nowrap">
                    <Checkbox
                      checked={isSelected}
                      onChange={(checked) => onItemSelect(docId, checked)}
                    />
                  </td>
                  
                  {/* Data cells */}
                  {columns.map((column) => {
                    const value = getDocumentValue(doc, column.key);
                    const isFirstColumn = column === columns[0];
                    
                    return (
                      <td key={column.key} className={cn("px-6 py-4", isFirstColumn ? "max-w-xs" : "whitespace-nowrap")}>
                        {isFirstColumn ? (
                          <button
                            onClick={() => navigate(`/content/${schemaName}/${docId}`)}
                            className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full"
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={String(formatValue(value, column, doc))}>
                              {formatValue(value, column, doc)}
                            </div>
                            {doc.slug && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={`/${doc.slug}`}>
                                /{doc.slug}
                              </div>
                            )}
                          </button>
                        ) : (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatValue(value, column, doc)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  
                  {/* Actions cell */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        ref={actionButtonRef}
                        onClick={(e) => {
                          if (actionsOpen === docId) {
                            setActionsOpen(null);
                            setDropdownPosition(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const dropdownHeight = 200; // Approximate height of dropdown
                            const dropdownWidth = 192; // w-48 = 192px
                            
                            // Calculate position, ensuring it stays within viewport
                            let top = rect.bottom + window.scrollY + 4;
                            let left = rect.right + window.scrollX - dropdownWidth;
                            
                            // Adjust if dropdown would go below viewport
                            if (rect.bottom + dropdownHeight > window.innerHeight) {
                              top = rect.top + window.scrollY - dropdownHeight - 4;
                            }
                            
                            // Adjust if dropdown would go beyond left edge
                            if (left < 0) {
                              left = rect.left + window.scrollX;
                            }
                            
                            setDropdownPosition({ top, left });
                            setActionsOpen(docId);
                          }
                        }}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </button>
                      
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Portal dropdown */}
      {actionsOpen && dropdownPosition && createPortal(
        <div 
          ref={dropdownRef}
          className="absolute w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
        >
          <div className="py-1 flex flex-col">
            <button
              onClick={() => {
                navigate(`/content/${schemaName}/${actionsOpen}`);
                setActionsOpen(null);
                setDropdownPosition(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('contentViews.edit')}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(actionsOpen);
                setActionsOpen(null);
                setDropdownPosition(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('contentViews.copyId')}
            </button>
            <button
              onClick={() => {
                onDocumentAction?.(actionsOpen, 'duplicate');
                setActionsOpen(null);
                setDropdownPosition(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('contentViews.duplicate')}
            </button>
            {/* Only show delete if user can delete this document */}
            {(() => {
              const doc = documents.find(d => (d._id || d.id) === actionsOpen);
              const showDelete = !canDelete || (doc && canDelete(doc));
              if (!showDelete) return null;
              return (
                <>
                  <hr className="my-1 border-gray-200 dark:border-gray-600" />
                  <button
                    onClick={async () => {
                      const confirmed = await studioContext?.utils?.showConfirm?.(
                        t('contentViews.deleteConfirm'),
                        {
                          title: t('contentViews.deleteTitle'),
                          confirmText: t('contentViews.confirmDelete'),
                          cancelText: t('common.cancel'),
                          variant: 'danger'
                        }
                      );
                      if (confirmed) {
                        onDocumentAction?.(actionsOpen, 'delete');
                      }
                      setActionsOpen(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {t('contentViews.delete')}
                  </button>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Default columns for common document types
export const getDefaultColumns = (): ListColumn[] => {
  return [
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      render: (value, doc) => getSmartDocumentTitle(doc)
    },
    {
      key: '_status',
      title: 'Status',
      sortable: true,
      render: (value, doc) => {
        // Use _status as the single source of truth
        const status = value || 'draft';
        const isPublished = status === 'published';
        return (
          <span className={cn(
            "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
            isPublished
              ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
          )}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      }
    },
    {
      key: '_createdAt',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '—'
    },
    {
      key: '_updatedAt',
      title: 'Updated',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '—'
    }
  ];
};