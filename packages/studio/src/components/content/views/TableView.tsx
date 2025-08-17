import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronUpIcon, 
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useStudioContext } from '@/contexts/StudioContext';
import type { Document } from '@/types';

export interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  resizable?: boolean;
  visible?: boolean;
  render?: (value: any, document: Document) => React.ReactNode;
}

export interface TableViewProps {
  documents: Document[];
  columns: TableColumn[];
  schemaName: string;
  loading?: boolean;
  selectedItems: string[];
  onItemSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onDocumentAction?: (documentId: string, action: string) => void;
  onColumnResize?: (columnKey: string, width: number) => void;
  onColumnVisibilityChange?: (columnKey: string, visible: boolean) => void;
  density?: 'compact' | 'comfortable' | 'spacious';
}

export function TableView({
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
  onColumnResize,
  onColumnVisibilityChange,
  density = 'comfortable'
}: TableViewProps) {
  const navigate = useNavigate();
  const studioContext = useStudioContext();
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
  const allSelected = documents.length > 0 && selectedItems.length === documents.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < documents.length;
  const visibleColumns = columns.filter(col => col.visible !== false);
  
  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setActionsOpen(null);
        setColumnsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const getDensityClasses = () => {
    switch (density) {
      case 'compact':
        return 'py-2';
      case 'comfortable':
        return 'py-3';
      case 'spacious':
        return 'py-4';
      default:
        return 'py-3';
    }
  };
  
  const handleSort = (column: TableColumn) => {
    if (!column.sortable || !onSort) return;
    
    const newDirection = sortField === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column.key, newDirection);
  };
  
  const handleColumnResize = (columnKey: string, startX: number, startWidth: number) => {
    if (!onColumnResize) return;
    
    setResizingColumn(columnKey);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      onColumnResize(columnKey, newWidth);
    };
    
    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const getDocumentValue = (doc: Document, key: string) => {
    return key.split('.').reduce((obj, k) => obj?.[k], doc);
  };
  
  const formatValue = (value: any, column: TableColumn, doc: Document) => {
    if (column.render) {
      return column.render(value, doc);
    }
    
    if (value === null || value === undefined) {
      return <span className="text-gray-400">—</span>;
    }
    
    if (typeof value === 'boolean') {
      return (
        <span className={cn(
          "inline-flex px-2 py-1 text-xs font-medium rounded-md",
          value 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        )}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }
    
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return new Date(value).toLocaleDateString();
    }
    
    if (Array.isArray(value)) {
      return value.length > 0 ? (
        <span title={value.join(', ')}>{value.slice(0, 2).join(', ')}{value.length > 2 ? '...' : ''}</span>
      ) : (
        <span className="text-gray-400">Empty</span>
      );
    }
    
    if (typeof value === 'string' && value.length > 50) {
      return <span title={value}>{value.substring(0, 50)}...</span>;
    }
    
    return String(value);
  };
  
  const getDocumentId = (doc: Document) => doc.id || doc._id;
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
        </div>
      </div>
    );
  }
  
  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No documents found</p>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={tableRef} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table controls */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {documents.length} items
        </div>
        
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setColumnsMenuOpen(!columnsMenuOpen)}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
            Columns
          </Button>
          
          {columnsMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
              <div className="p-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Show/Hide Columns
                </h4>
                <div className="space-y-2">
                  {columns.map((column) => (
                    <label key={column.key} className="flex items-center">
                      <Checkbox
                        checked={column.visible === true}
                        onChange={(checked) => onColumnVisibilityChange?.(column.key, checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {column.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {/* Selection column */}
              <th className="px-4 py-3 text-left w-12">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                />
              </th>
              
              {/* Data columns */}
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider relative",
                    column.sortable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600",
                    resizingColumn === column.key && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                  style={{ 
                    width: column.width,
                    minWidth: column.minWidth || 100
                  }}
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
                  
                  {/* Resize handle */}
                  {column.resizable && onColumnResize && (
                    <div
                      className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-blue-500/20 group"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.closest('th')!.getBoundingClientRect();
                        handleColumnResize(column.key, e.clientX, rect.width);
                      }}
                    >
                      <div className="w-0.5 h-full bg-gray-300 dark:bg-gray-600 ml-auto group-hover:bg-blue-500" />
                    </div>
                  )}
                </th>
              ))}
              
              {/* Actions column */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">
                Actions
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
                  <td className={cn("px-4 whitespace-nowrap", getDensityClasses())}>
                    <Checkbox
                      checked={isSelected}
                      onChange={(checked) => onItemSelect(docId, checked)}
                    />
                  </td>
                  
                  {/* Data cells */}
                  {visibleColumns.map((column, index) => {
                    const value = getDocumentValue(doc, column.key);
                    const isFirstColumn = index === 0;
                    
                    return (
                      <td 
                        key={column.key} 
                        className={cn("px-4 whitespace-nowrap", getDensityClasses())}
                        style={{ 
                          width: column.width,
                          minWidth: column.minWidth || 100
                        }}
                      >
                        {isFirstColumn ? (
                          <button
                            onClick={() => navigate(`/content/${schemaName}/${docId}`)}
                            className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatValue(value, column, doc)}
                            </div>
                            {doc.slug && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
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
                  <td className={cn("px-4 whitespace-nowrap text-right text-sm font-medium", getDensityClasses())}>
                    <div className="relative">
                      <button
                        onClick={() => setActionsOpen(actionsOpen === docId ? null : docId)}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </button>
                      
                      {actionsOpen === docId && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-max">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                navigate(`/content/${schemaName}/${docId}`);
                                setActionsOpen(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(docId);
                                setActionsOpen(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Copy ID
                            </button>
                            <button
                              onClick={() => {
                                onDocumentAction?.(docId, 'duplicate');
                                setActionsOpen(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Duplicate
                            </button>
                            <hr className="my-1 border-gray-200 dark:border-gray-600" />
                            <button
                              onClick={async () => {
                                const confirmed = await studioContext?.utils?.showConfirm?.(
                                  'Are you sure you want to delete this document? This action cannot be undone.',
                                  {
                                    title: 'Delete Document',
                                    confirmText: 'Delete',
                                    cancelText: 'Cancel',
                                    variant: 'danger'
                                  }
                                );
                                if (confirmed) {
                                  onDocumentAction?.(docId, 'delete');
                                }
                                setActionsOpen(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}