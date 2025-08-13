import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  CalendarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import type { Document } from '@/types';

export type GridCardSize = 'small' | 'medium' | 'large';

export interface GridViewProps {
  documents: Document[];
  schemaName: string;
  loading?: boolean;
  selectedItems: string[];
  onItemSelect: (id: string, selected: boolean) => void;
  onDocumentAction?: (documentId: string, action: string) => void;
  
  // Grid configuration
  cardSize?: GridCardSize;
  columnsPerRow?: number;
  
  // Field mappings
  imageField?: string;
  titleField?: string;
  subtitleField?: string;
  descriptionField?: string;
  dateField?: string;
  authorField?: string;
}

export function GridView({
  documents,
  schemaName,
  loading = false,
  selectedItems,
  onItemSelect,
  onDocumentAction,
  cardSize = 'medium',
  columnsPerRow,
  imageField = 'image',
  titleField = 'title',
  subtitleField = 'subtitle',
  descriptionField = 'description',
  dateField = '_updatedAt',
  authorField = 'author'
}: GridViewProps) {
  const navigate = useNavigate();
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  
  const getColumnsClass = () => {
    if (columnsPerRow) {
      return `grid-cols-${columnsPerRow}`;
    }
    
    switch (cardSize) {
      case 'small':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
      case 'medium':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case 'large':
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    }
  };
  
  const getCardHeight = () => {
    switch (cardSize) {
      case 'small':
        return 'h-48';
      case 'medium':
        return 'h-64';
      case 'large':
        return 'h-80';
      default:
        return 'h-64';
    }
  };
  
  const getDocumentValue = (doc: Document, field: string): any => {
    return field.split('.').reduce((obj: any, k: string) => obj?.[k], doc);
  };
  
  const getDocumentId = (doc: Document) => doc.id || doc._id;
  
  const getDocumentTitle = (doc: Document) => {
    return getDocumentValue(doc, titleField) || 
           doc.title || 
           doc.name || 
           doc.slug || 
           'Untitled';
  };
  
  const getDocumentSubtitle = (doc: Document) => {
    return getDocumentValue(doc, subtitleField) || doc.subtitle;
  };
  
  const getDocumentDescription = (doc: Document) => {
    const desc = getDocumentValue(doc, descriptionField) || doc.description || doc.excerpt;
    if (typeof desc === 'string' && desc.length > 120) {
      return desc.substring(0, 120) + '...';
    }
    return desc;
  };
  
  const getDocumentImage = (doc: Document) => {
    const imageValue = getDocumentValue(doc, imageField);
    if (typeof imageValue === 'string') {
      return imageValue;
    }
    if (imageValue?.url) {
      return imageValue.url;
    }
    if (imageValue?.src) {
      return imageValue.src;
    }
    return null;
  };
  
  const getDocumentDate = (doc: Document) => {
    const dateValue = getDocumentValue(doc, dateField) || doc._updatedAt || doc._createdAt;
    return dateValue ? new Date(dateValue).toLocaleDateString() : null;
  };
  
  const getDocumentAuthor = (doc: Document) => {
    const authorValue = getDocumentValue(doc, authorField);
    if (typeof authorValue === 'string') return authorValue;
    if (authorValue?.name) return authorValue.name;
    if (authorValue?.title) return authorValue.title;
    return null;
  };
  
  const getStatusColor = (doc: Document) => {
    const isPublished = doc.published || doc._status === 'published';
    return isPublished ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
  };
  
  const getStatusText = (doc: Document) => {
    const isPublished = doc.published || doc._status === 'published';
    return isPublished ? 'Published' : 'Draft';
  };
  
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
      </div>
    );
  }
  
  if (documents.length === 0) {
    return (
      <div className="p-8 text-center">
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No documents found</p>
      </div>
    );
  }
  
  return (
    <div className={cn('grid gap-6', getColumnsClass())}>
      {documents.map((doc) => {
        const docId = getDocumentId(doc);
        const isSelected = selectedItems.includes(docId);
        const image = getDocumentImage(doc);
        const title = getDocumentTitle(doc);
        const subtitle = getDocumentSubtitle(doc);
        const description = getDocumentDescription(doc);
        const date = getDocumentDate(doc);
        const author = getDocumentAuthor(doc);
        
        return (
          <div
            key={docId}
            className={cn(
              'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg group',
              getCardHeight(),
              isSelected && 'ring-2 ring-blue-500 border-blue-500'
            )}
          >
            {/* Selection checkbox */}
            <div className="absolute top-3 left-3 z-10">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onItemSelect(docId, e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white/90 backdrop-blur-sm"
              />
            </div>
            
            {/* Actions menu */}
            <div className="absolute top-3 right-3 z-10">
              <div className="relative">
                <button
                  onClick={() => setActionsOpen(actionsOpen === docId ? null : docId)}
                  className="p-1 rounded-full text-white/80 hover:text-white hover:bg-black/20 backdrop-blur-sm bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
                
                {actionsOpen === docId && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
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
            </div>
            
            {/* Card content */}
            <button
              onClick={() => navigate(`/content/${schemaName}/${docId}`)}
              className="w-full h-full flex flex-col text-left"
            >
              {/* Image area */}
              <div className="flex-shrink-0 h-32 bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {image ? (
                  <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                      const icon = document.createElement('div');
                      icon.innerHTML = '<svg class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                      e.currentTarget.parentElement!.appendChild(icon);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <DocumentTextIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                
                {/* Status badge */}
                <div className="absolute bottom-2 left-2">
                  <span className={cn('inline-flex px-2 py-1 text-xs font-semibold rounded-full', getStatusColor(doc))}>
                    {getStatusText(doc)}
                  </span>
                </div>
              </div>
              
              {/* Content area */}
              <div className="flex-1 p-4 flex flex-col">
                {/* Title */}
                <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                  {title}
                </h3>
                
                {/* Subtitle */}
                {subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                    {subtitle}
                  </p>
                )}
                
                {/* Description */}
                {description && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 flex-1 mb-3">
                    {description}
                  </p>
                )}
                
                {/* Meta info */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-auto">
                  <div className="flex items-center space-x-3">
                    {author && (
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-3 w-3" />
                        <span>{author}</span>
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
            </button>
          </div>
        );
      })}
    </div>
  );
}