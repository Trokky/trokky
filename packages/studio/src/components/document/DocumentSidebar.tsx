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
  ChevronRightIcon,
  ChevronDownIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useDocumentEditor } from './DocumentEditorContext';
import { useStudioContext } from '@/contexts/StudioContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { DocumentHistoryPanel } from './DocumentHistoryPanel';
import { useT } from 'trokky/i18n';

const logger = createStudioLogger('DocumentSidebar');

export function DocumentSidebar() {
  const { t } = useT('studio');
  const navigate = useNavigate();
  const studioContext = useStudioContext();
  const {
    schema,
    document,
    documentState,
    isNewDocument,
    isMobileSidebarOpen,
    onToggleMobileSidebar
  } = useDocumentEditor();

  const { canDeleteDocument } = usePermissions();

  // Check if user can delete this document (has delete permission OR owns it)
  const canDelete = schema?.name ? canDeleteDocument(schema.name, document) : false;

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
  const [, setDocumentUrl] = useState<string | null>(null);
  const [contributors, setContributors] = useState<Array<{id: string, username: string, role: string}>>([]);
  const [usernameCache, setUsernameCache] = useState<Record<string, string>>({});

  // Save collapsed state to localStorage whenever it changes
  const toggleCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('trokky_document_sidebar_collapsed', String(collapsed));
    } catch (error) {
      logger.warn('Failed to save sidebar state', error);
    }
  };

  // Load document relationships, URL, and contributors
  useEffect(() => {
    const docId = document?._id || document?.id;
    if (!isNewDocument && docId) {
      loadRelationships();
      loadDocumentUrl();
      loadContributors();
    }
  }, [document?._id, document?.id, document?.author, document?.category, isNewDocument]);

  const loadDocumentUrl = async () => {
    const url = await getDocumentUrl();
    setDocumentUrl(url);
  };

  // Load contributors from audit logs
  const loadContributors = async () => {
    const docId = document?._id || document?.id;
    if (!docId) return;

    try {
      const response = await apiClient.get(`/audit-logs/documents/${docId}`, {
        params: { limit: 50 }
      });

      if (response.success && (response.data as any)?.auditLogs) {
        const auditLogs = (response.data as any).auditLogs;

        // Extract unique contributors from audit logs
        const contributorMap = new Map<string, { id: string; username: string; role: string }>();

        for (const log of auditLogs) {
          if (log.actorId && !contributorMap.has(log.actorId)) {
            // Try to resolve username
            const username = log.actorUsername || await resolveUsername(log.actorId);
            const role = log.actorId === document?._createdBy ? 'Creator' : 'Editor';
            contributorMap.set(log.actorId, { id: log.actorId, username, role });
          }
        }

        setContributors(Array.from(contributorMap.values()));
      }
    } catch (error) {
      logger.warn('Failed to load contributors from audit logs', error);
    }
  };

  // Resolve user ID to username
  const resolveUsername = async (userId: string): Promise<string> => {
    // Check cache first
    if (usernameCache[userId]) {
      return usernameCache[userId];
    }

    // System user
    if (userId === 'system') {
      return 'System';
    }

    // Try to fetch user info
    try {
      const response = await apiClient.get(`/users/${userId}`);
      if (response.success && (response.data as any)?.user) {
        const user = (response.data as any).user;
        const username = user.username || user.name || user.email || userId;
        setUsernameCache(prev => ({ ...prev, [userId]: username }));
        return username;
      }
    } catch (error) {
      // User not found, extract from ID if possible
      logger.debug('Could not resolve username for', userId);
    }

    // Fallback: clean up the ID format
    if (userId.startsWith('user-')) {
      // Try to extract something readable
      return 'User';
    }

    return userId;
  };

  const loadRelationships = async () => {
    const docId = document?._id || document?.id;
    if (!docId || !schema) return;

    try {
      setLoadingRelationships(true);

      const references: any[] = [];

      logger.debug('Loading relationships for document', {
        documentId: docId,
        schemaName: schema.name
      });

      // Helper to extract a single reference
      const extractReference = async (
        fieldValue: any,
        targetCollection: string,
        fieldPath: string,
        fieldTitle: string
      ) => {
        let refId: string | null = null;
        let refTitle: string | null = null;

        if (typeof fieldValue === 'string') {
          refId = fieldValue;
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          refId = fieldValue._ref || fieldValue._id || fieldValue.id;
          refTitle = fieldValue._cached?.name ||
                    fieldValue._cached?.title ||
                    fieldValue.name ||
                    fieldValue.title;
        }

        if (!refId) return;

        // Try to resolve if no cached title
        if (!refTitle) {
          try {
            const refResponse = await apiClient.getDocument(targetCollection, refId);
            if (refResponse.success && refResponse.data?.document) {
              const refDoc = refResponse.data.document;
              refTitle = refDoc.name || refDoc.title || refDoc.label || refId;
            }
          } catch (error) {
            logger.warn(`Failed to resolve reference for ${fieldPath}`, error);
            refTitle = refId;
          }
        }

        references.push({
          id: refId,
          title: refTitle || refId,
          fieldName: fieldPath,
          fieldTitle,
          targetCollection,
          type: targetCollection
        });
      };

      // Recursively scan fields for references
      const scanFields = async (
        fields: any,
        docData: any,
        pathPrefix: string = '',
        titlePrefix: string = ''
      ) => {
        if (!fields || !docData) return;

        const fieldEntries = Array.isArray(fields)
          ? fields.map((f: any) => [f.name, f])
          : Object.entries(fields);

        for (const [fieldName, fieldDef] of fieldEntries) {
          const field = fieldDef as any;
          const fieldPath = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;
          const fieldTitle = titlePrefix
            ? `${titlePrefix} > ${field.title || fieldName}`
            : (field.title || fieldName);
          const fieldValue = docData[fieldName];

          if (!fieldValue) continue;

          if (field.type === 'reference') {
            // Direct reference field
            const targetCollection = field.to || field.reference || fieldName;
            await extractReference(fieldValue, targetCollection, fieldPath, fieldTitle);

          } else if (field.type === 'array' && field.of?.type === 'reference') {
            // Array of references
            const targetCollection = field.of.to || field.of.reference || fieldName;
            const arrayTitle = field.title || fieldName;

            if (Array.isArray(fieldValue)) {
              for (let i = 0; i < Math.min(fieldValue.length, 5); i++) {
                await extractReference(
                  fieldValue[i],
                  targetCollection,
                  `${fieldPath}[${i}]`,
                  arrayTitle
                );
              }
              // Note if there are more
              if (fieldValue.length > 5) {
                logger.debug(`Truncated ${fieldValue.length - 5} more references in ${fieldPath}`);
              }
            }

          } else if (field.type === 'object' && field.fields) {
            // Nested object - recurse into it
            await scanFields(field.fields, fieldValue, fieldPath, field.title || fieldName);
          }
        }
      };

      // Start scanning from top-level fields
      await scanFields(schema.fields, document);

      const actualRelationships = {
        references,
        referencedBy: [],
        similar: []
      };

      setRelationships(actualRelationships);
      logger.info('Relationships loaded', {
        documentId: docId,
        relationshipCount: references.length,
        references: references.map(r => ({ field: r.fieldName, title: r.title }))
      });
    } catch (err) {
      logger.error('Failed to load relationships', err);
      setRelationships({ references: [], referencedBy: [], similar: [] });
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

  const getDocumentUrl = async (): Promise<string | null> => {
    if (!document || isNewDocument) return null;
    
    try {
      // Get public URL from settings API
      const response = await apiClient.get<{ settings?: { publicUrl?: string } }>('/config/settings');
      let publicUrl = window.location.origin; // fallback
      
      if (response.success && response.data?.settings?.publicUrl) {
        publicUrl = response.data.settings.publicUrl;
      }
      
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
    } catch (error) {
      logger.warn('Failed to get settings for document URL, using fallback', error);
      
      // Fallback to current origin
      const publicUrl = window.location.origin.replace(/\/$/, '');
      const slug = document.slug || document.id;
      
      if (schema?.name === 'page' || schema?.type === 'singleton') {
        return slug === 'homepage' || slug === 'home' 
          ? publicUrl 
          : `${publicUrl}/${slug}`;
      } else {
        return `${publicUrl}/${schema?.name}/${slug}`;
      }
    }
  };

  const handleDeleteDocument = async () => {
    if (!document || !schema || isNewDocument) return;

    const documentId = document._id || document.id;
    if (!documentId) {
      logger.error('Cannot delete document: no ID found');
      studioContext?.utils?.showToast?.('Cannot delete document: no ID found', 'error');
      return;
    }

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
        documentId,
        title: documentTitle
      });

      const response = await apiClient.deleteDocument(schema.name, documentId);

      if (response.success) {
        studioContext?.utils?.showToast?.('Document deleted', 'success');
        logger.info('Document deleted successfully', {
          schema: schema.name,
          documentId
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

  // Sidebar content - reused for both desktop and mobile
  const sidebarContent = (
    <div className="flex-1 overflow-y-auto">
        {/* Document metadata */}
        <div className="p-4 space-y-4">
          {/* Creation info */}
          {!isNewDocument && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {t('documentEditor.created')}
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
                {t('documentEditor.lastUpdated')}
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
              {t('documentEditor.status')}
            </h4>
            <div className="text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(documentState)}`}>
                {documentState === 'published' ? t('documentEditor.published') : t('documentEditor.draft')}
              </span>
            </div>
            {documentState === 'published' && document?.publishedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('documentEditor.publishedOn', { date: formatDate(document.publishedAt) })}
              </div>
            )}
          </div>

          {/* Public URL - Hidden for now
          {documentState === 'published' && documentUrl && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Public URL
              </h4>
              <div className="flex items-center">
                <LinkIcon className="h-4 w-4 mr-2 text-gray-400" />
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                >
                  View live
                </a>
              </div>
            </div>
          )}
          */}

          {/* Tags/Categories (if available) */}
          {document?.tags && document.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {t('documentEditor.tags')}
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
                {t('documentEditor.contributors')}
              </h4>
              <div className="flex flex-wrap gap-1">
                {contributors.length > 0 ? (
                  contributors.slice(0, 5).map((contributor) => (
                    <span
                      key={contributor.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      title={`${contributor.username} (${contributor.role})`}
                    >
                      <UserIcon className="h-3 w-3 mr-1" />
                      {contributor.username}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('documentEditor.contributorsLoading')}
                  </span>
                )}
                {contributors.length > 5 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('documentEditor.contributorsMore', { count: contributors.length - 5 })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Document relationships */}
        {!isNewDocument && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {relationships?.references?.length > 0
                ? t('documentEditor.referencesCount', { count: relationships.references.length })
                : t('documentEditor.references')}
            </h4>

            {loadingRelationships ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
            ) : relationships?.references?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {relationships.references.slice(0, 8).map((ref: any, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/content/${ref.targetCollection}/${ref.id}`)}
                    title={`${ref.fieldTitle}: ${ref.title}`}
                  >
                    <span className="text-blue-500 dark:text-blue-400 mr-1">[{ref.targetCollection}]</span>
                    {ref.title.length > 15 ? `${ref.title.substring(0, 15)}...` : ref.title}
                  </span>
                ))}
                {relationships.references.length > 8 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                    {t('documentEditor.referencesMore', { count: relationships.references.length - 8 })}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('documentEditor.noReferences')}</div>
            )}
          </div>
        )}

        {/* Schema info */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {t('documentEditor.schema')}
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium">{schema?.title || schema?.name}</div>
            {schema?.description && (
              <div className="text-xs mt-1">{schema.description}</div>
            )}
            <div className="text-xs mt-1">
              {t('documentEditor.fieldsCount', { count: getSchemaFieldCount(schema) })}
            </div>
          </div>
        </div>

        {/* Document history */}
        {!isNewDocument && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <DocumentHistoryPanel
              documentId={document?._id || document?.id || ''}
              collection={schema?.name || ''}
              isVisible={true}
            />
          </div>
        )}

        {/* Danger zone - Delete document (only shown if user can delete) */}
        {!isNewDocument && canDelete && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {t('documentEditor.dangerZone')}
            </h4>
            <button
              onClick={handleDeleteDocument}
              className="w-full flex items-center justify-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
              title={t('documentEditor.deleteDocument')}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              {t('documentEditor.deleteDocument')}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('documentEditor.cannotBeUndone')}
            </p>
          </div>
        )}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => onToggleMobileSidebar(false)}
          />
          {/* Sidebar panel */}
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-50 dark:bg-gray-900 flex flex-col shadow-xl">
            {/* Mobile header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('documentEditor.documentInfo')}
              </h3>
              <button
                onClick={() => onToggleMobileSidebar(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={t('common.close')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop: Collapsed sidebar */}
      {isCollapsed && (
        <div className="hidden md:block w-12 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleCollapsed(false)}
            className="w-full p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={t('documentEditor.expandSidebar')}
          >
            <ChevronRightIcon className="h-5 w-5 mx-auto" />
          </button>
        </div>
      )}

      {/* Desktop: Expanded sidebar */}
      {!isCollapsed && (
        <div className="hidden md:flex w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex-col">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('documentEditor.documentInfo')}
            </h3>
            <button
              onClick={() => toggleCollapsed(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('documentEditor.collapseSidebar')}
            >
              <ChevronDownIcon className="h-5 w-5" />
            </button>
          </div>
          {sidebarContent}
        </div>
      )}
    </>
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