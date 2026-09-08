/**
 * SearchRoutes - Cross-collection content and media search
 */

import { InvalidInputError } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

export class SearchRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/search`, this.searchContent.bind(this)]
    ])
  }

  private async searchContent(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)

      // Parse query parameters from URL without relying on hardcoded base URL
      const urlParts = request.url.split('?')
      const searchParams = new URLSearchParams(urlParts[1] || '')
      const query = searchParams.get('q')
      const limit = parseInt(searchParams.get('limit') || '10', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)

      if (!query || query.length < 2) {
        return this.errorResponse(new InvalidInputError('Search query must be at least 2 characters'))
      }

      this.logger.debug('Searching content', { query, limit, offset })

      const results: any[] = []
      const lowerQuery = query.toLowerCase()

      this.logger.debug('Starting search operation')

      // Get all schemas
      const schemas = this.core.getAllSchemas()
      this.logger.debug('Found schemas', { count: schemas.length, schemas: schemas.map(s => s.name) })

      // Search documents in each schema
      for (const schema of schemas) {
        try {
          this.logger.debug('Searching schema', { schemaName: schema.name })

          // Get searchable fields for this schema
          const searchableFields = this.getSearchableFields(schema)
          this.logger.debug('Found searchable fields', { schema: schema.name, fields: searchableFields })

          // Get documents with limited fields to improve performance
          const documents = await this.core.listDocuments(schema.name, {
            limit: limit * 2, // Get a bit more to ensure we have enough results after filtering
            offset: 0
          })

          for (const doc of documents) {
            // Check if any searchable field matches
            let matched = false
            let matchedField = ''
            let excerpt = ''

            for (const field of searchableFields) {
              const value = (doc as any)[field]
              if (value && typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
                matched = true
                matchedField = field
                // Create excerpt around the match
                const index = value.toLowerCase().indexOf(lowerQuery)
                const start = Math.max(0, index - 75)
                const end = Math.min(value.length, index + 75)
                excerpt = value.substring(start, end)
                if (start > 0) excerpt = '...' + excerpt
                if (end < value.length) excerpt = excerpt + '...'
                break
              }
            }

            if (matched) {
              results.push({
                id: doc.id,
                type: 'document',
                collection: schema.name,
                title: (doc as any).title || (doc as any).name || (doc as any).slug || 'Untitled',
                url: `/content/${schema.name}/${doc.id}`,
                excerpt: excerpt || '',
                metadata: {
                  schemaType: schema.title || schema.name,
                  createdAt: doc._createdAt,
                  updatedAt: doc._updatedAt,
                  matchedField
                }
              })
            }
          }
        } catch (schemaError) {
          this.logger.warn('Failed to search schema', { schema: schema.name, error: schemaError })
        }
      }

      // Search media files
      try {
        this.logger.debug('Starting media search')
        const { items: mediaFiles } = await this.core.listMedia({ limit: limit * 2 })
        this.logger.debug('Found media files', { count: mediaFiles.length })

        for (const file of mediaFiles) {
          const title = file.filename || 'Untitled'
          const description = (file.metadata as any)?.description || (file.metadata as any)?.alt || ''

          if (title.toLowerCase().includes(lowerQuery) ||
              file.id.toLowerCase().includes(lowerQuery) ||
              description.toLowerCase().includes(lowerQuery)) {

            results.push({
              id: file.id,
              type: 'media',
              title,
              url: `/media?file=${file.id}`,
              excerpt: description || '',
              metadata: {
                contentType: file.contentType,
                size: file.size,
                createdAt: file._createdAt
              }
            })
          }
        }
      } catch (mediaError) {
        this.logger.error('Failed to search media', {
          error: mediaError instanceof Error ? mediaError.message : String(mediaError),
          stack: mediaError instanceof Error ? mediaError.stack : undefined
        })
      }

      // Sort by relevance (exact title matches first, then other matches)
      results.sort((a, b) => {
        const aExactTitle = a.title.toLowerCase() === lowerQuery
        const bExactTitle = b.title.toLowerCase() === lowerQuery
        if (aExactTitle && !bExactTitle) return -1
        if (!aExactTitle && bExactTitle) return 1

        // Then by creation date (newest first)
        const aDate = new Date(a.metadata.createdAt || 0)
        const bDate = new Date(b.metadata.createdAt || 0)
        return bDate.getTime() - aDate.getTime()
      })

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit)

      return this.successResponse({
        results: paginatedResults,
        total: results.length,
        query,
        limit,
        offset
      })
    } catch (error) {
      this.logger.error('Search failed with error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return this.errorResponse(error)
    }
  }
}
