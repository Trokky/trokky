/**
 * Recent Documents Widget
 * Shows recently updated documents for a schema
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useT } from '@trokky/i18n'
import type { ContextSidebarRenderContext } from '@/types/structure'

export interface RecentDocumentsWidgetConfig {
  type: 'recentDocuments'
  title?: string
  schemaType?: string  // If not provided, uses current schema
  limit?: number
  showAuthor?: boolean
  showTime?: boolean
  showEditLink?: boolean
}

interface RecentDocument {
  id: string
  title?: string
  _updatedAt: string
  _updatedBy?: string
  author?: any
  featuredImage?: any
  [key: string]: any
}

export function RecentDocumentsWidget({
  config,
  context
}: {
  config: RecentDocumentsWidgetConfig
  context: ContextSidebarRenderContext
}) {
  const { t } = useT('studio')
  const [documents, setDocuments] = useState<RecentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data, ui, utils, context: currentContext, api } = context
  const schemaType = config.schemaType || currentContext.schemaType
  const limit = config.limit || 5
  const title = config.title || (schemaType
    ? t('contextSidebar.widgets.recentDocuments.defaultTitle', { schema: schemaType.charAt(0).toUpperCase() + schemaType.slice(1) + 's' })
    : t('contextSidebar.widgets.recentDocuments.defaultTitleFallback'))
  
  useEffect(() => {
    if (!schemaType) {
      setError(t('contextSidebar.widgets.recentDocuments.noSchemaType'))
      setLoading(false)
      return
    }
    
    const loadRecentDocuments = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const recentDocs = await data.getRecentDocuments(schemaType, limit)
        setDocuments(recentDocs || [])
      } catch (err) {
        console.error('Failed to load recent documents:', err)
        setError(t('contextSidebar.widgets.recentDocuments.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    
    loadRecentDocuments()
  }, [schemaType, limit, data.getRecentDocuments])
  
  const handleDocumentClick = (doc: RecentDocument) => {
    if (config.showEditLink !== false && schemaType && doc.id) {
      const path = `/content/${schemaType}/${doc.id}`
      navigate(path)
    }
  }
  
  if (loading) {
    return (
      <div className="mx-3">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 mt-4">
          {title}
        </h4>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="mx-3">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 mt-4">
          {title}
        </h4>
        <div className="text-sm text-red-600 dark:text-red-400 text-center py-2">
          {error}
        </div>
      </div>
    )
  }
  
  return (
    <div className="mx-3">
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 mt-4">
        {title}
      </h4>
      <div className="space-y-2">
        {documents.map((doc, index) => (
          <div
            key={doc.id || index}
            className={`p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 transition-colors ${
              config.showEditLink !== false 
                ? 'hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer' 
                : ''
            }`}
            onClick={() => handleDocumentClick(doc)}
          >
            <div className="flex items-center space-x-3">
              {/* Thumbnail */}
              {doc.featuredImage && (() => {
                const imageRef = doc.featuredImage.asset?._ref || doc.featuredImage._ref
                const imageUrl = api.client.getMediaUrl(imageRef, 'thumbnail')
                return (
                  <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                    <img
                      src={imageUrl}
                      alt={doc.featuredImage.alt || doc.title || 'Document thumbnail'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder on error
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.parentElement!.innerHTML = '<div class="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center"><svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg></div>'
                      }}
                    />
                  </div>
                )
              })()}
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 dark:text-white truncate font-medium">
                  {doc.title || doc.name || t('contextSidebar.widgets.recentDocuments.untitled')}
                </div>
                {config.showAuthor && doc.author && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('contextSidebar.widgets.recentDocuments.by')} {typeof doc.author === 'object' && doc.author.name ? doc.author.name : doc.author}
                  </div>
                )}
                {config.showTime !== false && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {utils.formatRelativeTime(doc._updatedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {documents.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            {t('contextSidebar.widgets.recentDocuments.noDocuments')}
          </div>
        )}
      </div>
    </div>
  )
}
