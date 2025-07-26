/**
 * Studio Context Provider for v2 Studio
 * Provides field components access to Studio capabilities
 */

import React, { createContext, useContext, useCallback, useMemo, useEffect } from 'react';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import type { StudioContext } from '@trokky/fields';

const StudioContextInstance = createContext<StudioContext | null>(null);

interface StudioContextProviderProps {
  children: React.ReactNode;
}

// Simple event emitter for inter-field communication
class FieldEventBus {
  private listeners = new Map<string, Array<(data: any) => void>>();
  private fieldValues = new Map<string, any>();
  private fieldWatchers = new Map<string, Array<(value: any) => void>>();

  emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return cleanup function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  getFieldValue(fieldId: string): any {
    return this.fieldValues.get(fieldId);
  }

  setFieldValue(fieldId: string, value: any) {
    this.fieldValues.set(fieldId, value);
    
    // Notify watchers
    const watchers = this.fieldWatchers.get(fieldId);
    if (watchers) {
      watchers.forEach(callback => callback(value));
    }
  }

  watchField(fieldId: string, callback: (value: any) => void): () => void {
    if (!this.fieldWatchers.has(fieldId)) {
      this.fieldWatchers.set(fieldId, []);
    }
    this.fieldWatchers.get(fieldId)!.push(callback);

    // Send current value immediately if available
    const currentValue = this.fieldValues.get(fieldId);
    if (currentValue !== undefined) {
      callback(currentValue);
    }

    // Return cleanup function
    return () => {
      const watchers = this.fieldWatchers.get(fieldId);
      if (watchers) {
        const index = watchers.indexOf(callback);
        if (index > -1) {
          watchers.splice(index, 1);
        }
      }
    };
  }
}

// Global field event bus instance
const fieldEventBus = new FieldEventBus();

export function StudioContextProvider({ children }: StudioContextProviderProps) {
  // Create a dedicated logger for field components
  const fieldLogger = useMemo(() => createStudioLogger('Fields'), []);
  
  // Only log once when provider is first created
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TROKKY_DEV__ === true) {
      console.log('v2 StudioContextProvider: Initialized');
    }
  }, []);
  
  // Toast system (simplified - could be enhanced with a proper toast library)
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    // For now, use console - in production you'd integrate with your toast system
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // You could also dispatch a custom event that a toast component listens to
    window.dispatchEvent(new CustomEvent('studio:toast', {
      detail: { message, type }
    }));
  }, []);

  // Confirm dialog
  const showConfirm = useCallback(async (message: string): Promise<boolean> => {
    return window.confirm(message);
  }, []);

  // Modal system (simplified - could be enhanced with a proper modal library)
  const openModal = useCallback((component: React.ComponentType, props: any = {}) => {
    // Dispatch event that modal system can listen to
    window.dispatchEvent(new CustomEvent('studio:openModal', {
      detail: { component, props }
    }));
  }, []);

  const closeModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent('studio:closeModal'));
  }, []);

  // Create the studio context value
  const studioContext = useMemo((): StudioContext => {
    
    return {
      apiClient: {
        // Document operations
        getDocuments: apiClient.getDocuments.bind(apiClient),
        getDocument: (type: string, id?: string) => apiClient.getDocument(type, id || ''),
        createDocument: apiClient.createDocument.bind(apiClient),
        updateDocument: apiClient.updateDocument.bind(apiClient),
        deleteDocument: apiClient.deleteDocument.bind(apiClient),
        
        // Media operations
        getMedia: apiClient.getMedia.bind(apiClient),
        getMediaById: apiClient.getMediaFile.bind(apiClient),
        uploadMedia: (file: File, collection?: string, metadata?: any) => 
          apiClient.uploadMedia(file, metadata),
        deleteMedia: apiClient.deleteMedia.bind(apiClient),
        updateMedia: apiClient.updateMedia.bind(apiClient),
        
        // Schema operations
        getSchemas: apiClient.getSchemas.bind(apiClient),
        getSchema: apiClient.getSchema.bind(apiClient),
        
        // Generic HTTP methods
        get: apiClient.get.bind(apiClient),
        post: apiClient.post.bind(apiClient),
      },
      
      auth: {
        getCurrentUser: () => {
          // Get current user from storage or API client
          const user = localStorage.getItem('currentUser');
          return user ? JSON.parse(user) : null;
        },
        hasPermission: (resource: string, action: string) => {
          // Simple permission check - in production you'd integrate with auth system
          return true; // For demo, allow all permissions
        },
        getAccessToken: () => {
          return localStorage.getItem('accessToken');
        },
      },
      
      fieldEvents: {
        emit: fieldEventBus.emit.bind(fieldEventBus),
        on: fieldEventBus.on.bind(fieldEventBus),
        getFieldValue: fieldEventBus.getFieldValue.bind(fieldEventBus),
        watchField: fieldEventBus.watchField.bind(fieldEventBus),
      },
      
      utils: {
        showToast,
        showConfirm,
        openModal,
        closeModal,
      },
      
      logger: {
        debug: fieldLogger.debug.bind(fieldLogger),
        info: fieldLogger.info.bind(fieldLogger),
        warn: fieldLogger.warn.bind(fieldLogger),
        error: fieldLogger.error.bind(fieldLogger),
      },
    };
  }, [showToast, showConfirm, openModal, closeModal, fieldLogger]);

  return (
    <StudioContextInstance.Provider value={studioContext}>
      {children}
    </StudioContextInstance.Provider>
  );
}

// Hook to use Studio context in components
export function useStudioContext(): StudioContext | null {
  return useContext(StudioContextInstance);
}

// Export field event bus for form integration
export { fieldEventBus };