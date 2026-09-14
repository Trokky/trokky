import { SecurityValidator } from '../security/validation.js'
import { RateLimiter } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import { withRetry, type RetryOptions } from '../utils/retry.js'
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


/** One step of media processing that did not succeed, even after retries. */
export interface VariantFailure {
  stage: 'process' | 'save-variant' | 'persist-metadata'
  variant?: string
  error: string
}

/**
 * What happened while generating variants, recorded on the media file when it was not clean.
 * Its absence means every variant was generated and stored.
 */
export interface ImageProcessingReport {
  status: 'partial' | 'failed'
  failures: VariantFailure[]
  failedAt: string
}

interface VariantGenerationOutcome {
  variants: Record<string, unknown>
  originalDimensions?: { width: number; height: number }
  report?: ImageProcessingReport
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
      const outcome = await this.generateVariants(metadata.id, file, {
        id: metadata.id,
        filename: metadata.filename,
        // Use filename as fallback since we don't have the full path here
        path: metadata.filename
      })

      mediaFile.metadata = {
        ...mediaFile.metadata,
        imageVariants: outcome.variants,
        ...(outcome.originalDimensions ? { originalDimensions: outcome.originalDimensions } : {}),
        ...(outcome.report ? { imageProcessing: outcome.report } : {})
      }

      // Persist the variant metadata. Without this the variant files exist in storage and
      // nothing references them, which is invisible until someone notices missing thumbnails —
      // so it retries, and a final failure is reported rather than logged and forgotten.
      if (this.deps.mediaStorage.updateFile) {
        const update = this.deps.mediaStorage.updateFile.bind(this.deps.mediaStorage)
        try {
          await withRetry(() => update(mediaFile.id, mediaFile.metadata!), this.retryOptions(
            'persist image variant metadata',
            { fileId: metadata.id }
          ))
          this.deps.logger.info('Image variants metadata saved', {
            fileId: metadata.id,
            variantCount: Object.keys(outcome.variants).length
          })
        } catch (updateError) {
          const message = updateError instanceof Error ? updateError.message : 'Unknown error'
          // The upload itself succeeded and the original is stored, so throwing here would tell
          // the caller to re-upload a file that is already safe. Report it on the record the
          // caller receives instead, and at error level rather than as a warning.
          this.deps.logger.error('Image variants metadata could not be saved', {
            fileId: metadata.id,
            error: message
          })
          mediaFile.metadata = {
            ...mediaFile.metadata,
            imageProcessing: {
              status: 'failed' as const,
              failures: [
                ...(outcome.report?.failures ?? []),
                { stage: 'persist-metadata' as const, error: message }
              ],
              failedAt: new Date().toISOString()
            }
          }
        }
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


  /**
   * Retry policy for the remote-backed steps of media processing.
   *
   * Cloudflare's Images service fails a small share of calls transiently — measured at roughly
   * one in fifteen for a 6MB JPEG — and every one of those used to cost a thumbnail silently.
   * Input the service will never accept is not retried: that is a permanent failure and should
   * surface immediately rather than after three waits.
   */
  private retryOptions(operation: string, context: Record<string, unknown>): RetryOptions {
    return {
      attempts: 3,
      isRetryable: (error: unknown) => {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
        const permanent = [
          'unsupported', 'invalid', 'too large', 'not an image', 'unsupported format', 'malformed'
        ]
        return !permanent.some(marker => message.includes(marker))
      },
      onRetry: ({ error, attempt, delayMs }) => {
        this.deps.logger.warn(`Retrying: ${operation}`, {
          ...context,
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  /**
   * Generate every variant for an image and write them to storage.
   *
   * Shared by upload and regeneration so both get the same retries and the same reporting. A
   * failure never throws: the original file is already stored and is what the caller actually
   * uploaded. But a failure is never swallowed either — it comes back in `report`, which the
   * caller attaches to the media record, so an image with missing variants says so instead of
   * looking complete.
   */
  private async generateVariants(
    id: string,
    file: File,
    metadata: { id: string; filename: string; path: string }
  ): Promise<VariantGenerationOutcome> {
    const failures: VariantFailure[] = []

    let processedImage
    try {
      processedImage = await withRetry(
        () => this.deps.getImageProcessor().processImage(file, metadata),
        this.retryOptions('process image', { fileId: id })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.deps.logger.error('Image processing failed after retries', { fileId: id, error: message })
      return {
        variants: {},
        report: {
          status: 'failed',
          failures: [{ stage: 'process', error: message }],
          failedAt: new Date().toISOString()
        }
      }
    }

    const variants: Record<string, unknown> = {}
    const saveVariantFile = this.deps.mediaStorage.saveVariantFile?.bind(this.deps.mediaStorage)

    for (const [variantName, variantData] of Object.entries(processedImage.variants) as [string, ProcessedImageVariant][]) {
      if (!variantData.buffer) continue

      if (!saveVariantFile) {
        // No variant storage: keep the processor's own URL, which is all there is to keep.
        variants[variantName] = {
          url: variantData.url,
          width: variantData.width,
          height: variantData.height,
          format: variantData.format,
          size: variantData.size
        }
        this.deps.logger.warn('Storage adapter does not support variant files - storing metadata only', {
          parentId: id,
          variantName
        })
        continue
      }

      try {
        const variantPath = await withRetry(
          () => saveVariantFile(id, variantName, variantData.buffer!, variantData.format),
          this.retryOptions('save variant file', { parentId: id, variantName })
        )

        // Store variant info without URL - let frontend handle URL construction
        variants[variantName] = {
          width: variantData.width,
          height: variantData.height,
          format: variantData.format,
          size: variantData.size
        }

        this.deps.logger.info('Variant file saved', { parentId: id, variantName, path: variantPath })
      } catch (variantError) {
        const message = variantError instanceof Error ? variantError.message : 'Unknown error'
        this.deps.logger.error('Variant file could not be saved after retries', {
          parentId: id,
          variantName,
          error: message
        })
        failures.push({ stage: 'save-variant', variant: variantName, error: message })
      }
    }

    return {
      variants,
      originalDimensions: {
        width: processedImage.original.width,
        height: processedImage.original.height
      },
      report: failures.length === 0
        ? undefined
        : { status: 'partial', failures, failedAt: new Date().toISOString() }
    }
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

      // Delete existing variants first. A failure here is not fatal — the names are about to be
      // overwritten anyway — but it is reported rather than dropped, because leftovers of a
      // format no longer generated would linger in storage.
      const staleVariantFailures: VariantFailure[] = []
      if (this.deps.mediaStorage.deleteVariantFiles) {
        const deleteVariantFiles = this.deps.mediaStorage.deleteVariantFiles.bind(this.deps.mediaStorage)
        try {
          await withRetry(() => deleteVariantFiles(id), this.retryOptions('delete existing variants', { id }))
          this.deps.logger.info('Existing variants deleted', { id })
        } catch (deleteError) {
          const message = deleteError instanceof Error ? deleteError.message : 'Unknown error'
          this.deps.logger.error('Existing variants could not be deleted after retries', { id, error: message })
          staleVariantFailures.push({ stage: 'save-variant', error: `stale variants left in place: ${message}` })
        }
      }

      // The same generation path as upload, so retries and reporting cannot drift apart.
      const outcome = await this.generateVariants(id, file, {
        id: mediaFile.id,
        filename: mediaFile.filename,
        path: (mediaFile.metadata as any)?.path || mediaFile.filename
      })

      const failures = [...staleVariantFailures, ...(outcome.report?.failures ?? [])]

      // Update metadata with new variants
      const updatedMetadata = {
        ...mediaFile.metadata,
        imageVariants: outcome.variants,
        ...(outcome.originalDimensions ? { originalDimensions: outcome.originalDimensions } : {}),
        imageProcessing: failures.length === 0
          ? undefined
          : {
              status: outcome.report?.status ?? 'partial',
              failures,
              failedAt: new Date().toISOString()
            }
      }

      // Save updated metadata
      const updatedMediaFile = await this.deps.mediaStorage.updateFile?.(id, updatedMetadata)
      if (!updatedMediaFile) {
        throw new Error('Failed to update media file metadata')
      }

      this.deps.logger.info('Variants regenerated', {
        id,
        variantCount: Object.keys(outcome.variants).length,
        failureCount: failures.length
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
