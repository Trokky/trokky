/**
 * DocumentEditor - Extensible Foundation for Document Editing
 * 
 * This is the main component for the new document editor system.
 * Designed to be extensible and support multiple editing modes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { createStudioLogger } from '@/utils/logger';
import { apiClient, ApiClientError } from '@/services/api-client';
import { useStructureContextSidebar } from '@/hooks/useStructureContextSidebar';
import { useStudioContext } from '@/contexts/StudioContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useT } from '@trokky/i18n';

// Document editor context and components
import { DocumentEditorProvider, useDocumentEditor } from './DocumentEditorContext';
import { DocumentStates, type DocumentState } from './DocumentStates';
import { DocumentForm } from './DocumentForm';
import { DocumentHeader } from './DocumentHeader';
import { DocumentSidebar } from './DocumentSidebar';

const logger = createStudioLogger('DocumentEditor');

// Helper function to get user-friendly display names
function getSchemaDisplayName(schemaName?: string, schema?: any): string {
  if (!schemaName) return 'Document';
  
  // Use schema title if available
  if (schema?.title) return schema.title;
  
  // Fallback to formatted schema name
  return schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
}

// Helper function to get document display title
function getDocumentDisplayTitle(document: any, schema: any, schemaName: string): string {
  if (!document) return `New ${getSchemaDisplayName(schemaName, schema)}`;
  
  // Try common title fields first
  if (document.title) return document.title;
  if (document.name) return document.name;
  
  // Fallback to first field value
  if (schema?.fields) {
    const fields = Array.isArray(schema.fields) 
      ? schema.fields 
      : Object.entries(schema.fields).map(([name, field]) => ({ name, ...field }));
    
    const firstField = fields[0];
    if (firstField && document[firstField.name]) {
      const value = document[firstField.name];
      return typeof value === 'string' ? value : `New ${getSchemaDisplayName(schemaName, schema)}`;
    }
  }
  
  return `New ${getSchemaDisplayName(schemaName, schema)}`;
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

  // Check if user has delete permission for this schema
  const hasDeletePermission = useMemo(() => {
    if (!permissions) return false;
    return permissions.hasSchemaPermission(schemaName, 'delete');
  }, [permissions, schemaName, permissions?.isAdmin, permissions?.userPermissions?.length]);

  logger.debug('Initializing document editor', { 
    schemaName, 
    documentId, 
    isNewDocument 
  });

  // Core editor state
  const [document, setDocument] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState(mode);
  
  // Document state management
  const [documentState, setDocumentState] = useState<DocumentState>('draft');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
      
      if (!apiClient.isInitialized) {
        logger.debug('Initializing API client');
        await apiClient.initialize();
      }

      // Load schema
      const schemaResponse = await apiClient.getSchema(schemaName);
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
        const docResponse = await apiClient.getDocument(schemaName, documentId);
        logger.debug('Document response received', { 
          success: docResponse.success, 
          hasData: !!docResponse.data
        });
        
        if (docResponse.success && docResponse.data && docResponse.data.document) {
          const actualDocument = docResponse.data.document;
          setDocument(actualDocument);
          
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
          setDocument(newDoc);
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
        setDocument(newDoc);
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

    // Initialize default values from schema
    if (schema.fields) {
      // Handle both object and array field formats
      if (Array.isArray(schema.fields)) {
        schema.fields.forEach((field: any) => {
          if (field.default !== undefined) {
            doc[field.name] = field.default;
          }
        });
      } else if (typeof schema.fields === 'object') {
        Object.entries(schema.fields).forEach(([fieldName, field]: [string, any]) => {
          if (field.default !== undefined) {
            doc[fieldName] = field.default;
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

  const handleDocumentChange = useCallback((updates: any) => {
    setDocument((prev: any) => ({
      ...prev,
      ...updates,
      _updatedAt: new Date().toISOString()
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasValidationErrors(hasErrors);
  }, []);

  const handleStateChange = useCallback(async (newState: DocumentState) => {
    if (!DocumentStates.canTransition(documentState, newState)) {
      logger.warn('Invalid state transition', { from: documentState, to: newState });
      return;
    }

    try {
      // Apply state change to document using _status as single source of truth
      const updatedDocument = {
        ...document,
        _status: newState, // Use _status instead of _state
        _updatedAt: new Date().toISOString()
      };

      // Add publishedAt timestamp for published documents
      if (newState === 'published') {
        updatedDocument.publishedAt = new Date().toISOString();
      } else if (newState === 'draft') {
        // Remove publishedAt when reverting to draft
        updatedDocument.publishedAt = null;
      }

      // Remove legacy fields to avoid confusion
      delete updatedDocument._state;
      delete updatedDocument.published;

      setDocument(updatedDocument);
      setDocumentState(newState);
      setHasUnsavedChanges(true);

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
  }, [documentState, document, schemaName, documentId]);

  const handleSave = useCallback(async () => {
    if (!document || !schema) return;
    
    // Check if user has write permission
    if (!hasWritePermission) {
      showToast(`You don't have permission to edit ${getSchemaDisplayName(schemaName, schema)}`, 'error');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Trigger field validation first, then wait briefly for UI to update
      // The DocumentForm will show inline validation errors
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Basic validation check
      const validation = validateDocument(document, schema);
      if (!validation.isValid) {
        logger.warn('Document validation failed - check inline field errors', { errors: validation.errors });
        setSaving(false);
        return;
      }

      // Clean document data before sending to API - remove frontend-only fields and ensure _status is set
      const cleanDocument = { ...document };
      delete cleanDocument._state; // Remove legacy frontend state field

      // Ensure _status is properly set based on current document state
      if (!cleanDocument._status) {
        cleanDocument._status = documentState || 'draft';
      }

      // Ensure all schema fields are present and type-compatible
      // This prevents old field values from persisting when schema types change
      if (schema?.fields) {
        for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
          const value = cleanDocument[fieldName];
          const fieldType = (fieldDef as any).type;

          // Check for type mismatches and clear incompatible values
          if (value !== undefined && value !== null) {
            const isArray = Array.isArray(value);
            const isObject = typeof value === 'object' && !isArray;

            // Clear if schema expects object but got array, or vice versa
            if ((fieldType === 'object' && isArray) ||
                (fieldType === 'array' && isObject)) {
              // Use appropriate empty value for the expected type
              cleanDocument[fieldName] = fieldType === 'object' ? {} : [];
            }
          }

          // Only add missing fields if they are object or array type
          // (to override potentially incompatible stored values)
          // Don't add scalar fields - they will use stored values
          if (!(fieldName in cleanDocument)) {
            if (fieldType === 'object') {
              cleanDocument[fieldName] = {};
            } else if (fieldType === 'array') {
              cleanDocument[fieldName] = [];
            }
            // Don't add scalar fields - let the backend merge with existing
          }
        }
      }

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
        
        setDocument(savedDoc);
        setHasUnsavedChanges(false);

        // Show success toast
        showToast('Saved', 'success');

        // Call external save handler if provided
        onSave?.(savedDoc);

        // Redirect to edit mode if it was a new document
        if (isNewDocument) {
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
          documentData: document 
        });
        showToast(errorMessage, 'error');
      }
    } catch (err) {
      logger.error('Failed to save document', err);
      const errorMessage = err instanceof ApiClientError ? err.message : 'Failed to save document';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  }, [document, schema, isNewDocument, schemaName, documentId, documentState, onSave, navigate, hasWritePermission, showToast]);

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

    onCancel?.() || navigate(`/content/${schemaName}`);
  }, [hasUnsavedChanges, onCancel, navigate, schemaName, studioContext]);

  const validateDocument = (doc: any, schema: any) => {
    const errors: string[] = [];

    if (schema.fields) {
      // Handle both object and array field formats
      if (Array.isArray(schema.fields)) {
        schema.fields.forEach((field: any) => {
          if (field.required && (!doc[field.name] || doc[field.name] === '')) {
            errors.push(`${field.title || field.name} is required`);
          }
        });
      } else if (typeof schema.fields === 'object') {
        Object.entries(schema.fields).forEach(([fieldName, field]: [string, any]) => {
          if (field.required && (!doc[fieldName] || doc[fieldName] === '')) {
            errors.push(`${field.title || fieldName} is required`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };


  // Prepare editor context value
  const editorContextValue = useMemo(() => ({
    schema,
    document,
    documentState,
    currentMode,
    isNewDocument,
    hasUnsavedChanges,
    hasValidationErrors,
    isReadOnly: !hasWritePermission, // Set read-only when user lacks write permission
    isMobileSidebarOpen,
    onToggleMobileSidebar: setIsMobileSidebarOpen,
    loading,
    saving,
    error,
    onDocumentChange: handleDocumentChange,
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
    hasWritePermission, // Add this dependency
    isMobileSidebarOpen,
    loading,
    saving,
    error,
    handleDocumentChange,
    handleStateChange,
    handleSave,
    handleCancel,
    handleValidationChange
  ]);

  if (loading) {
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