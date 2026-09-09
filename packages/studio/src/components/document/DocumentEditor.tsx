/**
 * DocumentEditor - Extensible Foundation for Document Editing
 * 
 * This is the main component for the new document editor system.
 * Designed to be extensible and support multiple editing modes.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation, useBlocker } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { createStudioLogger } from '@/utils/logger';
import { apiClient, ApiClientError } from '@/services/api-client';
import { useStructureContextSidebar } from '@/hooks/useStructureContextSidebar';
import { useStudioContext } from '@/contexts/StudioContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useT } from '@trokky/trokky/i18n';

// Document editor context and components
import { DocumentEditorProvider, useDocumentEditor } from './DocumentEditorContext';
import { DocumentStates, type DocumentState } from './DocumentStates';
import { DocumentForm, evaluateConditional } from './DocumentForm';
import { buildSavePayload, resolveFieldDefault } from './savePayload';
import { collectValidationErrors, useDocumentStore } from './documentStore.js';
import { DocumentHeader } from './DocumentHeader';
import { DocumentSidebar } from './DocumentSidebar';
import { fieldRegistry } from '@/fields/registry/index.js';

const logger = createStudioLogger('DocumentEditor');

/** Cache key for a schema definition. */
export const SCHEMA_QUERY_KEY = (schemaName: string) =>
  ['schema', schemaName] as const;

/** Cache key for one document of a schema. */
export const DOCUMENT_QUERY_KEY = (schemaName: string, documentId?: string) =>
  ['document', schemaName, documentId] as const;

// Helper function to get user-friendly display names
function getSchemaDisplayName(schemaName?: string, schema?: any): string {
  if (!schemaName) return 'Document';
  
  // Use schema title if available
  if (schema?.title) return schema.title;
  
  // Fallback to formatted schema name
  return schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
}

// Append server-provided field paths to a validation error message
function formatSaveError(message: string, details?: any): string {
  if (!Array.isArray(details) || details.length === 0) return message;

  const fields = details
    .map((detail: any) => detail?.field)
    .filter((field: any) => typeof field === 'string' && field.length > 0);

  if (fields.length === 0) return message;

  return `${message}: ${fields.join(', ')}`;
}

export interface DocumentEditorProps {
  schemaName: string;
  documentId?: string;
  mode?: 'form' | 'preview'; // Start with basic modes, extensible for future
  onSave?: (document: any) => void;
  onCancel?: () => void;
}

/**
 * Main DocumentEditor component
 */
export function DocumentEditor({
  schemaName,
  documentId,
  mode = 'form',
  onSave,
  onCancel
}: DocumentEditorProps) {
  const { t } = useT('studio');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  // Use structure-driven context sidebar instead of manual configuration
  useStructureContextSidebar();
  const studioContext = useStudioContext();
  const permissions = usePermissions();

  // Check for duplicate data from navigation state
  const duplicateData = (location.state as any)?.duplicateData;
  
  // Debug permissions object
  useEffect(() => {
    logger.debug('Permissions object state', {
      hasPermissions: !!permissions,
      isAdmin: permissions?.isAdmin,
      userPermissions: permissions?.userPermissions,
      schemaName
    });
  }, [permissions, schemaName]);
  const showToast = studioContext?.utils?.showToast || ((msg: string, type: string) => console.log(`Toast: ${type} - ${msg}`));
  const isNewDocument = documentId === 'new' || !documentId;
  
  // Check if user has write permission for this schema
  const hasWritePermission = useMemo(() => {
    if (!permissions) {
      return false;
    }
    
    const result = permissions.hasSchemaPermission(schemaName, 'write');
    return result;
  }, [permissions, schemaName, permissions?.isAdmin, permissions?.userPermissions?.length]);

  // Check if user has publish permission for this schema
  const hasPublishPermission = useMemo(() => {
    if (!permissions) return false;
    return permissions.hasSchemaPermission(schemaName, 'publish');
  }, [permissions, schemaName, permissions?.isAdmin, permissions?.userPermissions?.length]);

  logger.debug('Initializing document editor', { 
    schemaName, 
    documentId, 
    isNewDocument 
  });

  // Core editor state: one form-state model for the document being edited
  const store = useDocumentStore();
  const document = store.document;
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState(mode);
  
  // Document state management
  const [documentState, setDocumentState] = useState<DocumentState>('draft');
  const hasUnsavedChanges = store.isDirty;
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Set right before a navigation the editor performs itself (save redirect,
  // confirmed cancel) so the unsaved-changes guard does not prompt twice.
  const skipNavigationBlockRef = useRef(false);

  // Field plugins own their validation rules; the store walks the schema and
  // asks them, skipping fields hidden by conditional visibility.
  const validationOptions = useMemo(() => ({
    getPlugin: (type: string) => fieldRegistry.get(type) as any,
    isVisible: (fieldDefinition: any, values: Record<string, any>) =>
      evaluateConditional(fieldDefinition, values || {}).visible
  }), []);

  // Warn before a full page unload while there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Block in-app navigation while there are unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skipNavigationBlockRef.current) {
      skipNavigationBlockRef.current = false;
      return false;
    }
    return hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname;
  });

  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    let cancelled = false;
    const ask = async () => {
      const confirmed = studioContext?.utils?.showConfirm
        ? await studioContext.utils.showConfirm(
            'You have unsaved changes. Are you sure you want to leave?',
            {
              title: 'Unsaved Changes',
              confirmText: 'Discard Changes',
              cancelText: 'Keep Editing',
              variant: 'danger'
            }
          )
        : window.confirm('You have unsaved changes. Are you sure you want to leave?');

      if (cancelled) return;
      if (confirmed) {
        blockerRef.current.proceed?.();
      } else {
        blockerRef.current.reset?.();
      }
    };

    void ask();
    return () => {
      cancelled = true;
    };
  }, [blocker.state, studioContext]);

  // Load schema and document on mount
  useEffect(() => {
    if (schemaName) {
      loadEditorData();
    }
  }, [schemaName, documentId]);

  // Structure-driven context sidebar is now handled by useStructureContextSidebar hook
  // No manual configuration needed - it reads from structure.js configuration

  const loadEditorData = async () => {
    try {
      logger.debug('Loading editor data', { schemaName, documentId });
      setLoading(true);
      setError(null);
      
      // Schemas change only when a developer redeploys, so the editor reads
      // them through the query cache: remounting to edit a sibling document, or
      // StrictMode's double mount, no longer refetches.
      const schemaResponse = await queryClient.fetchQuery({
        queryKey: SCHEMA_QUERY_KEY(schemaName),
        queryFn: () => apiClient.getSchema(schemaName),
        retry: false,
      });
      logger.debug('Schema loaded', { 
        success: schemaResponse.success, 
        hasData: !!schemaResponse.data
      });
      
      if (!schemaResponse.success || !schemaResponse.data || !schemaResponse.data.schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }
      
      // Extract the schema from the nested response structure
      const actualSchema = schemaResponse.data.schema;
      
      // Debug the actual schema and its featuredImage field
      logger.debug('Schema loaded for editing', { 
        schemaName,
        hasFields: !!actualSchema.fields
      });
      logger.debug('Schema extracted', {
        schemaName: actualSchema?.name,
        singleton: actualSchema?.singleton
      });
      setSchema(actualSchema);

      // Load document if editing existing
      if (!isNewDocument && documentId) {
        // Documents are shared editing surfaces on a multi-editor CMS, so this
        // read stays fresh (staleTime 0) and only de-duplicates concurrent and
        // double-mounted requests rather than serving a cached copy.
        const docResponse = await queryClient.fetchQuery({
          queryKey: DOCUMENT_QUERY_KEY(schemaName, documentId),
          queryFn: () => apiClient.getDocument(schemaName, documentId),
          staleTime: 0,
          retry: false,
        });
        logger.debug('Document response received', { 
          success: docResponse.success, 
          hasData: !!docResponse.data
        });
        
        if (docResponse.success && docResponse.data && docResponse.data.document) {
          const actualDocument = docResponse.data.document;
          store.load(actualDocument);
          
          // Set document state based on document data
          const state = determineDocumentState(actualDocument);
          setDocumentState(state);
          logger.debug('Existing document loaded', { documentId, state });
        } else {
          // Document not found - check if this might be a singleton that needs auto-creation
          logger.warn('Document not found, attempting auto-creation for singleton', { 
            schema: schemaName, 
            documentId 
          });
          
          // Initialize as new document but with the specific ID
          const newDoc = initializeNewDocument(actualSchema);
          newDoc.id = documentId; // Set the specific singleton ID
          store.load(newDoc);
          setDocumentState('draft');
          logger.debug('Singleton document initialized', { documentId });
          
          // Note: This will be saved when user clicks save, effectively auto-creating the singleton
        }
      } else {
        // Initialize document for new documents
        // Use duplicate data if provided, otherwise initialize empty document
        const newDoc = duplicateData
          ? { ...initializeNewDocument(actualSchema), ...duplicateData }
          : initializeNewDocument(actualSchema);
        store.load(newDoc);
        setDocumentState('draft');
        logger.debug('New document initialized', { isDuplicate: !!duplicateData });
      }
      
      logger.info('Editor data loaded successfully', { 
        schema: schemaName, 
        isNew: isNewDocument 
      });
    } catch (err) {
      logger.error('Failed to load editor data', err);
      setError(err instanceof Error ? err.message : 'Failed to load editor data');
    } finally {
      setLoading(false);
    }
  };

  const initializeNewDocument = (schema: any) => {
    const doc: any = {
      _type: schemaName,
      _status: 'draft', // Use _status instead of _state for consistency
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString()
    };

    // Add default title for new documents
    if (!doc.title && !doc.name) {
      // Check if this has a specific ID (likely a singleton)
      if (doc.id && doc.id !== 'new') {
        doc.title = getSchemaDisplayName(schemaName, schema);
      } else {
        doc.title = `New ${getSchemaDisplayName(schemaName, schema)}`;
      }
    }

    const resolveDefault = (field: any) =>
      resolveFieldDefault(field, type => fieldRegistry.get(type));

    if (schema.fields) {
      // Handle both object and array field formats
      if (Array.isArray(schema.fields)) {
        schema.fields.forEach((field: any) => {
          if (field.default !== undefined) {
            doc[field.name] = resolveDefault(field);
          }
        });
      } else if (typeof schema.fields === 'object') {
        Object.entries(schema.fields).forEach(([fieldName, field]: [string, any]) => {
          if (field.default !== undefined) {
            doc[fieldName] = resolveDefault({ name: fieldName, ...field });
          }
        });
      }
    }

    return doc;
  };

  const determineDocumentState = (doc: any): DocumentState => {
    // Use _status as the primary source of truth
    if (doc._status) return doc._status;
    
    // Fallback to legacy fields for backward compatibility
    if (doc._state) return doc._state;
    if (doc.status) return doc.status;
    if (doc.published === true) return 'published';
    if (doc.published === false) return 'draft';
    
    // Default to draft
    return 'draft';
  };

  // Field edits land in the store one path at a time. `_updatedAt` is the
  // server's business and is no longer stamped on every keystroke.
  const handleDocumentChange = useCallback((updates: any) => {
    if (!updates || typeof updates !== 'object') return;
    Object.entries(updates).forEach(([name, value]) => {
      store.setValue([name], value);
    });
  }, [store.setValue]);

  // Blur re-validates just the field that was left, keeping every other error
  const handleFieldBlur = useCallback((path: (string | number)[]) => {
    if (!schema || path.length === 0) return;

    const { current, errors } = store.getState();
    const fieldErrors = collectValidationErrors(current, schema, {
      ...validationOptions,
      rootPath: path
    });

    const root = String(path[0]);
    const next: Record<string, string> = {};
    for (const [key, message] of Object.entries(errors)) {
      if (key === root || key.startsWith(`${root}.`) || key.startsWith(`${root}[`)) continue;
      next[key] = message;
    }
    Object.assign(next, fieldErrors);
    store.setErrors(next);
  }, [schema, store.getState, store.setErrors, validationOptions]);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasValidationErrors(hasErrors);
  }, []);

  const handleStateChange = useCallback(async (newState: DocumentState) => {
    if (!DocumentStates.canTransition(documentState, newState)) {
      logger.warn('Invalid state transition', { from: documentState, to: newState });
      return;
    }

    // Check for publish permission when publishing or unpublishing
    const isPublishing = newState === 'published' && documentState !== 'published';
    const isUnpublishing = newState !== 'published' && documentState === 'published';

    if ((isPublishing || isUnpublishing) && !hasPublishPermission) {
      const action = isPublishing ? t('publish') : t('unpublish');
      showToast(t('documentEditor.noPublishPermission', { action }), 'error');
      logger.warn('User lacks publish permission for state change', {
        from: documentState,
        to: newState,
        hasPublishPermission
      });
      return;
    }

    try {
      // Apply state change to document using _status as single source of truth
      store.setValue(['_status'], newState);

      // Add publishedAt timestamp for published documents
      if (newState === 'published') {
        store.setValue(['publishedAt'], new Date().toISOString());
      } else if (newState === 'draft') {
        // Remove publishedAt when reverting to draft
        store.setValue(['publishedAt'], null);
      }

      // Drop legacy fields to avoid confusion
      store.setValue(['_state'], undefined);
      store.setValue(['published'], undefined);

      setDocumentState(newState);

      logger.info('Document state changed', {
        schema: schemaName,
        documentId,
        oldState: documentState,
        newState
      });
    } catch (err) {
      logger.error('Failed to change document state', err);
      alert('Failed to change document state');
    }
  }, [documentState, store.setValue, schemaName, documentId, hasPublishPermission, showToast, t]);

  const handleSave = useCallback(async () => {
    const currentDocument = store.getState().current;
    if (!currentDocument || !schema) return;
    
    // Check if user has write permission
    if (!hasWritePermission) {
      showToast(`You don't have permission to edit ${getSchemaDisplayName(schemaName, schema)}`, 'error');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      store.setStatus('saving');

      // Validate the whole document from the store, one errors map for the form
      const validationErrors = collectValidationErrors(currentDocument, schema, validationOptions);
      store.setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        logger.warn('Document validation failed - check inline field errors', { errors: validationErrors });
        showToast(Object.values(validationErrors).join(', '), 'error');
        store.setStatus('error');
        setSaving(false);
        return;
      }

      // Build the payload from schema fields plus _status/_type only
      const cleanDocument = buildSavePayload(
        currentDocument,
        schema,
        documentState,
        // The loaded baseline, so an untouched field is omitted rather than nulled
        store.getState().initial
      );

      let response;
      if (isNewDocument) {
        response = await apiClient.createDocument(schemaName, cleanDocument);
      } else {
        response = await apiClient.updateDocument(schemaName, documentId!, cleanDocument);
      }

      if (response.success && response.data) {
        // Extract the actual document from the response
        const savedDoc = response.data.document || response.data;
        
        logger.info('Document saved successfully', { 
          schema: schemaName, 
          id: savedDoc.id || savedDoc._id,
          isNewDocument,
          savedDocumentData: savedDoc
        });
        
        store.markSaved(savedDoc);

        // The cached copy of this document is now the pre-save one
        queryClient.invalidateQueries({ queryKey: DOCUMENT_QUERY_KEY(schemaName, documentId) });

        // Show success toast
        showToast('Saved', 'success');

        // Call external save handler if provided
        onSave?.(savedDoc);

        // Redirect to edit mode if it was a new document
        if (isNewDocument) {
          skipNavigationBlockRef.current = true;
          navigate(`/content/${schemaName}/${savedDoc.id || savedDoc._id}`);
        } else {
          // For existing documents, ensure the UI refreshes
          logger.debug('Updated existing document, refreshing UI state');
        }
      } else {
        // Handle API error response without throwing
        const errorMessage = response.error?.message || 'Failed to save document';
        logger.error('Save failed with API error', {
          error: response.error,
          fullResponse: response,
          documentData: currentDocument
        });
        store.setStatus('error');
        showToast(formatSaveError(errorMessage, (response.error as any)?.details), 'error');
      }
    } catch (err) {
      logger.error('Failed to save document', err);
      const errorMessage = err instanceof ApiClientError ? err.message : 'Failed to save document';
      const details = err instanceof ApiClientError ? err.details : undefined;
      store.setStatus('error');
      showToast(formatSaveError(errorMessage, details), 'error');
    } finally {
      setSaving(false);
    }
  }, [schema, isNewDocument, schemaName, documentId, documentState, onSave, navigate, hasWritePermission, showToast, store.getState, store.setErrors, store.setStatus, store.markSaved, validationOptions]);

  const handleCancel = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await studioContext?.utils?.showConfirm?.(
        'You have unsaved changes. Are you sure you want to cancel?',
        {
          title: 'Unsaved Changes',
          confirmText: 'Discard Changes',
          cancelText: 'Keep Editing',
          variant: 'danger'
        }
      );
      if (!confirmed) {
        return;
      }
    }

    skipNavigationBlockRef.current = true;
    // Not `onCancel?.() || navigate(...)`: onCancel returns undefined, so the fallback ran
    // every time and a caller that handled the cancel itself was navigated away anyway.
    if (onCancel) {
      onCancel();
    } else {
      navigate(`/content/${schemaName}`);
    }
  }, [hasUnsavedChanges, onCancel, navigate, schemaName, studioContext]);

  // Prepare editor context value
  const editorContextValue = useMemo(() => ({
    schema,
    document,
    documentState,
    currentMode,
    isNewDocument,
    hasUnsavedChanges,
    hasValidationErrors,
    errors: store.errors,
    isReadOnly: !hasWritePermission, // Set read-only when user lacks write permission
    hasPublishPermission, // User has permission to publish/unpublish
    isMobileSidebarOpen,
    onToggleMobileSidebar: setIsMobileSidebarOpen,
    loading,
    saving,
    error,
    onDocumentChange: handleDocumentChange,
    onFieldBlur: handleFieldBlur,
    onStateChange: handleStateChange,
    onModeChange: setCurrentMode,
    onSave: handleSave,
    onCancel: handleCancel,
    onValidationChange: handleValidationChange
  }), [
    schema,
    document,
    documentState,
    currentMode,
    isNewDocument,
    hasUnsavedChanges,
    hasValidationErrors,
    store.errors,
    hasWritePermission,
    hasPublishPermission,
    isMobileSidebarOpen,
    loading,
    saving,
    error,
    handleDocumentChange,
    handleFieldBlur,
    handleStateChange,
    handleSave,
    handleCancel,
    handleValidationChange
  ]);

  // Wait for the current user to resolve before rendering the form, otherwise
  // fields are created in read-only mode with a no-op onChange. A failed lookup
  // must not hold the editor on the spinner: render read-only instead.
  const permissionsLoading = permissions?.loading === true;

  if (loading || permissionsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {isNewDocument ? t('documentEditor.loadingSchema') : t('documentEditor.loadingDocument')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <h3 className="text-lg font-medium">{t('common.error')}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={handleCancel}>{t('documentEditor.backToDocuments')}</Button>
        </div>
      </div>
    );
  }

  return (
    <DocumentEditorProvider value={editorContextValue}>
      <div className="h-full flex flex-col">
        {/* Document header with state management */}
        <DocumentHeader />

        <div className="flex-1 flex overflow-hidden">
          {/* Main editing area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {currentMode === 'form' && <DocumentForm />}
            {currentMode === 'preview' && <DocumentPreview />}
          </div>

          {/* Document sidebar with context and relationships - always shown */}
          <DocumentSidebar />
        </div>
      </div>
    </DocumentEditorProvider>
  );
}

/**
 * Document preview mode (placeholder for now)
 */
function DocumentPreview() {
  const { t } = useT('studio');
  const { document } = useDocumentEditor();

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {t('documentEditor.documentPreview')}
        </h3>
        <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
          {JSON.stringify(document, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Standalone DocumentEditor for routing
 */
export function DocumentEditorPage() {
  const { t } = useT('studio');
  const { schemaName, documentId } = useParams();

  if (!schemaName) {
    logger.warn('DocumentEditorPage rendered without schema name');
    return <div>{t('documentEditor.schemaRequired')}</div>;
  }

  return (
    <DocumentEditor
      schemaName={schemaName}
      documentId={documentId}
    />
  );
}