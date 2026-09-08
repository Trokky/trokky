import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  EllipsisHorizontalIcon,
  UserIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useT } from '@trokky/trokky/i18n';
import type { Document } from '@/types';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  limit?: number;
}

export interface KanbanViewProps {
  documents: Document[];
  schemaName: string;
  loading?: boolean;
  selectedItems: string[];
  onItemSelect: (id: string, selected: boolean) => void;
  onDocumentAction?: (documentId: string, action: string) => void;
  onDocumentMove?: (documentId: string, fromColumn: string, toColumn: string) => void;
  
  // Kanban configuration
  groupByField: string;
  columns: KanbanColumn[];
  titleField?: string;
  subtitleField?: string;
  assigneeField?: string;
  dateField?: string;
  colorField?: string;
  allowDragAndDrop?: boolean;
}

export function KanbanView({
  documents,
  schemaName,
  loading = false,
  selectedItems,
  onItemSelect,
  onDocumentAction,
  onDocumentMove,
  groupByField,
  columns,
  titleField = 'title',
  subtitleField,
  assigneeField,
  dateField = '_updatedAt',
  colorField,
  allowDragAndDrop = true
}: KanbanViewProps) {
  const { t } = useT('studio');
  const navigate = useNavigate();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  
  const getDocumentValue = (doc: Document, field: string): any => {
    return field.split('.').reduce((obj: any, k: string) => obj?.[k], doc);
  };
  
  const getDocumentId = (doc: Document) => doc.id || doc._id;
  
  const getDocumentTitle = (doc: Document) => {
    return getDocumentValue(doc, titleField) || 
           doc.title || 
           doc.name || 
           'Untitled';
  };
  
  const getDocumentSubtitle = (doc: Document) => {
    if (!subtitleField) return null;
    return getDocumentValue(doc, subtitleField);
  };
  
  const getDocumentAssignee = (doc: Document) => {
    if (!assigneeField) return null;
    const assignee = getDocumentValue(doc, assigneeField);
    if (typeof assignee === 'string') return assignee;
    if (assignee?.name) return assignee.name;
    return null;
  };
  
  const getDocumentDate = (doc: Document) => {
    const dateValue = getDocumentValue(doc, dateField) || doc._updatedAt || doc._createdAt;
    return dateValue ? new Date(dateValue).toLocaleDateString() : null;
  };
  
  const getDocumentColor = (doc: Document) => {
    if (!colorField) return 'bg-white dark:bg-gray-800';
    
    const colorValue = getDocumentValue(doc, colorField);
    if (!colorValue) return 'bg-white dark:bg-gray-800';
    
    // Map common color values to Tailwind classes
    const colorMap: Record<string, string> = {
      red: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
      orange: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
      yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
      blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
      purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
      pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800',
      high: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
      medium: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      low: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    };
    
    return colorMap[String(colorValue).toLowerCase()] || 'bg-white dark:bg-gray-800';
  };
  
  // Group documents by the specified field
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    
    // Initialize all columns
    columns.forEach(column => {
      groups[column.id] = [];
    });
    
    // Group documents
    documents.forEach(doc => {
      const groupValue = getDocumentValue(doc, groupByField);
      const groupKey = String(groupValue || 'unassigned');
      
      if (groups[groupKey]) {
        groups[groupKey].push(doc);
      } else {
        // If document has a group value not in columns, add to first column or create 'other'
        if (!groups['other']) {
          groups['other'] = [];
        }
        groups['other'].push(doc);
      }
    });
    
    return groups;
  }, [documents, groupByField, columns]);
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, documentId: string) => {
    if (!allowDragAndDrop) return;
    
    setDraggedItem(documentId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', documentId);
  };
  
  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    if (!allowDragAndDrop || !draggedItem) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };
  
  const handleDragLeave = () => {
    setDragOverColumn(null);
  };
  
  const handleDrop = (e: React.DragEvent, columnId: string) => {
    if (!allowDragAndDrop || !draggedItem) return;
    
    e.preventDefault();
    setDragOverColumn(null);
    
    // Find the current column of the dragged item
    const currentColumn = Object.keys(groupedDocuments).find(key => 
      groupedDocuments[key].some(doc => getDocumentId(doc) === draggedItem)
    );
    
    if (currentColumn && currentColumn !== columnId && onDocumentMove) {
      onDocumentMove(draggedItem, currentColumn, columnId);
    }
    
    setDraggedItem(null);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };
  
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{t('contentViews.loadingDocuments')}</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex space-x-6 overflow-x-auto pb-6">
      {columns.map((column) => {
        const columnDocuments = groupedDocuments[column.id] || [];
        const isOverLimit = column.limit && columnDocuments.length > column.limit;
        const isDragOver = dragOverColumn === column.id;
        
        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 transition-colors",
              isDragOver 
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
                : "border-gray-200 dark:border-gray-700"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {column.color && (
                    <div 
                      className={cn("w-3 h-3 rounded-full", `bg-${column.color}-500`)}
                    />
                  )}
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {column.title}
                  </h3>
                  <span className={cn(
                    "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                    isOverLimit 
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  )}>
                    {columnDocuments.length}
                    {column.limit && `/${column.limit}`}
                  </span>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="p-1"
                  onClick={() => {
                    // Create new document with this column's group value
                    navigate(`/content/${schemaName}/new?${groupByField}=${column.id}`);
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Column content */}
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto flex-1">
              {columnDocuments.map((doc) => {
                const docId = getDocumentId(doc);
                const isSelected = selectedItems.includes(docId);
                const isDragging = draggedItem === docId;
                const title = getDocumentTitle(doc);
                const subtitle = getDocumentSubtitle(doc);
                const assignee = getDocumentAssignee(doc);
                const date = getDocumentDate(doc);
                const colorClass = getDocumentColor(doc);
                
                return (
                  <div
                    key={docId}
                    draggable={allowDragAndDrop}
                    onDragStart={(e) => handleDragStart(e, docId)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md group",
                      colorClass,
                      isSelected && "ring-2 ring-blue-500",
                      isDragging && "opacity-50 rotate-2 scale-105 shadow-lg",
                      allowDragAndDrop && "hover:shadow-md"
                    )}
                    onClick={() => navigate(`/content/${schemaName}/${docId}`)}
                  >
                    {/* Selection checkbox */}
                    <div className="flex items-start justify-between mb-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={(checked) => {
                            onItemSelect(docId, checked);
                          }}
                          className="mt-0.5"
                        />
                      </div>
                      
                      {/* Actions menu */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionsOpen(actionsOpen === docId ? null : docId);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </button>
                        
                        {actionsOpen === docId && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/content/${schemaName}/${docId}`);
                                  setActionsOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                {t('contentViews.edit')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDocumentAction?.(docId, 'duplicate');
                                  setActionsOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                {t('contentViews.duplicate')}
                              </button>
                              <hr className="my-1 border-gray-200 dark:border-gray-600" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(t('contentViews.deleteConfirmShort'))) {
                                    onDocumentAction?.(docId, 'delete');
                                  }
                                  setActionsOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                {t('contentViews.delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                        {title}
                      </h4>
                      
                      {subtitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                          {subtitle}
                        </p>
                      )}
                      
                      {/* Meta information */}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-3">
                          {assignee && (
                            <div className="flex items-center space-x-1">
                              <UserIcon className="h-3 w-3" />
                              <span>{assignee}</span>
                            </div>
                          )}
                          {date && (
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="h-3 w-3" />
                              <span>{date}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {columnDocuments.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <p className="text-sm">{t('contentViews.noItemsInColumn', { column: column.title.toLowerCase() })}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => navigate(`/content/${schemaName}/new?${groupByField}=${column.id}`)}
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    {t('contentViews.addItem')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}