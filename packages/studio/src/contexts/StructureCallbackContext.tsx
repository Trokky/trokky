/**
 * Structure Callback Context Provider
 * Provides comprehensive context data to structure callback functions
 */

import { createContext, useContext, useMemo, ReactNode } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useStudioContext } from './StudioContext'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useStructure, useStructureItem } from '@/hooks/useStructure'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'
import type { ContextSidebarRenderContext, StructureItem } from '@/types/structure'

const logger = createStudioLogger('StructureCallbackContext')

interface StructureCallbackContextValue {
  /** Get render context for current page/document */
  getRenderContext: (document?: any, collection?: any) => ContextSidebarRenderContext
  
  /** Get render context for specific schema */
  getSchemaRenderContext: (schemaType: string, document?: any) => ContextSidebarRenderContext
}

const StructureCallbackContext = createContext<StructureCallbackContextValue | null>(null)

interface StructureCallbackProviderProps {
  children: ReactNode
}

export function StructureCallbackProvider({ children }: StructureCallbackProviderProps) {
  const location = useLocation()
  const params = useParams()
  const navigate = useNavigate()
  const studioContext = useStudioContext()
  const { user } = useAuth()
  const permissions = usePermissions()
  const { structure } = useStructure()
  
  // Create comprehensive render context
  const getRenderContext = useMemo(() => {
    return (document?: any, collection?: any): ContextSidebarRenderContext => {
      // Determine current context from URL
      const path = location.pathname
      let contextType: ContextSidebarRenderContext['context']['type'] = 'dashboard'
      let schemaType: string | undefined
      let documentId: string | undefined
      let isEditing = false
      let isCreating = false
      
      if (path.startsWith('/content/')) {
        schemaType = params.schemaName
        documentId = params.documentId
        
        if (documentId) {
          contextType = 'documentEditor'
          isEditing = documentId !== 'new'
          isCreating = documentId === 'new'
        } else {
          contextType = 'collectionIndex'
        }
      } else if (path.startsWith('/media')) {
        contextType = 'media'
      } else if (path.startsWith('/users')) {
        contextType = 'users'
      } else if (path.startsWith('/settings')) {
        contextType = 'settings'
      }
      
      // Find current structure item
      const findStructureItem = (items: any[]): any => {
        for (const item of items) {
          if (item.schemaType === schemaType) return item
          if (item.items) {
            const nested = findStructureItem(item.items)
            if (nested) return nested
          }
        }
        return null
      }
      
      const structureItem = structure ? findStructureItem(structure.items || []) : null
      
      return {
        // Current context
        context: {
          type: contextType,
          schemaType,
          documentId,
          isEditing,
          isCreating,
          isNewDocument: documentId === 'new',
          isSingleton: structureItem?.type === 'singleton'
        },
        
        // Structure item
        structureItem,
        
        // Current document
        document,
        
        // Collection info
        collection: collection || (schemaType ? {
          name: schemaType,
          title: structureItem?.title || schemaType,
          type: structureItem?.type === 'singleton' ? 'singleton' : 'document',
          schema: studioContext?.schemas?.[schemaType]
        } : undefined),
        
        // Current user
        user: user ? {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions || [],
          preferences: user.preferences
        } : undefined,
        
        // Permissions
        permissions: {
          hasSchemaPermission: (schema: string, action: 'read' | 'write' | 'delete') => 
            permissions?.hasSchemaPermission(schema, action) || false,
          hasGlobalPermission: (permission: string) => 
            permissions?.hasGlobalPermission(permission) || false,
          hasRole: (role: string) => user?.role === role || false,
          getUserPermissions: () => user?.permissions || []
        },
        
        // Studio context
        studio: {
          config: studioContext?.config || {},
          theme: studioContext?.theme || 'light',
          settings: studioContext?.settings || {},
          schemas: studioContext?.schemas || {},
          structure: structure || { title: '', items: [] }
        },
        
        // Data access utilities
        data: {
          getDocuments: async (schemaType: string, options = {}) => {
            try {
              const response = await apiClient.listDocuments(schemaType, options)
              return response.success ? response.data?.documents || [] : []
            } catch (error) {
              logger.error('Failed to get documents', error)
              return []
            }
          },
          
          getDocument: async (schemaType: string, documentId: string) => {
            try {
              const response = await apiClient.getDocument(schemaType, documentId)
              return response.success ? response.data : null
            } catch (error) {
              logger.error('Failed to get document', error)
              return null
            }
          },
          
          getDocumentCount: async (schemaType: string, filter = {}) => {
            try {
              const response = await apiClient.listDocuments(schemaType, { limit: 1, filter })
              return response.success ? response.data?.pagination?.total || 0 : 0
            } catch (error) {
              logger.error('Failed to get document count', error)
              return 0
            }
          },
          
          getRecentDocuments: async (schemaType?: string, limit = 10) => {
            try {
              if (schemaType) {
                const response = await apiClient.listDocuments(schemaType, { 
                  limit, 
                  sort: '-_updatedAt' 
                })
                return response.success ? response.data?.documents || [] : []
              } else {
                // Get recent from all schemas - would need a search endpoint
                return []
              }
            } catch (error) {
              logger.error('Failed to get recent documents', error)
              return []
            }
          },
          
          searchDocuments: async (query: string, schemaTypes?: string[]) => {
            try {
              // Would need to implement search endpoint
              return []
            } catch (error) {
              logger.error('Failed to search documents', error)
              return []
            }
          },
          
          getUserStats: async () => {
            try {
              const response = await apiClient.request('GET', '/users/stats')
              return response.success ? response.data : {
                totalUsers: 0,
                activeUsers: 0,
                recentLogins: []
              }
            } catch (error) {
              logger.error('Failed to get user stats', error)
              return { totalUsers: 0, activeUsers: 0, recentLogins: [] }
            }
          },
          
          getSystemStats: async () => {
            try {
              const response = await apiClient.request('GET', '/system/stats')
              return response.success ? response.data : {
                totalDocuments: 0,
                totalMedia: 0,
                storageUsed: 0
              }
            } catch (error) {
              logger.error('Failed to get system stats', error)
              return { totalDocuments: 0, totalMedia: 0, storageUsed: 0 }
            }
          }
        },
        
        // UI utilities
        ui: {
          navigate: (path: string) => navigate(path),
          
          showToast: (message: string, type = 'info') => {
            studioContext?.utils?.showToast?.(message, type as any)
          },
          
          showConfirm: async (message: string, title?: string) => {
            return studioContext?.utils?.showConfirm?.(message, title) || false
          },
          
          openModal: (content: ReactNode, options = {}) => {
            studioContext?.utils?.openModal?.(content, options)
          },
          
          closeModal: () => {
            studioContext?.utils?.closeModal?.()
          },
          
          refresh: () => {
            window.location.reload()
          },
          
          toggleSidebar: () => {
            // Would need to implement
          },
          
          setSidebarContent: (content: ReactNode) => {
            // Would need to implement
          }
        },
        
        // API client
        api: {
          client: apiClient,
          
          request: async (method: string, path: string, data?: any) => {
            try {
              const response = await apiClient.request(method, path, data)
              return response.success ? response.data : null
            } catch (error) {
              logger.error('API request failed', error)
              throw error
            }
          },
          
          uploadFile: async (file: File, options = {}) => {
            try {
              const response = await apiClient.uploadMedia(file, options)
              return response.success ? response.data : null
            } catch (error) {
              logger.error('File upload failed', error)
              throw error
            }
          },
          
          downloadFile: async (mediaId: string) => {
            try {
              const response = await fetch(`/api/media/${mediaId}/file`)
              return await response.blob()
            } catch (error) {
              logger.error('File download failed', error)
              throw error
            }
          }
        },
        
        // Utility functions
        utils: {
          formatDate: (date: Date | string, format?: string) => {
            const d = new Date(date)
            return format ? d.toLocaleDateString() : d.toISOString()
          },
          
          formatRelativeTime: (date: Date | string) => {
            const d = new Date(date)
            const now = new Date()
            const diff = now.getTime() - d.getTime()
            const minutes = Math.floor(diff / 60000)
            
            if (minutes < 1) return 'just now'
            if (minutes < 60) return `${minutes}m ago`
            if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
            return `${Math.floor(minutes / 1440)}d ago`
          },
          
          formatFileSize: (bytes: number) => {
            const sizes = ['B', 'KB', 'MB', 'GB']
            if (bytes === 0) return '0 B'
            const i = Math.floor(Math.log(bytes) / Math.log(1024))
            return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
          },
          
          generateSlug: (text: string) => {
            return text
              .toLowerCase()
              .replace(/[^a-z0-9 -]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
          },
          
          isValidEmail: (email: string) => {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          },
          
          debounce: <T extends (...args: any[]) => any>(func: T, delay: number): T => {
            let timeoutId: NodeJS.Timeout
            return ((...args: any[]) => {
              clearTimeout(timeoutId)
              timeoutId = setTimeout(() => func(...args), delay)
            }) as T
          },
          
          copyToClipboard: async (text: string) => {
            try {
              await navigator.clipboard.writeText(text)
              return true
            } catch (error) {
              logger.error('Failed to copy to clipboard', error)
              return false
            }
          },
          
          downloadJSON: (data: any, filename: string) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { 
              type: 'application/json' 
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
          }
        }
      }
    }
  }, [location, params, navigate, studioContext, user, permissions, structure])
  
  const getSchemaRenderContext = useMemo(() => {
    return (schemaType: string, document?: any) => {
      return getRenderContext(document, { 
        name: schemaType,
        schema: studioContext?.schemas?.[schemaType]
      })
    }
  }, [getRenderContext, studioContext])
  
  const value = useMemo(() => ({
    getRenderContext,
    getSchemaRenderContext
  }), [getRenderContext, getSchemaRenderContext])
  
  return (
    <StructureCallbackContext.Provider value={value}>
      {children}
    </StructureCallbackContext.Provider>
  )
}

export function useStructureCallbackContext() {
  const context = useContext(StructureCallbackContext)
  if (!context) {
    throw new Error('useStructureCallbackContext must be used within StructureCallbackProvider')
  }
  return context
}
