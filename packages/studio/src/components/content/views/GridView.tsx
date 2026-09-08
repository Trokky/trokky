import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  CalendarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { Checkbox } from '@/components/ui/Checkbox';
import { useStudioContext } from '@/contexts/StudioContext';
import { useApiClient } from '@/hooks/useApiClient';
import { getSmartDocumentTitle, getDocumentValue } from '@/utils/documentTitle';
import { useT } from '@trokky/trokky/i18n';
import type { Document } from '@/types';

export type GridCardSize = 'small' | 'medium' | 'large';

export interface GridViewProps {
  documents: Document[];
  schemaName: string;
  loading?: boolean;
  selectedItems: string[];
  onItemSelect: (id: string, selected: boolean) => void;
  onDocumentAction?: (documentId: string, action: string) => void;
  /** Function to check if user can delete a specific document */
  canDelete?: (document: Document) => boolean;

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
  canDelete,
  cardSize = 'medium',
  columnsPerRow,
  // imageField = 'image', // Now dynamically checking multiple fields
  subtitleField = 'subtitle',
  descriptionField = 'description',
  dateField = '_updatedAt',
  authorField = 'author'
}: GridViewProps) {
  const { t } = useT('studio');
  const navigate = useNavigate();
  const studioContext = useStudioContext();
  const apiClient = useApiClient();
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
        return 'h-56';
      case 'medium':
        return 'h-72';
      case 'large':
        return 'h-80';
      default:
        return 'h-72';
    }
  };
  
  const getDocumentId = (doc: Document) => doc.id || doc._id;
  
  const getDocumentTitle = (doc: Document) => {
    return getSmartDocumentTitle(doc);
  };
  
  const getDocumentSubtitle = (doc: Document) => {
    return getDocumentValue(doc, subtitleField) || doc.subtitle;
  };
  
  const getDocumentDescription = (doc: Document) => {
    const desc = getDocumentValue(doc, descriptionField) || doc.description || doc.excerpt;
    if (typeof desc === 'string') {
      // Truncate at word boundaries for better readability
      if (desc.length > 140) {
        const truncated = desc.substring(0, 140);
        const lastSpace = truncated.lastIndexOf(' ');
        return lastSpace > 100 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
      }
      return desc;
    }
    return desc;
  };
  
  const getDocumentImage = (doc: Document) => {
    // Try multiple possible image field names and structures
    const possibleFields = [
      'featuredImage', // Most common in context sidebar
      'image',
      'thumbnail',
      'cover',
      'photo',
      'mainImage',
      'hero'
    ];
    
    for (const field of possibleFields) {
      const imageValue = getDocumentValue(doc, field);
      
      if (imageValue) {
        // Handle Sanity/CMS-style image references (using dynamic API base path)
        if (imageValue.asset?._ref || imageValue._ref) {
          const imageRef = imageValue.asset?._ref || imageValue._ref;
          console.log(`Found image reference in ${field}:`, imageRef);
          return apiClient.getMediaUrl(imageRef, 'thumbnail');
        }
        
        // Handle direct URL strings
        if (typeof imageValue === 'string' && imageValue.trim()) {
          console.log(`Found direct image URL in ${field}:`, imageValue);
          return imageValue;
        }
        
        // Handle object with url property
        if (imageValue?.url && typeof imageValue.url === 'string') {
          console.log(`Found image URL in ${field}.url:`, imageValue.url);
          return imageValue.url;
        }
        
        // Handle object with src property
        if (imageValue?.src && typeof imageValue.src === 'string') {
          console.log(`Found image URL in ${field}.src:`, imageValue.src);
          return imageValue.src;
        }
      }
    }
    
    console.log('No image found for document:', doc.title || doc.name);
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
    return isPublished ? t('documentEditor.published') : t('documentEditor.draft');
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{t('contentViews.loadingDocuments')}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-8 text-center">
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('contentViews.noDocumentsFound')}</p>
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
              'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 hover:-translate-y-1 group',
              getCardHeight(),
              isSelected && 'ring-2 ring-blue-500 border-blue-500 shadow-lg'
            )}
          >
            {/* Selection checkbox */}
            <div className="absolute top-3 left-3 z-10">
              <Checkbox
                checked={isSelected}
                onChange={(checked) => onItemSelect(docId, checked)}
                className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm"
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
                        {t('contentViews.edit')}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(docId);
                          setActionsOpen(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {t('contentViews.copyId')}
                      </button>
                      <button
                        onClick={() => {
                          onDocumentAction?.(docId, 'duplicate');
                          setActionsOpen(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {t('contentViews.duplicate')}
                      </button>
                      {/* Only show delete if user can delete this document */}
                      {(!canDelete || canDelete(doc)) && (
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
                                onDocumentAction?.(docId, 'delete');
                              }
                              setActionsOpen(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            {t('contentViews.delete')}
                          </button>
                        </>
                      )}
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
              {/* Image/Background area */}
              <div className="flex-shrink-0 h-40 relative overflow-hidden">
                {image ? (
                  <div
                    className="w-full h-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${image})` }}
                  >
                    {/* Gradient overlay for better text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                    <DocumentTextIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                
                {/* Status badge */}
                <div className="absolute top-3 left-3">
                  <span className={cn('inline-flex px-2 py-1 text-xs font-semibold rounded-full backdrop-blur-sm', getStatusColor(doc))}>
                    {getStatusText(doc)}
                  </span>
                </div>
              </div>
              
              {/* Content area */}
              <div className="flex-1 p-4 flex flex-col min-h-0">
                {/* Title */}
                <h3 
                  className="text-sm font-semibold text-gray-900 dark:text-white mb-2 leading-tight overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                  title={title}
                >
                  {title}
                </h3>
                
                {/* Subtitle */}
                {subtitle && (
                  <p 
                    className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium overflow-hidden whitespace-nowrap text-ellipsis"
                    title={subtitle}
                  >
                    {subtitle}
                  </p>
                )}
                
                {/* Description */}
                {description && (
                  <p 
                    className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3 flex-1 overflow-hidden"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical'
                    }}
                    title={description}
                  >
                    {description}
                  </p>
                )}
                
                {/* Meta info */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center space-x-3 min-w-0">
                    {author && (
                      <div className="flex items-center space-x-1 min-w-0">
                        <UserIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{author}</span>
                      </div>
                    )}
                    {date && (
                      <div className="flex items-center space-x-1 flex-shrink-0">
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