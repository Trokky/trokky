import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronUpIcon, 
  ChevronDownIcon,
  EllipsisHorizontalIcon 
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
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
  onDocumentAction
}: ListViewProps) {
  const navigate = useNavigate();
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  
  const allSelected = documents.length > 0 && selectedItems.length === documents.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < documents.length;
  
  const handleSort = (column: ListColumn) => {
    if (!column.sortable || !onSort) return;
    
    const newDirection = sortField === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column.key, newDirection);
  };
  
  const getDocumentValue = (doc: Document, key: string) => {
    // Handle nested keys with dot notation
    return key.split('.').reduce((obj, k) => obj?.[k], doc);
  };
  
  const formatValue = (value: any, column: ListColumn, doc: Document) => {
    if (column.render) {
      return column.render(value, doc);
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
          {value ? 'Yes' : 'No'}
        </span>
      );
    }
    
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      return new Date(value).toLocaleDateString();
    }
    
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : <span className="text-gray-400">Empty</span>;
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {/* Selection column */}
              <th className="px-6 py-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              
              {/* Data columns */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider",
                    column.sortable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600",
                    column.width && `w-${column.width}`
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
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onItemSelect(docId, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  
                  {/* Data cells */}
                  {columns.map((column) => {
                    const value = getDocumentValue(doc, column.key);
                    const isFirstColumn = column === columns[0];
                    
                    return (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={() => setActionsOpen(actionsOpen === docId ? null : docId)}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </button>
                      
                      {actionsOpen === docId && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
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
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this document?')) {
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

// Default columns for common document types
export const getDefaultColumns = (): ListColumn[] => {
  return [
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      render: (value, doc) => value || doc.name || doc.slug || 'Untitled'
    },
    {
      key: 'published',
      title: 'Status',
      sortable: true,
      render: (value, doc) => {
        const isPublished = value || doc._status === 'published';
        return (
          <span className={cn(
            "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
            isPublished
              ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
          )}>
            {isPublished ? 'Published' : 'Draft'}
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