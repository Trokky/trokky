/**
 * MediaRoutes - Media library and media file serving route handlers
 */

import { SecurityValidator, InvalidInputError, MediaFile } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

export class MediaRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/media`, this.listMedia.bind(this)],
      ['POST', `${basePath}/media/upload`, this.uploadMedia.bind(this)],
      ['POST', `${basePath}/media/bulk-delete`, this.bulkDeleteMedia.bind(this)],
      ['GET', `${basePath}/media/:id`, this.getMedia.bind(this)],
      ['PUT', `${basePath}/media/:id`, this.updateMedia.bind(this)],
      ['GET', `${basePath}/media/:id/file`, this.serveMediaFile.bind(this)],
      ['GET', `${basePath}/media/:id/variants/:variant`, this.serveMediaVariant.bind(this)],
      ['POST', `${basePath}/media/:id/regenerate-variants`, this.regenerateVariants.bind(this)],
      ['DELETE', `${basePath}/media/:id`, this.deleteMedia.bind(this)]
    ])
  }

  private async listMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)

      // Get query parameters
      const url = new URL(request.url || '', 'http://localhost')
      const limit = parseInt(url.searchParams.get('limit') || '50', 10)
      const offset = parseInt(url.searchParams.get('offset') || '0', 10)

      // Get media files from the core engine (returns { items, total })
      const { items, total } = await this.core.listMedia({ limit, offset })

      this.logger.debug('Media files listed', {
        count: items.length,
        total,
        limit,
        offset
      })

      // SECURITY: Sanitize responses to remove sensitive internal paths
      const sanitizedFiles = items.map(file => this.sanitizeMediaResponse(file))

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...this.buildCorsHeaders()
        },
        body: JSON.stringify({
          success: true,
          data: sanitizedFiles,
          meta: {
            count: sanitizedFiles.length,
            total,
            limit,
            offset,
            hasMore: offset + sanitizedFiles.length < total
          }
        })
      }
    } catch (error) {
      this.logger.error('Failed to list media', { error: error instanceof Error ? error.message : String(error) })
      
      if (error instanceof InvalidInputError) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: error.code || 'INVALID_INPUT',
              message: error.message,
              details: error.details
            }
          })
        }
      }

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list media'
          }
        })
      }
    }
  }

  private async uploadMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const files = request.files || []
      if (files.length === 0) {
        throw new InvalidInputError('No files provided', 'files')
      }

      // SECURITY: Validate file upload constraints
      this.validateMediaFiles(files)

      const uploadedFiles = []
      for (const file of files) {
        const mediaFile = await this.core.uploadMedia(file)
        uploadedFiles.push(mediaFile)
      }

      // SECURITY: Sanitize responses to remove sensitive internal paths
      const sanitizedFiles = uploadedFiles.map(file => this.sanitizeMediaResponse(file))

      return this.successResponse({
        files: sanitizedFiles,
        meta: { count: sanitizedFiles.length }
      }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { id } = request.params

      SecurityValidator.validateDocumentId(id)

      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error(`Media file ${id} not found`), 404)
      }

      // SECURITY: Sanitize response to remove sensitive internal paths
      const sanitizedFile = this.sanitizeMediaResponse(mediaFile)

      return this.successResponse({ file: sanitizedFile })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Additional Media Routes
  private async updateMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { id } = request.params
      if (!id) {
        return this.errorResponse(new InvalidInputError('Media ID is required'))
      }

      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Request body is required'))
      }

      const body = request.body as Record<string, unknown>
      const metadata = body.metadata
      
      if (!metadata || typeof metadata !== 'object') {
        return this.errorResponse(new InvalidInputError('Metadata is required'))
      }

      // Validate media exists
      const existingMedia = await this.core.getMedia(id)
      if (!existingMedia) {
        return this.errorResponse(new Error('Media not found'), 404)
      }

      // Update metadata only (not the file itself)
      const updatedMedia = await this.core.updateMedia(id, metadata as Record<string, unknown>)

      // SECURITY: Sanitize response to remove sensitive internal paths
      const sanitizedFile = this.sanitizeMediaResponse(updatedMedia)

      return this.successResponse({ file: sanitizedFile })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { id } = request.params

      SecurityValidator.validateDocumentId(id)

      await this.core.deleteMedia(id)
      return this.successResponse({ message: 'Media file deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async bulkDeleteMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)

      const body = request.body as { ids?: string[] }

      if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
        return this.errorResponse(new Error('Invalid request: ids array is required'), 400)
      }

      // Validate all IDs before deleting
      for (const id of body.ids) {
        SecurityValidator.validateDocumentId(id)
      }

      // Limit bulk operations to prevent abuse
      const maxBulkOperations = 100
      if (body.ids.length > maxBulkOperations) {
        return this.errorResponse(
          new Error(`Cannot delete more than ${maxBulkOperations} files at once`),
          400
        )
      }

      const results: { id: string; success: boolean; error?: string }[] = []
      let successCount = 0
      let errorCount = 0

      // Delete each file and track results
      for (const id of body.ids) {
        try {
          await this.core.deleteMedia(id)
          results.push({ id, success: true })
          successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.push({ id, success: false, error: errorMessage })
          errorCount++
          this.logger.warn('Failed to delete media file during bulk operation', { id, error: errorMessage })
        }
      }

      return this.successResponse({
        message: `Bulk delete completed: ${successCount} succeeded, ${errorCount} failed`,
        results,
        successCount,
        errorCount
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async regenerateVariants(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      // Get the media file to check if it exists and is an image
      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error('Media file not found'), 404)
      }

      // Check if it's an image file
      if (!mediaFile.contentType.startsWith('image/')) {
        return this.errorResponse(new Error('Variant generation is only supported for image files'), 400)
      }

      this.logger.info('Regenerating variants for media file', { id, filename: mediaFile.filename })

      // Regenerate variants
      const updatedMediaFile = await this.core.regenerateMediaVariants(id)
      
      return this.successResponse({ 
        message: 'Variants regenerated successfully',
        file: updatedMediaFile 
      })
    } catch (error) {
      this.logger.error('Failed to regenerate variants', { error: error instanceof Error ? error.message : 'Unknown error' })
      return this.errorResponse(error)
    }
  }

  private async serveMediaFile(request: HttpRequest): Promise<HttpResponse> {
    try {
      // Media files can be served without strict authentication in many cases
      // but we still validate the request
      const { id } = request.params

      SecurityValidator.validateDocumentId(id)

      // Get media metadata first
      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error(`Media file ${id} not found`), 404)
      }

      // Get file content
      const content = await this.core.getMediaContent(id)
      if (!content) {
        return this.errorResponse(new Error(`Media file content ${id} not found`), 404)
      }

      // Use Uint8Array for edge compatibility (Workers, etc.)
      const buffer = content instanceof Uint8Array ? content : new Uint8Array(content)

      return {
        status: 200,
        headers: {
          'Content-Type': mediaFile.contentType,
          'Content-Length': buffer.byteLength.toString(),
          'Content-Disposition': `inline; filename="${mediaFile.filename}"`,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'ETag': `"${id}"`,
          ...this.buildCorsHeaders()
        },
        body: buffer
      }
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async serveMediaVariant(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { id, variant } = request.params

      SecurityValidator.validateDocumentId(id)

      if (!variant || !/^[a-zA-Z0-9_-]+$/.test(variant)) {
        return this.errorResponse(new Error('Invalid variant name'), 400)
      }

      // Get media metadata first
      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error(`Media file ${id} not found`), 404)
      }

      // Check if variant exists in metadata
      const variants = mediaFile.metadata?.imageVariants as Record<string, any>
      if (!variants || !variants[variant]) {
        return this.errorResponse(new Error(`Variant ${variant} not found for media ${id}`), 404)
      }

      const variantInfo = variants[variant]
      
      // Use media storage adapter to get variant file content
      const mediaStorage = this.core.getMediaStorageAdapter()
      
      if (mediaStorage.getVariantContent) {
        // If storage adapter supports variant content retrieval
        try {
          const variantContent = await mediaStorage.getVariantContent(id, variant)
          if (!variantContent) {
            return this.errorResponse(new Error(`Variant file ${variant} not found for media ${id}`), 404)
          }

          // Ensure Uint8Array body for edge runtimes
          const buffer = variantContent instanceof Uint8Array ? variantContent : new Uint8Array(variantContent)

          return {
            status: 200,
            headers: {
              'Content-Type': `image/${variantInfo.format || 'webp'}`,
              'Content-Length': buffer.byteLength.toString(),
              'Content-Disposition': `inline; filename="${id}-${variant}.${variantInfo.format || 'webp'}"`,
              'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
              'ETag': `"${id}-${variant}"`,
              ...this.buildCorsHeaders()
            },
            body: buffer
          }
        } catch (storageError) {
          this.logger.error('Failed to read variant from storage adapter', { id, variant, error: storageError })
        }
      }

      // No filesystem fallback for edge compatibility
      // Edge platforms (Cloudflare Workers, Vercel Edge, etc.) use object storage instead
      this.logger.error('Media storage adapter does not support variant content retrieval', { id, variant })
      return this.errorResponse(new Error(`Variant file ${variant} not found for media ${id}`), 404)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Media validation helper
  private validateMediaFiles(files: File[]): void {
    const maxFileSize = 100 * 1024 * 1024 // 100MB - matches audio field configuration
    const maxFiles = 10
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Video
      'video/mp4', 'video/webm', 'video/mov', 'video/avi',
      // Audio - comprehensive list to match AudioField
      'audio/mpeg',       // MP3 (primary MIME type)
      'audio/mp3',        // MP3 (alternative MIME type)
      'audio/wav',        // WAV
      'audio/wave',       // WAV (alternative MIME type)
      'audio/ogg',        // OGG
      'audio/aac',        // AAC
      'audio/mp4',        // M4A (MP4 audio)
      'audio/x-m4a',      // M4A (alternative MIME type)
      'audio/flac',       // FLAC
      'audio/webm',       // WebM audio
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Text
      'text/plain', 'text/csv',
      'application/json'
    ]
    const forbiddenExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
      '.ps1', '.sh', '.php', '.jsp', '.asp', '.aspx', '.msi', '.dll', '.sys',
      '.bin', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.run', '.out'
    ]

    if (files.length > maxFiles) {
      throw new InvalidInputError(`Too many files. Maximum ${maxFiles} files allowed`, 'files')
    }

    for (const file of files) {
      // File size validation
      if (file.size > maxFileSize) {
        throw new InvalidInputError(`File ${file.name} is too large. Maximum size is ${maxFileSize / 1024 / 1024}MB`, 'file_size')
      }

      // Content type validation
      if (!allowedTypes.includes(file.type)) {
        throw new InvalidInputError(`File type ${file.type} is not allowed`, 'file_type')
      }

      // Extension validation (check all extensions, not just the last one)
      const getAllExtensions = (filename: string): string[] => {
        const parts = filename.toLowerCase().split('.')
        if (parts.length <= 1) return []
        return parts.slice(1).map(ext => `.${ext}`)
      }
      
      const fileExtensions = getAllExtensions(file.name)
      const hasForbiddenExtension = fileExtensions.some(ext => forbiddenExtensions.includes(ext))
      
      if (hasForbiddenExtension) {
        const foundForbiddenExt = fileExtensions.find(ext => forbiddenExtensions.includes(ext))
        throw new InvalidInputError(`File extension ${foundForbiddenExt} is not allowed`, 'file_extension')
      }

      // Filename validation (prevent path traversal)
      if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        throw new InvalidInputError('Invalid filename. Path separators not allowed', 'filename')
      }
    }
  }

  /**
   * Sanitize media file response to remove sensitive internal information
   * This prevents exposing server filesystem paths and internal details
   */
  private sanitizeMediaResponse(mediaFile: MediaFile): Omit<MediaFile, 'metadata'> & { metadata?: Record<string, unknown> } {
    const { metadata, ...rest } = mediaFile

    // Only include safe metadata fields
    const safeMetadata: Record<string, unknown> = {}
    if (metadata) {
      // Include extension and originalFilename (useful for clients)
      if (metadata.extension) safeMetadata.extension = metadata.extension
      if (metadata.originalFilename) safeMetadata.originalFilename = metadata.originalFilename
      // Include image dimensions if available
      if (metadata.width) safeMetadata.width = metadata.width
      if (metadata.height) safeMetadata.height = metadata.height
      // Include any custom metadata that isn't a path
      for (const [key, value] of Object.entries(metadata)) {
        if (!['path', 'storagePath', 'absolutePath', 'relativePath', 'filePath'].includes(key)) {
          if (!safeMetadata[key]) {
            safeMetadata[key] = value
          }
        }
      }
      // Explicitly remove any path-related fields that might have slipped through
      delete safeMetadata.path
      delete safeMetadata.storagePath
      delete safeMetadata.absolutePath
      delete safeMetadata.relativePath
      delete safeMetadata.filePath
    }

    return {
      ...rest,
      metadata: Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined
    }
  }
}
