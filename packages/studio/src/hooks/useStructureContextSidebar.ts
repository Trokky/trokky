/**
 * Structure-Driven Context Sidebar Hook
 * Automatically configures context sidebar based on structure configuration
 */

import React, { useEffect, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useContextSidebar } from '@/contexts/ContextSidebarContext'
import { useStructure } from './useStructure'
import { useAuth } from './useAuth'
import { usePermissions } from './usePermissions'
import { useStudioContext } from '@/contexts/StudioContext'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'
import { WidgetRenderer } from '@/components/context-sidebar/WidgetRenderer'
import type { ContextSidebarRenderContext } from '@/types/structure'

const logger = createStudioLogger('useStructureContextSidebar')

interface StructureContextSidebarOptions {
  /** Override automatic detection */
  forceSchemaType?: string
  /** Disable automatic context sidebar management */
  disabled?: boolean
  /** Default fallback configuration */
  fallback?: {
    title?: string
    visible?: boolean
    position?: 'left' | 'right'
  }
}

/**
 * Hook that automatically configures context sidebar based on structure configuration
 */
export function useStructureContextSidebar(options: StructureContextSidebarOptions = {}) {
  const location = useLocation()
  const params = useParams()
  const { structure } = useStructure()
  const { user } = useAuth()
  const permissions = usePermissions()
  const studioContext = useStudioContext()
  const contextSidebar = useContextSidebar()
  
  // Determine current context from URL and params
  const currentContext = useMemo(() => {
    if (options.disabled) return null
    
    // Override detection if specified
    if (options.forceSchemaType) {
      return {
        type: 'schema' as const,
        schemaType: options.forceSchemaType,
        documentId: params.documentId
      }
    }
    
    // Auto-detect from URL patterns
    const path = location.pathname
    
    // Content pages: /content/:schemaName/:documentId?
    if (path.startsWith('/content/')) {
      const schemaType = params.schemaName
      const documentId = params.documentId
      
      if (schemaType) {
        return {
          type: documentId ? 'documentEditor' as const : 'collectionIndex' as const,
          schemaType,
          documentId,
          isEditing: !!documentId && documentId !== 'new',
          isCreating: documentId === 'new'
        }
      }
    }
    
    // Dashboard
    if (path === '/' || path === '/dashboard') {
      return { type: 'dashboard' as const }
    }
    
    // Media
    if (path.startsWith('/media')) {
      return { type: 'media' as const }
    }
    
    // Users
    if (path.startsWith('/users')) {
      return { type: 'users' as const }
    }
    
    // Settings
    if (path.startsWith('/settings')) {
      return { type: 'settings' as const }
    }
    
    return null
  }, [location.pathname, params, options])
  
  // Find matching structure item and its context sidebar configuration
  const contextSidebarConfig = useMemo(() => {
    if (!structure || !currentContext) return null
    
    // Find structure item that matches current context
    const findMatchingItem = (items: any[]): any => {
      for (const item of items) {
        // Direct schema type match
        if (item.schemaType === currentContext.schemaType) {
          return item
        }
        
        // Nested items (groups, etc.)
        if (item.items) {
          const nested = findMatchingItem(item.items)
          if (nested) return nested
        }
      }
      return null
    }
    
    const matchingItem = findMatchingItem(structure.items || [])
    
    if (matchingItem?.contextSidebar) {
      logger.debug('Found context sidebar config for context', { 
        context: currentContext, 
        config: matchingItem.contextSidebar 
      })
      return matchingItem.contextSidebar
    }
    
    // Check global context sidebar configuration
    const globalConfig = structure.contextSidebar
    if (globalConfig?.contexts) {
      const contextKey = currentContext.type
      const contextConfig =
        contextKey in globalConfig.contexts
          ? globalConfig.contexts[
              contextKey as keyof typeof globalConfig.contexts
            ]
          : undefined
      if (contextConfig) {
        logger.debug('Found global context sidebar config', { 
          context: currentContext, 
          config: contextConfig 
        })
        return contextConfig
      }
    }
    
    return null
  }, [structure, currentContext])
  
  // Create render context for callbacks
  const renderContext = useMemo((): ContextSidebarRenderContext | null => {
    if (!currentContext) return null
    
    return {
      context: currentContext,
      structureItem: undefined, // Would be populated from structure
      document: undefined, // Would be populated from current document
      collection: currentContext.schemaType ? {
        name: currentContext.schemaType,
        title: currentContext.schemaType,
        type: 'document' as const,
        schema: studioContext?.schemas?.[currentContext.schemaType]
      } : undefined,
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      } : undefined,
      permissions: {
        hasSchemaPermission: (schema: string, action: 'read' | 'write' | 'delete') => 
          permissions?.hasSchemaPermission(schema, action) || false,
        hasGlobalPermission: (permission: string) => 
          permissions?.hasGlobalPermission(permission) || false,
        hasRole: (role: string) => user?.role === role || false,
        getUserPermissions: () => user?.permissions || []
      },
      studio: {
        config: studioContext?.config || {},
        theme: studioContext?.theme || 'light',
        settings: studioContext?.settings || {},
        schemas: studioContext?.schemas || {},
        structure: structure || { title: '', items: [] }
      },
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
              console.log('🔍 Fetching recent documents for:', schemaType, 'limit:', limit)
              const response = await apiClient.listDocuments(schemaType, { 
                limit, 
                sort: '_updatedAt.desc'  // Fixed: use field.desc format instead of -field
              })
              console.log('📡 API Response:', response)
              
              if (response.success && response.data) {
                const documents = response.data.documents || []
                console.log('📄 Documents found:', documents.length, documents)
                return documents
              } else {
                console.warn('❌ API call failed or no data:', response)
                return []
              }
            }
            console.log('⚠️ No schemaType provided')
            return []
          } catch (error) {
            console.error('💥 Error in getRecentDocuments:', error)
            logger.error('Failed to get recent documents', error)
            return []
          }
        },
        searchDocuments: async () => [],
        getUserStats: async () => ({ totalUsers: 0, activeUsers: 0, recentLogins: [] }),
        getSystemStats: async () => ({ totalDocuments: 0, totalMedia: 0, storageUsed: 0 })
      },
      ui: {
        navigate: (path: string) => window.location.href = path,
        showToast: (message: string, type = 'info') => {
          studioContext?.utils?.showToast?.(message, type as any)
        },
        showConfirm: async (message: string, title?: string) => {
          return studioContext?.utils?.showConfirm?.(message, { title }) || Promise.resolve(false)
        },
        refresh: () => window.location.reload(),
        toggleSidebar: () => contextSidebar.toggleCollapse(),
        setSidebarContent: (content: any) => contextSidebar.setContent(content)
      },
      api: {
        client: apiClient,
        request: async (method: string, path: string, data?: any) => {
          try {
            const response = await apiClient.request(path, {
              method: method.toUpperCase(),
              body: data !== undefined ? JSON.stringify(data) : undefined,
            })
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
      utils: {
        formatDate: (date: Date | string, _format?: string) => {
          const d = new Date(date)
          return d.toLocaleDateString()
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
  }, [currentContext, user, permissions, studioContext, structure])
  
  // Configure context sidebar based on structure
  useEffect(() => {
    if (options.disabled) return
    
    if (contextSidebarConfig) {
      // Configure from structure
      contextSidebar.configure({
        page: currentContext?.type || 'unknown',
        title: contextSidebarConfig.title !== undefined ? contextSidebarConfig.title : (options.fallback?.title || 'Context'),
        defaultVisible: contextSidebarConfig.enabled !== false && (contextSidebarConfig.defaultVisible !== false),
        defaultPosition: contextSidebarConfig.position || options.fallback?.position || 'right',
        defaultWidth: contextSidebarConfig.width || 320
      })
      
      logger.debug('Configured context sidebar from structure', {
        context: currentContext,
        config: contextSidebarConfig
      })
    } else if (options.fallback) {
      // Use fallback configuration
      contextSidebar.configure({
        page: currentContext?.type || 'unknown',
        title: options.fallback.title !== undefined ? options.fallback.title : 'Context',
        defaultVisible: options.fallback.visible !== false,
        defaultPosition: options.fallback.position || 'right'
      })
      
      logger.debug('Configured context sidebar with fallback', {
        context: currentContext,
        fallback: options.fallback
      })
    } else {
      // Configure context sidebar as hidden if no configuration found
      contextSidebar.configure({
        page: currentContext?.type || 'unknown',
        title: 'Context',
        defaultVisible: false  // Hide if no configuration
      })
      
      logger.debug('No context sidebar configuration found, configuring as hidden', {
        context: currentContext
      })
    }
  }, [
    contextSidebarConfig, 
    currentContext?.type, 
    currentContext?.schemaType,
    currentContext?.documentId,  // Add documentId to detect document changes
    location.pathname,           // Add location to detect route changes
    options.disabled, 
    options.fallback, 
    contextSidebar.configure
  ])

  // Set content separately to avoid infinite loops
  useEffect(() => {
    if (options.disabled || !contextSidebarConfig?.content) return
    
    // Set content based on type
    if (contextSidebarConfig.content.type === 'widgets' && renderContext) {
      try {
        const content = React.createElement(WidgetRenderer, {
          key: `widgets-${currentContext?.type}-${currentContext?.schemaType}`,
          content: contextSidebarConfig.content,
          context: renderContext
        })
        contextSidebar.setContent(content)
      } catch (error) {
        logger.error('Failed to render context sidebar widgets', error)
        contextSidebar.setContent(
          React.createElement('div', { 
            className: 'p-4 text-red-600' 
          }, `Error rendering widgets: ${error instanceof Error ? error.message : String(error)}`)
        )
      }
    } else if (contextSidebarConfig.content.type === 'callback' && renderContext) {
      try {
        const content = contextSidebarConfig.content.render(renderContext)
        contextSidebar.setContent(content)
      } catch (error) {
        logger.error('Failed to render context sidebar content', error)
        contextSidebar.setContent(
          React.createElement('div', { 
            className: 'p-4 text-red-600' 
          }, `Error rendering sidebar content: ${error instanceof Error ? error.message : String(error)}`)
        )
      }
    }
  }, [
    contextSidebarConfig?.content,
    currentContext?.type,
    currentContext?.schemaType,
    currentContext?.documentId,  // Add documentId to detect document changes
    location.pathname,           // Add location to detect route changes
    options.disabled,
    contextSidebar.setContent
  ])
  
  return {
    currentContext,
    contextSidebarConfig,
    isConfigured: !!contextSidebarConfig,
    contextSidebar
  }
}
