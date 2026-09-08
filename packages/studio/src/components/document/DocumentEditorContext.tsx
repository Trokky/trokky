/**
 * DocumentEditorContext - Shared context for document editing
 * 
 * Provides shared state and services for all document editor components
 */

import { createContext, useContext, ReactNode } from 'react';
import type { DocumentState } from './DocumentStates';
import type { DocumentPath } from './documentStore.js';

export interface DocumentEditorContextType {
  // Document data
  schema: any | null;
  document: any | null;
  documentState: DocumentState;

  // Editor state
  currentMode: 'form' | 'preview';
  isNewDocument: boolean;
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  /** Validation errors from the store, keyed by field path. */
  errors: Record<string, string>;
  isReadOnly: boolean; // User doesn't have write permission
  hasPublishPermission: boolean; // User has permission to publish/unpublish

  // Mobile sidebar state
  isMobileSidebarOpen: boolean;
  onToggleMobileSidebar: (open: boolean) => void;

  // Loading states
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Actions
  onDocumentChange: (updates: any) => void;
  /** Re-run validation for one field subtree, typically on blur. */
  onFieldBlur: (path: DocumentPath) => void;
  onStateChange: (newState: DocumentState) => void;
  onModeChange: (mode: 'form' | 'preview') => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onValidationChange: (hasErrors: boolean) => void;
}

const DocumentEditorContext = createContext<DocumentEditorContextType | null>(null);

export interface DocumentEditorProviderProps {
  value: DocumentEditorContextType;
  children: ReactNode;
}

export function DocumentEditorProvider({ value, children }: DocumentEditorProviderProps) {
  return (
    <DocumentEditorContext.Provider value={value}>
      {children}
    </DocumentEditorContext.Provider>
  );
}

export function useDocumentEditor(): DocumentEditorContextType {
  const context = useContext(DocumentEditorContext);
  
  if (!context) {
    throw new Error('useDocumentEditor must be used within a DocumentEditorProvider');
  }
  
  return context;
}