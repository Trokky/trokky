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
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useDocumentEditor } from './DocumentEditorContext';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('DocumentSidebar');

export function DocumentSidebar() {
  const {
    schema,
    document,
    documentState,
    isNewDocument
  } = useDocumentEditor();

  // DocumentSidebar is always shown - contains useful document info for all document types

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [relationships, setRelationships] = useState<any>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);

  // Load document relationships
  useEffect(() => {
    if (!isNewDocument && document?.id) {
      loadRelationships();
    }
  }, [document?.id, isNewDocument]);

  const loadRelationships = async () => {
    if (!document?.id) return;

    try {
      setLoadingRelationships(true);
      
      // This would be implemented to find related documents
      // For now, using a placeholder
      const mockRelationships = {
        references: [],
        referencedBy: [],
        similar: []
      };
      
      setRelationships(mockRelationships);
      logger.info('Relationships loaded', { documentId: document.id });
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
    
    // This would generate the public URL for the document
    const baseUrl = window.location.origin;
    const slug = document.slug || document.id;
    return `${baseUrl}/${schema?.name}/${slug}`;
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Expand sidebar"
        >
          <ChevronRightIcon className="h-5 w-5 mx-auto" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Sidebar header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Document Info
        </h3>
        <button
          onClick={() => setIsCollapsed(true)}
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
              {schema?.fields?.length || 0} fields
            </div>
          </div>
        </div>
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