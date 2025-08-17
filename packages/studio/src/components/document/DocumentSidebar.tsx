/**
 * DocumentSidebar - Contextual information and document relationships
 * 
 * Provides document metadata, relationships, and contextual actions
 */

import { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  UserIcon, 
  TagIcon,
  LinkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useDocumentEditor } from './DocumentEditorContext';
import { useStudioContext } from '@/contexts/StudioContext';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('DocumentSidebar');

export function DocumentSidebar() {
  const navigate = useNavigate();
  const studioContext = useStudioContext();
  const {
    schema,
    document,
    documentState,
    isNewDocument
  } = useDocumentEditor();

  // DocumentSidebar is always shown - contains useful document info for all document types

  // Load collapsed state from localStorage, default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('trokky_document_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  
  const [relationships, setRelationships] = useState<any>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);

  // Save collapsed state to localStorage whenever it changes
  const toggleCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('trokky_document_sidebar_collapsed', String(collapsed));
    } catch (error) {
      logger.warn('Failed to save sidebar state', error);
    }
  };

  // Load document relationships
  useEffect(() => {
    if (!isNewDocument && document?.id) {
      loadRelationships();
    }
  }, [document?.id, document?.author, document?.category, isNewDocument]);

  const loadRelationships = async () => {
    if (!document?.id) return;

    try {
      setLoadingRelationships(true);
      
      // Extract actual references from the document
      const references: any[] = [];
      
      logger.debug('Loading relationships for document', { 
        documentId: document.id, 
        author: document.author, 
        category: document.category 
      });
      
      // Check for author reference - handle multiple formats
      if (document.author) {
        if (typeof document.author === 'string') {
          // String reference - try to resolve it
          try {
            const authorResponse = await apiClient.getDocument('author', document.author);
            if (authorResponse.success && authorResponse.data?.document) {
              references.push({
                id: document.author,
                title: authorResponse.data.document.name || authorResponse.data.document.title || 'Author',
                type: 'author'
              });
            }
          } catch (error) {
            logger.warn('Failed to resolve author reference', error);
            references.push({
              id: document.author,
              title: document.author,
              type: 'author'
            });
          }
        } else if (typeof document.author === 'object') {
          // Object reference
          const authorTitle = document.author._cached?.name || 
                             document.author._cached?.title || 
                             document.author.name || 
                             document.author.title ||
                             document.author._ref ||
                             'Author';
          references.push({
            id: document.author.id || document.author._ref,
            title: authorTitle,
            type: 'author'
          });
        }
      }
      
      // Check for category reference - handle multiple formats
      if (document.category) {
        if (typeof document.category === 'string') {
          // String reference - try to resolve it
          try {
            const categoryResponse = await apiClient.getDocument('category', document.category);
            if (categoryResponse.success && categoryResponse.data?.document) {
              references.push({
                id: document.category,
                title: categoryResponse.data.document.name || categoryResponse.data.document.title || 'Category',
                type: 'category'
              });
            }
          } catch (error) {
            logger.warn('Failed to resolve category reference', error);
            references.push({
              id: document.category,
              title: document.category,
              type: 'category'
            });
          }
        } else if (typeof document.category === 'object') {
          // Object reference
          const categoryTitle = document.category._cached?.name || 
                               document.category._cached?.title || 
                               document.category.name || 
                               document.category.title ||
                               document.category._ref ||
                               'Category';
          references.push({
            id: document.category.id || document.category._ref,
            title: categoryTitle,
            type: 'category'
          });
        }
      }
      
      // TODO: Find documents that reference this document (referencedBy)
      // This would require a reverse lookup in the API
      
      const actualRelationships = {
        references,
        referencedBy: [], // Would be populated by API call
        similar: []
      };
      
      setRelationships(actualRelationships);
      logger.info('Relationships loaded', { 
        documentId: document.id, 
        relationshipCount: references.length,
        relationships: references 
      });
    } catch (err) {
      logger.error('Failed to load relationships', err);
    } finally {
      setLoadingRelationships(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDocumentUrl = () => {
    if (!document || isNewDocument) return null;
    
    // Get public URL from settings or fallback to current domain
    // TODO: Get this from actual settings when settings persistence is implemented
    let publicUrl = localStorage.getItem('trokky_public_url') || window.location.origin;
    
    // Remove trailing slash to avoid double slashes
    publicUrl = publicUrl.replace(/\/$/, '');
    
    // Generate the public URL for the document
    const slug = document.slug || document.id;
    
    // Handle different URL patterns based on schema and document structure
    if (schema?.name === 'page' || schema?.type === 'singleton') {
      // For pages and singletons, use the slug directly
      return slug === 'homepage' || slug === 'home' 
        ? publicUrl 
        : `${publicUrl}/${slug}`;
    } else {
      // For regular collections, use schema name + slug
      return `${publicUrl}/${schema?.name}/${slug}`;
    }
  };

  const handleDeleteDocument = async () => {
    if (!document || !schema || isNewDocument) return;

    const documentTitle = document.title || document.name || 'this document';
    
    // Confirm deletion
    const confirmed = await studioContext?.utils?.showConfirm?.(
      `Are you sure you want to delete "${documentTitle}"? This action cannot be undone.`,
      {
        title: 'Delete Document',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    );

    if (!confirmed) return;

    try {
      logger.info('Deleting document', { 
        schema: schema.name, 
        documentId: document.id,
        title: documentTitle 
      });

      const response = await apiClient.deleteDocument(schema.name, document.id);
      
      if (response.success) {
        studioContext?.utils?.showToast?.('Document deleted', 'success');
        logger.info('Document deleted successfully', { 
          schema: schema.name, 
          documentId: document.id 
        });
        
        // Navigate back to collection list
        navigate(`/content/${schema.name}`);
      } else {
        throw new Error(response.error?.message || 'Failed to delete document');
      }
    } catch (error) {
      logger.error('Failed to delete document', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
      studioContext?.utils?.showToast?.(errorMessage, 'error');
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
        <button
          onClick={() => toggleCollapsed(false)}
          className="w-full p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Expand sidebar"
        >
          <ChevronRightIcon className="h-5 w-5 mx-auto" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Sidebar header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Document Info
        </h3>
        <button
          onClick={() => toggleCollapsed(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Collapse sidebar"
        >
          <ChevronDownIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Document metadata */}
        <div className="p-4 space-y-4">
          {/* Creation info */}
          {!isNewDocument && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Created
              </h4>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <ClockIcon className="h-4 w-4 mr-2" />
                {formatDate(document?._createdAt)}
              </div>
              {document?._createdBy && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <UserIcon className="h-4 w-4 mr-2" />
                  {document._createdBy}
                </div>
              )}
            </div>
          )}

          {/* Last updated */}
          {!isNewDocument && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Last Updated
              </h4>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <ClockIcon className="h-4 w-4 mr-2" />
                {formatDate(document?._updatedAt)}
              </div>
              {document?._updatedBy && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <UserIcon className="h-4 w-4 mr-2" />
                  {document._updatedBy}
                </div>
              )}
            </div>
          )}

          {/* Document state info */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Status
            </h4>
            <div className="text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(documentState)}`}>
                {documentState === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            {documentState === 'published' && document?.publishedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Published {formatDate(document.publishedAt)}
              </div>
            )}
          </div>

          {/* Public URL */}
          {documentState === 'published' && getDocumentUrl() && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Public URL
              </h4>
              <div className="flex items-center">
                <LinkIcon className="h-4 w-4 mr-2 text-gray-400" />
                <a
                  href={getDocumentUrl()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                >
                  View live
                </a>
              </div>
            </div>
          )}

          {/* Tags/Categories (if available) */}
          {document?.tags && document.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1">
                {document.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contributors */}
          {!isNewDocument && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Contributors
              </h4>
              <div className="space-y-2">
                {/* Document author (from reference field) */}
                {document?.author && typeof document.author === 'object' && document.author._cached && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <span className="font-medium">{document.author._cached.name}</span>
                    <span className="ml-1 text-xs text-gray-400">(Author)</span>
                  </div>
                )}
                
                {/* Creator (if different from author) */}
                {document?._createdBy && (!document.author || document._createdBy !== document.author._cached?.name) && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <span>{document._createdBy}</span>
                    <span className="ml-1 text-xs text-gray-400">(Creator)</span>
                  </div>
                )}
                
                {/* Last editor (if different from others) */}
                {document?._updatedBy && document._updatedBy !== document._createdBy && (!document.author || document._updatedBy !== document.author._cached?.name) && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <span>{document._updatedBy}</span>
                    <span className="ml-1 text-xs text-gray-400">(Last edited)</span>
                  </div>
                )}
                
                {/* TODO: Add more contributors from document history when available */}
                {!document?.author && !document?._createdBy && !document?._updatedBy && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No contributor information available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Document relationships */}
        {!isNewDocument && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Relationships
            </h4>
            
            {loadingRelationships ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading relationships...
              </div>
            ) : relationships ? (
              <div className="space-y-3">
                {/* References */}
                {relationships.references.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      References ({relationships.references.length})
                    </h5>
                    <div className="space-y-1">
                      {relationships.references.slice(0, 3).map((ref: any, index: number) => (
                        <div key={index} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          {ref.title || ref.name || ref.id}
                        </div>
                      ))}
                      {relationships.references.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{relationships.references.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Referenced by */}
                {relationships.referencedBy.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Referenced by ({relationships.referencedBy.length})
                    </h5>
                    <div className="space-y-1">
                      {relationships.referencedBy.slice(0, 3).map((ref: any, index: number) => (
                        <div key={index} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          {ref.title || ref.name || ref.id}
                        </div>
                      ))}
                      {relationships.referencedBy.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{relationships.referencedBy.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {relationships.references.length === 0 && relationships.referencedBy.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No relationships found
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Failed to load relationships
              </div>
            )}
          </div>
        )}

        {/* Schema info */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Schema
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium">{schema?.title || schema?.name}</div>
            {schema?.description && (
              <div className="text-xs mt-1">{schema.description}</div>
            )}
            <div className="text-xs mt-1">
              {getSchemaFieldCount(schema)} fields
            </div>
          </div>
        </div>

        {/* Danger zone - Delete document */}
        {!isNewDocument && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Danger Zone
            </h4>
            <button
              onClick={handleDeleteDocument}
              className="w-full flex items-center justify-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
              title="Delete this document permanently"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Document
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This action cannot be undone.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusBadgeClasses(state: string): string {
  switch (state) {
    case 'published':
      return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
    case 'draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
  }
}

function getSchemaFieldCount(schema: any): number {
  if (!schema?.fields) return 0;
  
  // Handle both object format (schema.fields as object) and array format
  if (Array.isArray(schema.fields)) {
    return schema.fields.length;
  }
  
  if (typeof schema.fields === 'object') {
    return Object.keys(schema.fields).length;
  }
  
  return 0;
}