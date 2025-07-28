/**
 * DocumentEditor - Extensible Foundation for Document Editing
 * 
 * This is the main component for the new document editor system.
 * Designed to be extensible and support multiple editing modes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { createStudioLogger } from '@/utils/logger';
import { apiClient, ApiClientError } from '@/services/api-client';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';

// Document editor context and components
import { DocumentEditorProvider, useDocumentEditor } from './DocumentEditorContext';
import { DocumentStates, type DocumentState } from './DocumentStates';
import { DocumentForm } from './DocumentForm';
import { DocumentHeader } from './DocumentHeader';
import { DocumentSidebar } from './DocumentSidebar';

const logger = createStudioLogger('DocumentEditor');

// Helper function to get user-friendly display names
function getSchemaDisplayName(schemaName?: string): string {
  if (!schemaName) return 'Document';
  
  const displayNames: Record<string, string> = {
    'article': 'Article',
    'author': 'Author', 
    'category': 'Category',
    'homePage': 'Home Page',
    'settings': 'Site Settings',
    'post': 'Post'
  };
  
  return displayNames[schemaName] || schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
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
  const navigate = useNavigate();
  const contextSidebar = useContextSidebar();
  const isNewDocument = documentId === 'new' || !documentId;

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

  // Load schema and document on mount
  useEffect(() => {
    if (schemaName) {
      loadEditorData();
    }
  }, [schemaName, documentId]);

  // Hide/show ContextSidebar (left sidebar) based on singleton status
  useEffect(() => {
    if (schema) {
      if (schema.singleton) {
        contextSidebar.hide(); // Hide left sidebar for singleton documents
      } else {
        contextSidebar.show(); // Show left sidebar for regular documents
      }
    }
  }, [schema, contextSidebar]);

  // Cleanup: Show ContextSidebar when component unmounts (when navigating away)
  useEffect(() => {
    return () => {
      contextSidebar.show();
    };
  }, [contextSidebar]);

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
      
      // Extract the actual schema from the nested structure
      const actualSchema = schemaResponse.data.schema;
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
        // Initialize empty document for new documents
        const newDoc = initializeNewDocument(actualSchema);
        setDocument(newDoc);
        setDocumentState('draft');
        logger.debug('New document initialized');
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
      _state: 'draft',
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString()
    };

    // Add default title for new documents
    if (!doc.title && !doc.name) {
      // Check if this has a specific ID (likely a singleton)
      if (doc.id && doc.id !== 'new') {
        doc.title = getSchemaDisplayName(schemaName);
      } else {
        doc.title = `New ${getSchemaDisplayName(schemaName)}`;
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
    // Check various fields that might indicate state
    if (doc._state) return doc._state;
    if (doc.status) return doc.status;
    if (doc.published === true) return 'published';
    if (doc.published === false) return 'draft';
    
    // Default to draft
    return 'draft';
  };

  const handleDocumentChange = useCallback((updates: any) => {
    setDocument(prev => ({
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
      // Apply state change to document
      const updatedDocument = {
        ...document,
        _state: newState,
        _updatedAt: new Date().toISOString()
      };

      // Add state-specific fields
      if (newState === 'published') {
        updatedDocument.published = true;
        updatedDocument.publishedAt = new Date().toISOString();
      } else if (newState === 'draft') {
        updatedDocument.published = false;
        updatedDocument.publishedAt = null;
      }

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

      let response;
      if (isNewDocument) {
        response = await apiClient.createDocument(schemaName, document);
      } else {
        response = await apiClient.updateDocument(schemaName, documentId!, document);
      }

      if (response.success && response.data) {
        const savedDoc = response.data;
        setDocument(savedDoc);
        setHasUnsavedChanges(false);

        logger.info('Document saved', { 
          schema: schemaName, 
          id: savedDoc.id || savedDoc._id,
          state: documentState
        });

        // Call external save handler if provided
        onSave?.(savedDoc);

        // Redirect to edit mode if it was a new document
        if (isNewDocument) {
          navigate(`/content/${schemaName}/${savedDoc.id || savedDoc._id}`);
        }
      }
    } catch (err) {
      logger.error('Failed to save document', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  }, [document, schema, isNewDocument, schemaName, documentId, documentState, onSave, navigate]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }

    onCancel?.() || navigate(`/content/${schemaName}`);
  }, [hasUnsavedChanges, onCancel, navigate, schemaName]);

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
            Loading {isNewDocument ? 'schema' : 'document'}...
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
            <h3 className="text-lg font-medium">Error</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={handleCancel}>Back to Documents</Button>
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
  const { document } = useDocumentEditor();

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Document Preview
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
  const { schemaName, documentId } = useParams();

  if (!schemaName) {
    logger.warn('DocumentEditorPage rendered without schema name');
    return <div>Schema name is required</div>;
  }

  return (
    <DocumentEditor 
      schemaName={schemaName} 
      documentId={documentId}
    />
  );
}