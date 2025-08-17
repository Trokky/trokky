/**
 * DocumentEditorContext - Shared context for document editing
 * 
 * Provides shared state and services for all document editor components
 */

import { createContext, useContext, ReactNode } from 'react';
import type { DocumentState } from './DocumentStates';

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
  isReadOnly: boolean; // User doesn't have write permission
  
  // Loading states
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Actions
  onDocumentChange: (updates: any) => void;
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