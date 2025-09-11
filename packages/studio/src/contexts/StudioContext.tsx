/**
 * Studio Context Provider for v2 Studio
 * Provides field components access to Studio capabilities
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from 'react'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'
import type { StudioContext } from '@trokky/fields'
import type { MediaBrowserConfig } from '@trokky/types/media'
import { MediaBrowser } from '@/components/MediaBrowser'

const StudioContextInstance = createContext<StudioContext | null>(null)

interface StudioContextProviderProps {
  children: React.ReactNode
}

// Simple event emitter for inter-field communication
class FieldEventBus {
  private listeners = new Map<string, Array<(data: any) => void>>()
  private fieldValues = new Map<string, any>()
  private fieldWatchers = new Map<string, Array<(value: any) => void>>()

  emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)

    // Return cleanup function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        const index = eventListeners.indexOf(callback)
        if (index > -1) {
          eventListeners.splice(index, 1)
        }
      }
    }
  }

  getFieldValue(fieldId: string): any {
    return this.fieldValues.get(fieldId)
  }

  setFieldValue(fieldId: string, value: any) {
    this.fieldValues.set(fieldId, value)

    // Notify watchers
    const watchers = this.fieldWatchers.get(fieldId)
    if (watchers) {
      watchers.forEach(callback => callback(value))
    }
  }

  watchField(fieldId: string, callback: (value: any) => void): () => void {
    if (!this.fieldWatchers.has(fieldId)) {
      this.fieldWatchers.set(fieldId, [])
    }
    this.fieldWatchers.get(fieldId)!.push(callback)

    // Send current value immediately if available
    const currentValue = this.fieldValues.get(fieldId)
    if (currentValue !== undefined) {
      callback(currentValue)
    }

    // Return cleanup function
    return () => {
      const watchers = this.fieldWatchers.get(fieldId)
      if (watchers) {
        const index = watchers.indexOf(callback)
        if (index > -1) {
          watchers.splice(index, 1)
        }
      }
    }
  }
}

// Global field event bus instance
const fieldEventBus = new FieldEventBus()

export function StudioContextProvider({
  children,
}: StudioContextProviderProps) {
  // Create a dedicated logger for field components
  const fieldLogger = useMemo(() => createStudioLogger('Fields'), [])

  // Create MediaUrlGenerator immediately with defaults, then update from API
  const [mediaUrlConfig, setMediaUrlConfig] = useState<any>(null)

  // Create a default MediaUrlGenerator that always works
  const mediaUrlGenerator = useMemo(() => {
    return {
      getMediaUrl: (mediaId: string, variant?: string) => {
        // If we have config from API, use it
        if (mediaUrlConfig) {
          const { options } = mediaUrlConfig
          const servingMode = options.mediaConfig?.serving?.mode || 'api'
          const apiBasePath = options.apiBasePath || '/api'
          const staticBasePath =
            options.mediaConfig?.serving?.staticBasePath || '/media'

          // Get the backend URL from apiClient
          const backendUrl = apiClient.getBackendUrl?.() || ''

          if (servingMode === 'static') {
            // For static serving, use base URL without API path
            const baseUrl = backendUrl.replace(/\/[^\/]+$/, '') // Remove last path segment
            const path = variant
              ? `${staticBasePath}/${mediaId}/${variant}`
              : `${staticBasePath}/${mediaId}`
            return `${baseUrl}${path}`
          } else {
            // For API serving, use the media endpoints
            const path = variant
              ? `/media/${mediaId}/variants/${variant}`
              : `/media/${mediaId}/file`
            return `${backendUrl}${path}`
          }
        }

        // Fallback: use apiClient's getMediaUrl if available
        if (apiClient.getMediaUrl) {
          return apiClient.getMediaUrl(mediaId, variant)
        }

        // Last resort: construct URL from backend URL
        const backendUrl = apiClient.getBackendUrl?.() || ''
        const path = variant
          ? `/media/${mediaId}/variants/${variant}`
          : `/media/${mediaId}/file`
        return `${backendUrl}${path}`
      },
    }
  }, [mediaUrlConfig])

  useEffect(() => {
    // Fetch studio config from API endpoint to get proper media serving config
    const fetchStudioConfig = async () => {
      try {
        const response = await apiClient.get('/config/studio')

        if (
          response.success &&
          response.data?.studioConfig?.mediaUrlGenerator
        ) {
          const mediaUrlGenConfig = response.data.studioConfig.mediaUrlGenerator

          setMediaUrlConfig(mediaUrlGenConfig)
        } else {
        }
      } catch (error) {}
    }

    fetchStudioConfig()
  }, [])

  // Media browser state
  const [mediaBrowserState, setMediaBrowserState] = useState<{
    isOpen: boolean
    config: MediaBrowserConfig | null
  }>({
    isOpen: false,
    config: null,
  })

  // Only log once when provider is first created
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window as any).__TROKKY_DEV__ === true
    ) {
    }
  }, [])

  // Toast system (simplified - could be enhanced with a proper toast library)
  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'warning' | 'info' = 'info'
    ) => {
      // Dispatch toast event for visual notification component
      window.dispatchEvent(
        new CustomEvent('studio:toast', {
          detail: { message, type },
        })
      )
    },
    []
  )

  // Confirm dialog
  const showConfirm = useCallback(
    async (
      message: string,
      options?: {
        title?: string
        confirmText?: string
        cancelText?: string
        variant?: 'default' | 'danger'
      }
    ): Promise<boolean> => {
      return new Promise(resolve => {
        window.dispatchEvent(
          new CustomEvent('studio:confirm', {
            detail: {
              message,
              title: options?.title,
              confirmText: options?.confirmText,
              cancelText: options?.cancelText,
              variant: options?.variant,
              resolve,
            },
          })
        )
      })
    },
    []
  )

  // Modal system (simplified - could be enhanced with a proper modal library)
  const openModal = useCallback(
    (component: React.ComponentType, props: any = {}) => {
      // Dispatch event that modal system can listen to
      window.dispatchEvent(
        new CustomEvent('studio:openModal', {
          detail: { component, props },
        })
      )
    },
    []
  )

  const closeModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent('studio:closeModal'))
  }, [])

  // Media browser utilities
  const showMediaBrowser = useCallback((config: MediaBrowserConfig) => {
    setMediaBrowserState({
      isOpen: true,
      config,
    })
  }, [])

  const closeMediaBrowser = useCallback(() => {
    setMediaBrowserState({
      isOpen: false,
      config: null,
    })
  }, [])

  // Create the studio context value
  const studioContext = useMemo((): StudioContext => {
    return {
      apiClient: {
        // Document operations
        getDocuments: apiClient.getDocuments.bind(apiClient),
        getDocument: (type: string, id?: string) =>
          apiClient.getDocument(type, id || ''),
        createDocument: apiClient.createDocument.bind(apiClient),
        updateDocument: apiClient.updateDocument.bind(apiClient),
        deleteDocument: apiClient.deleteDocument.bind(apiClient),

        // Media operations
        getMedia: apiClient.getMedia.bind(apiClient),
        getMediaById: apiClient.getMediaFile.bind(apiClient),
        uploadMedia: (file: File, metadata?: any) =>
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
          const user = localStorage.getItem('currentUser')
          return user ? JSON.parse(user) : null
        },
        hasPermission: (permission: string) => {
          // Get current user and check permissions properly
          const user = localStorage.getItem('currentUser')
          if (!user) return false

          const userData = JSON.parse(user)

          // Admins have all permissions
          if (userData.role === 'admin') return true

          // Check if user has the specific permission
          return userData.permissions?.includes(permission) || false
        },
        getAccessToken: () => {
          return localStorage.getItem('accessToken')
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
        showMediaBrowser,
      },

      logger: {
        debug: fieldLogger.debug.bind(fieldLogger),
        info: fieldLogger.info.bind(fieldLogger),
        warn: fieldLogger.warn.bind(fieldLogger),
        error: fieldLogger.error.bind(fieldLogger),
      },

      // Media URL generator for field components
      mediaUrlGenerator,
    }
  }, [
    showToast,
    showConfirm,
    openModal,
    closeModal,
    showMediaBrowser,
    fieldLogger,
    mediaUrlGenerator,
  ])

  return (
    <StudioContextInstance.Provider value={studioContext}>
      {children}

      {/* Media Browser Modal */}
      {mediaBrowserState.isOpen && mediaBrowserState.config && (
        <MediaBrowser
          isOpen={mediaBrowserState.isOpen}
          onClose={closeMediaBrowser}
          onSelect={value => {
            mediaBrowserState.config?.onSelect(value)
            closeMediaBrowser()
          }}
          mediaTypeFilter={mediaBrowserState.config.mediaTypeFilter}
          showVariantSelector={mediaBrowserState.config.showVariantSelector}
          context={mediaBrowserState.config.context}
          apiClient={apiClient}
          logger={fieldLogger}
          mediaUrlGenerator={mediaUrlGenerator}
        />
      )}
    </StudioContextInstance.Provider>
  )
}

// Hook to use Studio context in components
export function useStudioContext(): StudioContext | null {
  return useContext(StudioContextInstance)
}

// Export field event bus for form integration
export { fieldEventBus }
