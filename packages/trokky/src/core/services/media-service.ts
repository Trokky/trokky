import { SecurityValidator } from '../security/validation.js'
import { RateLimiter } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import type { TrokkyLogger } from '../utils/logger.js'
import type { ImageProcessor, ProcessedImageVariant } from '../media/image-processor.js'
import { TrokkyEventBus } from '../events/index.js'
import { mediaUploaded, mediaDeleted } from '../events/index.js'
import { DocumentNotFoundError, InvalidInputError } from '../errors/index.js'
import {
  TrokkyConfig,
  MediaStorageAdapter,
  MediaFile,
  MediaMetadata,
  MediaListResult
} from '../types/index.js'

export interface MediaServiceDependencies {
  config: TrokkyConfig
  logger: TrokkyLogger
  mediaStorage: MediaStorageAdapter
  idGenerator: IdGenerator
  rateLimiter?: RateLimiter
  securityEnabled: boolean
  eventBus: TrokkyEventBus
  eventsEnabled: boolean
  getImageProcessor: () => ImageProcessor
}

/**
 * Media upload, retrieval, image variants and filename sanitization.
 */
export class MediaService {
  constructor(private readonly deps: MediaServiceDependencies) {}

  // Media operations
  public async uploadMedia(file: File): Promise<MediaFile> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('uploadMedia')
    }

    let sanitizedFilename = file.name
    if (this.deps.securityEnabled) {
      sanitizedFilename = this.validateAndSanitizeMediaFile(file)
    }

    const metadata: MediaMetadata = {
      id: this.deps.idGenerator.generate({ prefix: 'media' }),
      filename: sanitizedFilename,
      contentType: file.type,
      size: file.size,
      extension: this.getFileExtension(sanitizedFilename)
    }

    // Upload to storage first
    const mediaFile = await this.deps.mediaStorage.uploadFile(file, metadata)

    // Process image if it's an image file
    if (file.type.startsWith('image/')) {
      try {
        const processedImage = await this.deps.getImageProcessor().processImage(file, {
          id: metadata.id,
          filename: metadata.filename,
          path: metadata.filename // Use filename as fallback since we don't have the full path here
        })

        // Save variant files directly to storage without creating separate MediaFile records
        const savedVariants: Record<string, any> = {}
        for (const [variantName, variantData] of Object.entries(processedImage.variants) as [string, ProcessedImageVariant][]) {
          if (variantData.buffer) {
            try {
              // Save variant file directly using storage adapter's variant support
              if (this.deps.mediaStorage.saveVariantFile) {
                const variantPath = await this.deps.mediaStorage.saveVariantFile(
                  metadata.id,
                  variantName,
                  variantData.buffer,
                  variantData.format
                )

                // Store variant info without URL - let frontend handle URL construction
                savedVariants[variantName] = {
                  width: variantData.width,
                  height: variantData.height,
                  format: variantData.format,
                  size: variantData.size
                }

                this.deps.logger.info('Variant file saved directly', {
                  parentId: metadata.id,
                  variantName,
                  path: variantPath
                })
              } else {
                // Fallback: just store metadata without physical files for now
                savedVariants[variantName] = {
                  url: variantData.url,
                  width: variantData.width,
                  height: variantData.height,
                  format: variantData.format,
                  size: variantData.size
                }
                this.deps.logger.warn('Storage adapter does not support variant files - storing metadata only', {
                  parentId: metadata.id,
                  variantName
                })
              }
            } catch (variantError) {
              this.deps.logger.warn('Failed to save variant file', {
                parentId: metadata.id,
                variantName,
                error: variantError instanceof Error ? variantError.message : 'Unknown error'
              })
            }
          }
        }

        // Store processed image metadata in the media file
        mediaFile.metadata = {
          ...mediaFile.metadata,
          imageVariants: savedVariants,
          originalDimensions: {
            width: processedImage.original.width,
            height: processedImage.original.height
          }
        }

        // Save the updated metadata back to storage
        try {
          if (this.deps.mediaStorage.updateFile) {
            await this.deps.mediaStorage.updateFile(mediaFile.id, mediaFile.metadata)
          }
          this.deps.logger.info('Image variants metadata saved', {
            fileId: metadata.id,
            variantCount: Object.keys(processedImage.variants).length
          })
        } catch (updateError) {
          this.deps.logger.warn('Failed to save image variants metadata', {
            fileId: metadata.id,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
          })
        }
      } catch (error) {
        // Log error but don't fail the upload - image processing is optional
        this.deps.logger.warn('Image processing failed', {
          fileId: metadata.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Emit media uploaded event
    if (this.deps.eventsEnabled) {
      try {
        await this.deps.eventBus.emitEvent(mediaUploaded(mediaFile))
      } catch (error) {
        this.deps.logger.warn('Failed to emit media uploaded event', {
          error,
          fileId: mediaFile.id
        })
      }
    }

    return mediaFile
  }

  public async getMedia(id: string): Promise<MediaFile | null> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getMedia')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.deps.mediaStorage.getFile(id)
  }

  public async updateMedia(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('updateMedia')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // Check if media exists first
    const existingMedia = await this.deps.mediaStorage.getFile(id)
    if (!existingMedia) {
      throw new DocumentNotFoundError('media', id)
    }

    // Use the storage adapter's updateFile method if available
    if (!this.deps.mediaStorage.updateFile) {
      throw new Error('Media update not supported by storage adapter')
    }

    return await this.deps.mediaStorage.updateFile(id, metadata)
  }

  public async getMediaContent(id: string): Promise<ArrayBuffer | null> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getMediaContent')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.deps.mediaStorage.getFileContent(id)
  }

  public async listMedia(options?: { limit?: number; offset?: number }): Promise<MediaListResult> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('listMedia')
    }

    // Use the storage adapter's listMedia method if available
    if (!this.deps.mediaStorage.listMedia) {
      throw new Error('Media listing not supported by storage adapter')
    }

    return await this.deps.mediaStorage.listMedia(options || {})
  }

  public async deleteMedia(id: string): Promise<void> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('deleteMedia')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // Check if media exists
    const existingMedia = await this.deps.mediaStorage.getFile(id)
    if (!existingMedia) {
      throw new DocumentNotFoundError('media', id)
    }

    // Delete image variants if it's an image
    if (existingMedia.contentType.startsWith('image/')) {
      try {
        await this.deps.getImageProcessor().deleteImage(id)
      } catch (error) {
        // Log error but don't fail the deletion - variants cleanup is optional
        this.deps.logger.warn('Image variants cleanup failed', {
          fileId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    await this.deps.mediaStorage.deleteFile(id)

    // Emit media deleted event
    if (this.deps.eventsEnabled) {
      try {
        await this.deps.eventBus.emitEvent(mediaDeleted(id, existingMedia))
      } catch (error) {
        this.deps.logger.warn('Failed to emit media deleted event', {
          error,
          fileId: id
        })
      }
    }
  }

  public async regenerateMediaVariants(id: string): Promise<MediaFile> {
    try {
      await this.deps.rateLimiter?.checkRateLimit('regenerateMediaVariants')

      // Get the existing media file
      const mediaFile = await this.deps.mediaStorage.getFile(id)
      if (!mediaFile) {
        throw new Error(`Media file with id ${id} not found`)
      }

      // Check if it's an image file
      if (!mediaFile.contentType.startsWith('image/')) {
        throw new InvalidInputError('Variant regeneration is only supported for image files', 'contentType')
      }

      this.deps.logger.info('Starting variant regeneration', { id, filename: mediaFile.filename })

      // Get the original file content
      const fileContent = await this.deps.mediaStorage.getFileContent(id)
      if (!fileContent) {
        throw new Error('Unable to read original file content')
      }

      // Convert ArrayBuffer to File object for image processing
      const file = new File([new Uint8Array(fileContent)], mediaFile.filename, {
        type: mediaFile.contentType
      })

      // Process the image to generate new variants
      const processedImage = await this.deps.getImageProcessor().processImage(file, {
        id: mediaFile.id,
        filename: mediaFile.filename,
        path: (mediaFile.metadata as any)?.path || mediaFile.filename
      })

      // Delete existing variants first
      if (this.deps.mediaStorage.deleteVariantFiles) {
        try {
          await this.deps.mediaStorage.deleteVariantFiles(id)
          this.deps.logger.info('Existing variants deleted', { id })
        } catch (deleteError) {
          this.deps.logger.warn('Failed to delete existing variants', { id, error: deleteError })
        }
      }

      // Save new variant files
      const savedVariants: Record<string, any> = {}
      for (const [variantName, variantData] of Object.entries(processedImage.variants) as [string, ProcessedImageVariant][]) {
        if (variantData.buffer) {
          try {
            if (this.deps.mediaStorage.saveVariantFile) {
              const variantPath = await this.deps.mediaStorage.saveVariantFile(
                id,
                variantName,
                variantData.buffer,
                variantData.format
              )

              // Store variant info without URL - let frontend handle URL construction
              savedVariants[variantName] = {
                width: variantData.width,
                height: variantData.height,
                format: variantData.format,
                size: variantData.size
              }

              this.deps.logger.info('New variant saved', {
                parentId: id,
                variantName,
                path: variantPath
              })
            }
          } catch (variantError) {
            this.deps.logger.warn('Failed to save new variant', {
              parentId: id,
              variantName,
              error: variantError instanceof Error ? variantError.message : 'Unknown error'
            })
          }
        }
      }

      // Update metadata with new variants
      const updatedMetadata = {
        ...mediaFile.metadata,
        imageVariants: savedVariants,
        originalDimensions: {
          width: processedImage.original.width,
          height: processedImage.original.height
        }
      }

      // Save updated metadata
      const updatedMediaFile = await this.deps.mediaStorage.updateFile?.(id, updatedMetadata)
      if (!updatedMediaFile) {
        throw new Error('Failed to update media file metadata')
      }

      this.deps.logger.info('Variants regenerated successfully', {
        id,
        variantCount: Object.keys(savedVariants).length
      })

      return updatedMediaFile
    } catch (error) {
      this.deps.logger.error('Failed to regenerate variants', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  // Image processing operations
  public getImageUrl(imageId: string, variantName?: string): string {
    return this.deps.getImageProcessor().getImageUrl(imageId, variantName)
  }

  public async getImageProcessor(): Promise<ImageProcessor> {
    return this.deps.getImageProcessor()
  }

  // Utility methods
  public validateAndSanitizeMediaFile(file: File): string {
    // Use configuration or fall back to defaults
    const mediaValidation = this.deps.config.media?.validation
    const maxSize = mediaValidation?.maxFileSize || (100 * 1024 * 1024) // 100MB default
    const allowedTypes = mediaValidation?.allowedTypes || [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Video
      'video/mp4', 'video/webm', 'video/mov', 'video/avi',
      // Audio - comprehensive list to match AudioField and Routes
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

    if (file.size > maxSize) {
      throw new InvalidInputError(`File too large (max ${maxSize / 1024 / 1024}MB)`, 'file')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new InvalidInputError(`File type not allowed: ${file.type}`, 'file')
    }

    // Sanitize filename instead of rejecting it
    const sanitizedName = this.sanitizeFilename(file.name)
    if (sanitizedName !== file.name) {
      this.deps.logger.debug('Filename sanitized', {
        original: file.name,
        sanitized: sanitizedName
      })
    }

    return sanitizedName
  }

  public sanitizeFilename(filename: string): string {
    // Extract extension first
    const lastDot = filename.lastIndexOf('.')
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename
    const extension = lastDot > 0 ? filename.substring(lastDot) : ''

    // Sanitize the name part
    let sanitized = name
      // Replace accented characters with ASCII equivalents
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace spaces and special characters with hyphens
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Ensure it's not empty
      || 'file'

    // Sanitize extension (keep dots, letters, numbers only)
    const sanitizedExtension = extension.replace(/[^.a-zA-Z0-9]/g, '')

    // Limit total length to 255 characters (filesystem limit)
    const maxNameLength = 255 - sanitizedExtension.length
    if (sanitized.length > maxNameLength) {
      sanitized = sanitized.substring(0, maxNameLength)
    }

    return sanitized + sanitizedExtension
  }

  public getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()! : ''
  }
}
