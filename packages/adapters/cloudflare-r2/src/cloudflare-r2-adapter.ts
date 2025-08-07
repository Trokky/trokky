import type { R2Bucket } from '@cloudflare/workers-types'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  MediaStorageAdapter,
  MediaFile,
  MediaMetadata,
  MediaListOptions,
  InvalidInputError,
  SecurityValidator,
  createLogger,
  generateUUID
} from '@trokky/core'
import type {
  CloudflareR2AdapterConfig,
  R2UploadOptions,
  R2FileMetadata
} from './types.js'

/**
 * Cloudflare R2 Media Storage Adapter
 * 
 * Provides media storage using Cloudflare R2 object storage.
 * Optimized for edge runtime with minimal dependencies.
 */
export class CloudflareR2Adapter implements MediaStorageAdapter {
  private bucket: R2Bucket | null = null
  private config: CloudflareR2AdapterConfig
  private logger = createLogger('adapter', 'CloudflareR2')
  private keyPrefix: string
  private s3Client: S3Client | null = null

  constructor(config: CloudflareR2AdapterConfig = {}) {
    this.config = config
    this.keyPrefix = config.keyPrefix || 'media/'
    
    if (config.bucket) {
      this.bucket = config.bucket
    }

    // Initialize S3Client for presigned URLs if credentials are provided
    if (config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName) {
      try {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        })
        this.logger.info('S3Client configured for presigned URLs')
      } catch (error) {
        this.logger.error('Failed to initialize S3Client for presigned URLs', error)
      }
    }

    if (!this.bucket && !config.bucketName) {
      this.logger.warn('No R2 bucket provided. Call setBucket() before use.')
    }

    if (!this.s3Client && !config.allowPublicUrls) {
      this.logger.warn(
        'No S3Client configured and public URLs disabled. URL generation will fail. ' +
        'Provide accountId, accessKeyId, secretAccessKey, and bucketName for presigned URLs, ' +
        'or set allowPublicUrls: true with customDomain for public URLs.'
      )
    }
  }

  /**
   * Set the R2 bucket instance (for runtime binding)
   */
  public setBucket(bucket: R2Bucket): void {
    this.bucket = bucket
    this.logger.info('R2 bucket binding set')
  }

  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================

  public async uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile> {
    try {
      if (!this.bucket) throw new Error('R2 bucket not configured')
      
      // Validate file and metadata
      await this.validateFile(file)
      this.validateMetadata(metadata)

      const fileId = metadata.id || this.generateFileId(metadata.filename)
      const key = this.getFileKey(fileId)

      // Prepare upload options
      const uploadOptions: R2UploadOptions = {
        contentType: metadata.contentType || this.detectContentType(metadata.filename),
        metadata: {
          ...this.config.defaultMetadata,
          originalFilename: metadata.filename,
          uploadedAt: new Date().toISOString(),
          fileId: fileId,
          contentType: metadata.contentType || this.detectContentType(metadata.filename),
          size: metadata.size.toString()
        },
        cacheControl: this.config.cacheControl || 'public, max-age=31536000'
      }

      // Convert File to ArrayBuffer for R2
      const arrayBuffer = await file.arrayBuffer()

      // Upload to R2
      const result = await this.bucket.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: uploadOptions.contentType,
          cacheControl: uploadOptions.cacheControl,
          contentEncoding: uploadOptions.contentEncoding,
          contentLanguage: uploadOptions.contentLanguage
        },
        customMetadata: uploadOptions.metadata
      })

      if (!result) {
        throw new Error('Failed to upload file to R2')
      }

      this.logger.info('File uploaded successfully', { fileId, key, size: file.size })

      // Return MediaFile record
      return this.createMediaFile(fileId, file, metadata, result)
    } catch (error) {
      this.logger.error('Failed to upload file', error)
      throw error
    }
  }

  public async getFile(id: string): Promise<MediaFile | null> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const key = this.getFileKey(id)
      const object = await this.bucket.head(key)

      if (!object) return null

      return this.r2ObjectToMediaFile(id, object)
    } catch (error) {
      this.logger.error(`Failed to get file ${id}`, error)
      throw error
    }
  }

  public async updateFile(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const key = this.getFileKey(id)
      
      // Get existing file
      const existing = await this.bucket.head(key)
      if (!existing) {
        throw new Error(`File ${id} not found`)
      }

      // Merge metadata
      const updatedMetadata = {
        ...existing.customMetadata,
        ...metadata,
        updatedAt: new Date().toISOString()
      }

      // Get file content for re-upload with updated metadata
      const content = await this.bucket.get(key)
      if (!content) {
        throw new Error(`Failed to retrieve file content for ${id}`)
      }

      // Re-upload with updated metadata
      await this.bucket.put(key, await content.arrayBuffer(), {
        httpMetadata: existing.httpMetadata,
        customMetadata: updatedMetadata
      })

      this.logger.info('File metadata updated', { id, metadata })

      // Return updated file
      const updatedObject = await this.bucket.head(key)
      if (!updatedObject) {
        throw new Error('Failed to retrieve updated file')
      }

      return this.r2ObjectToMediaFile(id, updatedObject)
    } catch (error) {
      this.logger.error(`Failed to update file ${id}`, error)
      throw error
    }
  }

  public async getFileContent(id: string): Promise<ArrayBuffer | null> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const key = this.getFileKey(id)
      const object = await this.bucket.get(key)

      if (!object) return null

      return await object.arrayBuffer()
    } catch (error) {
      this.logger.error(`Failed to get file content ${id}`, error)
      throw error
    }
  }

  public async getFileUrl(id: string, options?: { expiresIn?: number }): Promise<string | null> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      const key = this.getFileKey(id)
      
      // Check if file exists first
      const exists = await this.fileExists(id)
      if (!exists) return null
      
      // Priority 1: Generate secure presigned URL if S3Client is configured
      if (this.s3Client && this.config.bucketName) {
        const expiresIn = this.validateExpirationTime(options?.expiresIn)
        
        try {
          const command = new GetObjectCommand({
            Bucket: this.config.bucketName,
            Key: key,
          })
          
          const presignedUrl = await getSignedUrl(this.s3Client, command, {
            expiresIn: expiresIn,
          })
          
          this.logger.debug('Generated presigned URL', { 
            fileId: id, 
            expiresIn,
            urlLength: presignedUrl.length
          })
          
          return presignedUrl
        } catch (presignedError) {
          this.logger.error('Failed to generate presigned URL', {
            error: presignedError,
            fileId: id
          })
          
          // Fall through to public URL if allowed
        }
      }
      
      // Priority 2: Fall back to public URL if explicitly allowed
      if (this.config.allowPublicUrls && this.config.customDomain) {
        this.logger.warn('Using public URL fallback - reduced security', { fileId: id })
        return `https://${this.config.customDomain}/${key}`
      }
      
      // Priority 3: No URL generation possible
      this.logger.error('No URL generation method available', {
        fileId: id,
        hasS3Client: !!this.s3Client,
        hasBucketName: !!this.config.bucketName,
        allowPublicUrls: this.config.allowPublicUrls,
        hasCustomDomain: !!this.config.customDomain,
        suggestion: 'Configure presigned URL credentials (accountId, accessKeyId, secretAccessKey, bucketName) or enable public URLs'
      })
      
      return null
      
    } catch (error) {
      this.logger.error(`Failed to get file URL ${id}`, error)
      return null
    }
  }

  public async listMedia(options: MediaListOptions = {}): Promise<MediaFile[]> {
    try {
      if (!this.bucket) throw new Error('R2 bucket not configured')

      // Validate pagination parameters
      const limit = options.limit || 100

      if (limit < 1 || limit > 1000) {
        throw new InvalidInputError('Invalid limit: must be between 1 and 1000')
      }

      // List objects in R2 bucket
      const listOptions: any = {
        limit,
        prefix: this.keyPrefix
      }

      const result = await this.bucket.list(listOptions)
      
      const mediaFiles: MediaFile[] = []
      
      for (const object of result.objects) {
        const fileId = this.extractFileIdFromKey(object.key)
        const mediaFile = this.r2ObjectToMediaFile(fileId, object)
        
        // Apply content type filter if specified
        if (options.contentType && !mediaFile.contentType?.includes(options.contentType)) {
          continue
        }
        
        mediaFiles.push(mediaFile)
      }

      this.logger.debug('Listed media files', { count: mediaFiles.length, truncated: result.truncated })

      return mediaFiles
    } catch (error) {
      this.logger.error('Failed to list media files', error)
      throw error
    }
  }

  public async deleteFile(id: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const key = this.getFileKey(id)
      
      // Check if file exists
      const exists = await this.fileExists(id)
      if (!exists) {
        throw new Error(`File ${id} not found`)
      }

      // Delete main file
      await this.bucket.delete(key)

      // Delete all variants
      await this.deleteVariantFiles(id)

      this.logger.info('File and variants deleted', { id })
    } catch (error) {
      this.logger.error(`Failed to delete file ${id}`, error)
      throw error
    }
  }

  public async fileExists(id: string): Promise<boolean> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const key = this.getFileKey(id)
      const object = await this.bucket.head(key)

      return object !== null
    } catch (error) {
      this.logger.error(`Failed to check file existence ${id}`, error)
      return false
    }
  }

  /**
   * Generate Content-Security-Policy header for served files
   * 
   * @param contentType - MIME type of the file
   * @param filename - Original filename for extension-based rules
   * @returns CSP header value or null if CSP is disabled
   */
  public generateCSPHeader(contentType: string, filename?: string): string | null {
    const cspConfig = this.config.cspConfig

    // Return null if CSP is disabled
    if (!cspConfig?.enabled) {
      return null
    }

    // Get file extension for additional checks
    const extension = filename ? filename.split('.').pop()?.toLowerCase() : ''

    // Start with base directives
    const directives: string[] = []

    // Content-type specific policies
    if (contentType.startsWith('text/html') || extension === 'html') {
      // HTML files - most restrictive
      directives.push("default-src 'none'")
      directives.push("script-src 'none'")
      directives.push("object-src 'none'")
      directives.push("frame-src 'none'")
      directives.push("style-src 'unsafe-inline'") // Allow inline styles for basic rendering
      directives.push("img-src 'self' data:")
    } else if (contentType.startsWith('image/svg+xml') || extension === 'svg') {
      // SVG files - prevent script execution
      directives.push("default-src 'none'")
      directives.push("script-src 'none'")
      directives.push("object-src 'none'")
      directives.push("frame-src 'none'")
      directives.push("style-src 'unsafe-inline'")
      directives.push("img-src 'self'")
    } else if (contentType.startsWith('text/css') || extension === 'css') {
      // CSS files - prevent @import from external sources
      directives.push("default-src 'none'")
      directives.push("style-src 'self' 'unsafe-inline'")
      directives.push("font-src 'self'")
    } else if (contentType.startsWith('application/javascript') || 
               contentType.startsWith('text/javascript') ||
               extension === 'js' || extension === 'mjs') {
      // JavaScript files - completely blocked
      directives.push("default-src 'none'")
      directives.push("script-src 'none'")
    } else if (contentType.startsWith('application/json') || extension === 'json') {
      // JSON files - prevent any execution
      directives.push("default-src 'none'")
      directives.push("script-src 'none'")
    } else if (contentType.startsWith('text/markdown') || extension === 'md') {
      // Markdown files - basic text rendering only
      directives.push("default-src 'none'")
      directives.push("script-src 'none'")
      directives.push("style-src 'unsafe-inline'")
      directives.push("img-src 'self' data:")
    } else if (contentType.startsWith('application/pdf')) {
      // PDF files - allow PDF viewer functionality
      directives.push("default-src 'self'")
      directives.push("script-src 'none'")
      directives.push("object-src 'self'")
    } else if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
      // Media files - basic display only
      directives.push("default-src 'none'")
      directives.push("script-src 'none'")
      directives.push("media-src 'self'")
      directives.push("img-src 'self'")
    }

    // Check for custom policy for this content type
    if (cspConfig.policies?.[contentType]) {
      // Use custom policy instead of defaults
      return cspConfig.policies[contentType]
    }

    // Use default policy if no specific rules matched
    if (directives.length === 0 && cspConfig.defaultPolicy) {
      directives.push(cspConfig.defaultPolicy)
    }

    // Add additional directives from config
    if (cspConfig.additionalDirectives) {
      directives.push(...cspConfig.additionalDirectives)
    }

    // Always add report-uri if configured
    if (cspConfig.reportUri) {
      directives.push(`report-uri ${cspConfig.reportUri}`)
    }

    // Return combined policy or fallback
    return directives.length > 0 ? directives.join('; ') : "default-src 'none'"
  }

  /**
   * Get recommended CSP headers for a file response
   * 
   * @param contentType - MIME type of the file
   * @param filename - Original filename
   * @returns Object with CSP headers to set
   */
  public getSecurityHeaders(contentType: string, filename?: string): Record<string, string> {
    const headers: Record<string, string> = {}

    // Add CSP header if enabled
    const csp = this.generateCSPHeader(contentType, filename)
    if (csp) {
      headers['Content-Security-Policy'] = csp
    }

    // Add additional security headers based on file type
    if (contentType.startsWith('text/html')) {
      headers['X-Content-Type-Options'] = 'nosniff'
      headers['X-Frame-Options'] = 'DENY'
      headers['X-XSS-Protection'] = '1; mode=block'
    } else if (contentType.startsWith('image/svg+xml')) {
      headers['X-Content-Type-Options'] = 'nosniff'
      headers['X-Frame-Options'] = 'SAMEORIGIN'
    } else if (contentType.startsWith('application/javascript') || 
               contentType.startsWith('text/javascript')) {
      headers['X-Content-Type-Options'] = 'nosniff'
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    }

    return headers
  }

  public async getFileSize(id: string): Promise<number | null> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const key = this.getFileKey(id)
      const object = await this.bucket.head(key)

      return object ? object.size : null
    } catch (error) {
      this.logger.error(`Failed to get file size ${id}`, error)
      return null
    }
  }

  // ==========================================================================
  // VARIANT OPERATIONS
  // ==========================================================================

  public async saveVariantFile(parentId: string, variantName: string, buffer: Uint8Array, format: string): Promise<string> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      const variantKey = this.getVariantKey(parentId, variantName, format)
      
      // Upload variant
      await this.bucket.put(variantKey, buffer, {
        httpMetadata: {
          contentType: this.getContentTypeForFormat(format),
          cacheControl: this.config.cacheControl || 'public, max-age=31536000'
        },
        customMetadata: {
          parentId,
          variantName,
          format,
          createdAt: new Date().toISOString()
        }
      })

      this.logger.debug('Variant saved', { parentId, variantName, format, size: buffer.length })

      return variantKey
    } catch (error) {
      this.logger.error(`Failed to save variant ${parentId}/${variantName}`, error)
      throw error
    }
  }

  public async getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      // Try different formats for the variant
      const possibleFormats = ['webp', 'jpeg', 'jpg', 'png', 'avif']
      
      for (const format of possibleFormats) {
        const variantKey = this.getVariantKey(parentId, variantName, format)
        const object = await this.bucket.get(variantKey)
        
        if (object) {
          return await object.arrayBuffer()
        }
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to get variant content ${parentId}/${variantName}`, error)
      throw error
    }
  }

  public async getVariantUrl(parentId: string, variantName: string, options?: { expiresIn?: number }): Promise<string | null> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      
      // Try different formats for the variant
      const possibleFormats = ['webp', 'jpeg', 'jpg', 'png', 'avif']
      
      for (const format of possibleFormats) {
        const variantKey = this.getVariantKey(parentId, variantName, format)
        
        if (await this.objectExists(variantKey)) {
          // Priority 1: Generate secure presigned URL if S3Client is configured
          if (this.s3Client && this.config.bucketName) {
            const expiresIn = this.validateExpirationTime(options?.expiresIn)
            
            try {
              const command = new GetObjectCommand({
                Bucket: this.config.bucketName,
                Key: variantKey,
              })
              
              const presignedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn: expiresIn,
              })
              
              this.logger.debug('Generated variant presigned URL', {
                parentId,
                variantName,
                format,
                expiresIn,
                urlLength: presignedUrl.length
              })
              
              return presignedUrl
            } catch (presignedError) {
              this.logger.error('Failed to generate variant presigned URL', {
                error: presignedError,
                parentId,
                variantName,
                format
              })
              
              // Fall through to public URL if allowed
            }
          }
          
          // Priority 2: Fall back to public URL if explicitly allowed
          if (this.config.allowPublicUrls && this.config.customDomain) {
            this.logger.warn('Using public variant URL fallback - reduced security', { 
              parentId, 
              variantName, 
              format 
            })
            return `https://${this.config.customDomain}/${variantKey}`
          }
          
          // Priority 3: No URL generation possible for this variant
          this.logger.error('No variant URL generation method available', {
            parentId,
            variantName,
            format,
            hasS3Client: !!this.s3Client,
            hasBucketName: !!this.config.bucketName,
            allowPublicUrls: this.config.allowPublicUrls,
            hasCustomDomain: !!this.config.customDomain
          })
          
          return null
        }
      }

      // No variant found in any format
      return null
    } catch (error) {
      this.logger.error(`Failed to get variant URL ${parentId}/${variantName}`, error)
      return null
    }
  }

  public async deleteVariant(parentId: string, variantName: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      
      if (!this.bucket) throw new Error('R2 bucket not configured')

      // Delete all formats of this variant
      const possibleFormats = ['webp', 'jpeg', 'jpg', 'png', 'avif']
      
      for (const format of possibleFormats) {
        const variantKey = this.getVariantKey(parentId, variantName, format)
        await this.bucket.delete(variantKey)
      }

      this.logger.debug('Variant deleted', { parentId, variantName })
    } catch (error) {
      this.logger.error(`Failed to delete variant ${parentId}/${variantName}`, error)
      throw error
    }
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  private getFileKey(id: string): string {
    return `${this.keyPrefix}${id}`
  }

  private getVariantKey(parentId: string, variantName: string, format: string): string {
    return `${this.keyPrefix}${parentId}/variants/${variantName}.${format}`
  }

  private extractFileIdFromKey(key: string): string {
    // Remove prefix to get file ID
    return key.replace(this.keyPrefix, '').split('/')[0]
  }

  private generateFileId(filename: string): string {
    const uuid = generateUUID()
    const extension = filename.split('.').pop() || ''
    return extension ? `media-${uuid}.${extension}` : `media-${uuid}`
  }

  private async validateFile(file: File): Promise<void> {
    if (!file) {
      throw new InvalidInputError('File is required')
    }

    if (file.size === 0) {
      throw new InvalidInputError('File is empty')
    }

    // Enhanced size validation with per-type limits
    await this.validateFileSize(file)

    // Validate content type against file headers (magic numbers)
    await this.validateContentTypeByHeaders(file)

    // Additional security checks
    await this.validateFileContent(file)
  }

  private validateMetadata(metadata: MediaMetadata): void {
    if (!metadata.filename) {
      throw new InvalidInputError('Filename is required in metadata')
    }

    // Comprehensive filename sanitization and validation
    const sanitizedFilename = this.sanitizeFilename(metadata.filename)
    if (sanitizedFilename !== metadata.filename) {
      this.logger.warn('Filename was sanitized', { 
        original: metadata.filename, 
        sanitized: sanitizedFilename 
      })
      // Update metadata with sanitized filename
      metadata.filename = sanitizedFilename
    }

    // Validate filename length
    if (metadata.filename.length > 255) {
      throw new InvalidInputError('Filename too long (max 255 characters)')
    }

    // Validate filename is not reserved
    this.validateFilenameNotReserved(metadata.filename)

    // Note: MediaMetadata interface doesn't include description, alt, or metadata fields
    // These would be handled at a higher level if needed
  }

  private isAllowedContentType(contentType: string): boolean {
    // Allow common media types - in production, you'd want to configure this
    const allowedTypes = [
      'image/',
      'video/',
      'audio/',
      'application/pdf',
      'text/',
      'application/json',
      'application/xml'
    ]

    return allowedTypes.some(type => contentType.startsWith(type))
  }

  private detectContentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'xml': 'application/xml'
    }

    return extension ? (contentTypes[extension] || 'application/octet-stream') : 'application/octet-stream'
  }

  private getContentTypeForFormat(format: string): string {
    const formatTypes: Record<string, string> = {
      'webp': 'image/webp',
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'avif': 'image/avif'
    }

    return formatTypes[format] || 'image/jpeg'
  }

  private async objectExists(key: string): Promise<boolean> {
    try {
      if (!this.bucket) return false
      const object = await this.bucket.head(key)
      return object !== null
    } catch {
      return false
    }
  }

  public async deleteVariantFiles(parentId: string): Promise<void> {
    try {
      if (!this.bucket) return

      // List all objects with parent ID prefix to find variants
      const variantPrefix = `${this.keyPrefix}${parentId}/variants/`
      const result = await this.bucket.list({ prefix: variantPrefix })

      // Delete each variant
      for (const object of result.objects) {
        await this.bucket.delete(object.key)
      }

      this.logger.debug('All variants deleted', { parentId, count: result.objects.length })
    } catch (error) {
      this.logger.error(`Failed to delete variants for ${parentId}`, error)
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.bucket) {
        this.logger.warn('R2 bucket not configured for health check')
        return false
      }

      // Try to list objects with a small limit to test R2 connectivity
      const result = await this.bucket.list({ limit: 1 })
      
      // If we can list objects, the connection is healthy
      this.logger.debug('R2 health check passed', { 
        objectCount: result.objects.length,
        truncated: result.truncated
      })
      
      return true
    } catch (error) {
      this.logger.error('R2 health check failed', error)
      return false
    }
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  private createMediaFile(id: string, file: File, metadata: MediaMetadata, r2Object: any): MediaFile {
    return {
      id,
      url: `${this.keyPrefix}${id}`, // This would be the full URL with custom domain
      filename: metadata.filename,
      contentType: metadata.contentType || file.type,
      size: file.size,
      metadata: {
        originalFilename: metadata.filename,
        uploadedAt: new Date().toISOString()
      },
      _createdAt: new Date()
    }
  }

  private r2ObjectToMediaFile(id: string, object: any): MediaFile {
    return {
      id,
      url: `${this.keyPrefix}${id}`,
      filename: object.customMetadata?.originalFilename || id,
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      size: object.size,
      metadata: object.customMetadata || {},
      _createdAt: object.uploaded || new Date()
    }
  }

  /**
   * Validate file size with per-type limits
   */
  private async validateFileSize(file: File): Promise<void> {
    const maxFileSize = this.config.maxFileSize || 50 * 1024 * 1024 // 50MB default

    if (file.size > maxFileSize) {
      throw new InvalidInputError(`File size ${file.size} exceeds maximum allowed size of ${maxFileSize} bytes`)
    }

    // Per-content-type size limits for additional security
    const contentTypeLimits: Record<string, number> = {
      'image/': 10 * 1024 * 1024,  // 10MB for images
      'video/': 100 * 1024 * 1024, // 100MB for videos
      'audio/': 20 * 1024 * 1024,  // 20MB for audio
      'application/pdf': 25 * 1024 * 1024, // 25MB for PDFs
      'text/': 1 * 1024 * 1024,    // 1MB for text files
    }

    if (file.type) {
      for (const [typePrefix, limit] of Object.entries(contentTypeLimits)) {
        if (file.type.startsWith(typePrefix) && file.size > limit) {
          throw new InvalidInputError(`File size ${file.size} exceeds limit for ${typePrefix} files (max ${limit} bytes)`)
        }
      }
    }
  }

  /**
   * Validate content type by checking file headers (magic numbers)
   */
  private async validateContentTypeByHeaders(file: File): Promise<void> {
    // Read first 32 bytes to check magic numbers
    const buffer = await file.slice(0, 32).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Check for common file signatures
    const fileSignature = this.detectFileSignature(bytes)
    
    if (!fileSignature) {
      // If we can't detect the file type, at least validate declared content type
      if (!file.type || !this.isAllowedContentType(file.type)) {
        throw new InvalidInputError(`Unrecognized or disallowed file type: ${file.type || 'unknown'}`)
      }
      return
    }

    // Verify declared content type matches detected type
    if (file.type && !this.contentTypesMatch(file.type, fileSignature.mimeType)) {
      throw new InvalidInputError(`File content type mismatch: declared ${file.type}, detected ${fileSignature.mimeType}`)
    }

    // Ensure detected type is allowed
    if (!this.isAllowedContentType(fileSignature.mimeType)) {
      throw new InvalidInputError(`File type ${fileSignature.mimeType} is not allowed`)
    }
  }

  /**
   * Additional file content security checks
   */
  private async validateFileContent(file: File): Promise<void> {
    const contentType = file.type || ''
    const fileName = file.name || ''
    
    // Determine if file needs content scanning based on type or extension
    const needsScanning = this.requiresContentScanning(contentType, fileName)
    
    if (!needsScanning) {
      return
    }

    try {
      const text = await file.text()
      
      // Enhanced dangerous content patterns
      const dangerousPatterns = [
        // Script injection
        /<script[^>]*>/i,
        /<\/script>/i,
        /javascript:/i,
        /vbscript:/i,
        /data:\s*text\/html/i,
        
        // Event handlers and DOM manipulation
        /onload\s*=/i,
        /onerror\s*=/i,
        /onclick\s*=/i,
        /onmouseover\s*=/i,
        /onfocus\s*=/i,
        /onsubmit\s*=/i,
        
        // Dangerous JavaScript functions
        /eval\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        /Function\s*\(/i,
        /execScript\s*\(/i,
        
        // DOM and Cookie access
        /document\.cookie/i,
        /document\.write/i,
        /document\.writeln/i,
        /window\.location/i,
        /location\.href/i,
        
        // External resource loading
        /<iframe[^>]*src/i,
        /<embed[^>]*src/i,
        /<object[^>]*data/i,
        /<link[^>]*href/i,
        /@import\s+url/i,
        
        // Base64 encoded scripts
        /data:application\/javascript/i,
        /data:text\/javascript/i,
        
        // Server-side includes and templating
        /<\?php/i,
        /<\%/i,
        /<%=/i,
        /<jsp:/i,
        /{{\s*[^}]+\s*}}/i, // Template expressions
        
        // SQL injection attempts in data files
        /union\s+select/i,
        /drop\s+table/i,
        /insert\s+into/i,
        /delete\s+from/i,
        
        // Command injection
        /\|\s*[a-z]+/i, // Pipe to commands
        /;\s*[a-z]+/i,  // Command chaining
        /&&\s*[a-z]+/i, // Command chaining
        /\$\([^)]+\)/i, // Command substitution
        /`[^`]+`/i,     // Backtick execution
        
        // Protocol handlers that can execute code
        /mailto:/i,
        /file:/i,
        /ftp:/i,
      ]

      for (const pattern of dangerousPatterns) {
        if (pattern.test(text)) {
          this.logger.warn('Dangerous content detected', {
            fileName: fileName,
            contentType: contentType,
            pattern: pattern.source,
            fileSize: file.size
          })
          throw new InvalidInputError(`File contains potentially dangerous content: ${pattern.source}`)
        }
      }
      
      // Additional checks for specific file types
      await this.performSpecializedContentChecks(text, contentType, fileName)

      // Limit text file size for additional safety
      if (text.length > 1024 * 1024) { // 1MB for text content
        throw new InvalidInputError('Text content exceeds maximum size limit')
      }
      
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error
      }
      
      // If we can't read as text, check if it's a binary file that shouldn't contain scripts
      if (this.shouldCheckBinaryForScripts(contentType, fileName)) {
        await this.validateBinaryContent(file)
      }
    }
  }
  
  /**
   * Determine if a file requires content scanning based on type and extension
   */
  private requiresContentScanning(contentType: string, fileName: string): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    
    // Text-based files that can contain executable content
    const textBasedTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/xhtml+xml',
      'application/javascript',
      'application/typescript',
      'application/x-javascript',
      'application/ecmascript',
      'application/x-httpd-php',
      'application/x-asp',
      'application/x-jsp',
      'image/svg+xml',
    ]
    
    // File extensions that should be scanned
    const scannedExtensions = [
      'html', 'htm', 'xhtml', 'xml', 'svg', 'xsl', 'xslt',
      'js', 'jsx', 'ts', 'tsx', 'json', 'jsonp',
      'php', 'phtml', 'asp', 'aspx', 'jsp', 'jspx',
      'py', 'rb', 'pl', 'sh', 'bat', 'cmd', 'ps1',
      'css', 'scss', 'sass', 'less',
      'md', 'markdown', 'txt', 'csv', 'tsv',
      'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf',
    ]
    
    // Check content type
    for (const type of textBasedTypes) {
      if (contentType.startsWith(type) || contentType.includes(type)) {
        return true
      }
    }
    
    // Check file extension
    return scannedExtensions.includes(extension)
  }
  
  /**
   * Perform specialized content checks based on file type
   */
  private async performSpecializedContentChecks(text: string, contentType: string, fileName: string): Promise<void> {
    // SVG-specific checks
    if (contentType.includes('svg') || fileName.endsWith('.svg')) {
      await this.validateSvgContent(text)
    }
    
    // CSS-specific checks
    if (contentType.includes('css') || fileName.endsWith('.css')) {
      await this.validateCssContent(text)
    }
    
    // JSON-specific checks
    if (contentType.includes('json') || fileName.endsWith('.json')) {
      await this.validateJsonContent(text)
    }
    
    // Markdown-specific checks
    if (contentType.includes('markdown') || fileName.endsWith('.md')) {
      await this.validateMarkdownContent(text)
    }
  }
  
  /**
   * Validate SVG content for additional security risks
   */
  private async validateSvgContent(text: string): Promise<void> {
    const svgDangerousPatterns = [
      /<foreignObject/i,
      /<use[^>]+href=["']javascript:/i,
      /<animate[^>]+values[^>]*javascript:/i,
      /<set[^>]+to=["']javascript:/i,
      /<script[^>]*>/i,
    ]
    
    for (const pattern of svgDangerousPatterns) {
      if (pattern.test(text)) {
        throw new InvalidInputError(`SVG contains dangerous content: ${pattern.source}`)
      }
    }
  }
  
  /**
   * Validate CSS content for security risks
   */
  private async validateCssContent(text: string): Promise<void> {
    const cssDangerousPatterns = [
      /@import\s+url\s*\(\s*["']?javascript:/i,
      /expression\s*\(/i, // IE expression() vulnerability
      /binding\s*:/i,     // Mozilla binding vulnerability
      /-moz-binding/i,
      /behavior\s*:/i,    // IE behavior vulnerability
      /javascript\s*:/i,
      /vbscript\s*:/i,
    ]
    
    for (const pattern of cssDangerousPatterns) {
      if (pattern.test(text)) {
        throw new InvalidInputError(`CSS contains dangerous content: ${pattern.source}`)
      }
    }
  }
  
  /**
   * Validate JSON content for security risks
   */
  private async validateJsonContent(text: string): Promise<void> {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(text)
      
      // Check for potential prototype pollution
      if (this.containsPrototypePollution(parsed)) {
        throw new InvalidInputError('JSON contains potential prototype pollution')
      }
      
    } catch (jsonError) {
      // If it's not valid JSON but claims to be, that's suspicious
      if (jsonError instanceof SyntaxError) {
        // Allow invalid JSON with a warning - might be JSONP or similar
        this.logger.warn('File claims to be JSON but is not valid JSON', {
          error: jsonError.message
        })
      }
    }
  }
  
  /**
   * Validate Markdown content for security risks
   */
  private async validateMarkdownContent(text: string): Promise<void> {
    const markdownDangerousPatterns = [
      /\[.*\]\(javascript:/i,
      /\[.*\]\(data:text\/html/i,
      /\[.*\]\(vbscript:/i,
      /<script[^>]*>/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
    ]
    
    for (const pattern of markdownDangerousPatterns) {
      if (pattern.test(text)) {
        throw new InvalidInputError(`Markdown contains dangerous content: ${pattern.source}`)
      }
    }
  }
  
  /**
   * Check for prototype pollution in parsed objects
   */
  private containsPrototypePollution(obj: any, depth = 0): boolean {
    if (depth > 10 || !obj || typeof obj !== 'object') {
      return false
    }
    
    const dangerousKeys = ['__proto__', 'constructor', 'prototype']
    
    for (const key in obj) {
      if (dangerousKeys.includes(key)) {
        return true
      }
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (this.containsPrototypePollution(obj[key], depth + 1)) {
          return true
        }
      }
    }
    
    return false
  }
  
  /**
   * Check if binary file should be scanned for embedded scripts
   */
  private shouldCheckBinaryForScripts(contentType: string, fileName: string): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    
    // File types that might contain embedded scripts or metadata
    const suspiciousTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'image/svg+xml',
    ]
    
    const suspiciousExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    
    return suspiciousTypes.some(type => contentType.includes(type)) ||
           suspiciousExtensions.includes(extension)
  }
  
  /**
   * Validate binary content for embedded threats
   */
  private async validateBinaryContent(file: File): Promise<void> {
    // Read first and last chunks to check for obvious script content
    const chunkSize = 4096 // 4KB chunks
    
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      
      // Convert chunks to text to search for patterns
      const firstChunk = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(bytes.slice(0, chunkSize))
      const lastChunk = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(bytes.slice(-chunkSize))
      
      const binaryDangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /%3Cscript/i, // URL encoded
        /&#60;script/i, // HTML encoded
      ]
      
      for (const pattern of binaryDangerousPatterns) {
        if (pattern.test(firstChunk) || pattern.test(lastChunk)) {
          throw new InvalidInputError(`Binary file contains suspicious script content: ${pattern.source}`)
        }
      }
      
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error
      }
      // If we can't read the binary content, log but don't fail
      this.logger.debug('Could not scan binary content', { 
        fileName: file.name,
        contentType: file.type,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Detect file signature from magic numbers
   */
  private detectFileSignature(bytes: Uint8Array): { mimeType: string; extension: string } | null {
    const signatures: Array<{ 
      signature: number[], 
      mimeType: string, 
      extension: string,
      offset?: number 
    }> = [
      // Images
      { signature: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg', extension: 'jpg' },
      { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: 'image/png', extension: 'png' },
      { signature: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif', extension: 'gif' },
      { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', extension: 'webp', offset: 0 },
      
      // Documents
      { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', extension: 'pdf' },
      
      // Audio
      { signature: [0x49, 0x44, 0x33], mimeType: 'audio/mpeg', extension: 'mp3' },
      { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'audio/wav', extension: 'wav', offset: 0 },
      
      // Video
      { signature: [0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4', extension: 'mp4', offset: 4 },
    ]

    for (const sig of signatures) {
      const offset = sig.offset || 0
      const match = sig.signature.every((byte, index) => 
        bytes[offset + index] === byte
      )
      
      if (match) {
        // Additional validation for WebP and WAV (they share RIFF signature)
        if (sig.mimeType === 'image/webp') {
          // WebP has 'WEBP' at bytes 8-11
          if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
            return sig
          }
          continue
        }
        if (sig.mimeType === 'audio/wav') {
          // WAV has 'WAVE' at bytes 8-11
          if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
            return sig
          }
          continue
        }
        
        return sig
      }
    }

    return null
  }

  /**
   * Check if declared content type matches detected type
   */
  private contentTypesMatch(declared: string, detected: string): boolean {
    // Exact match
    if (declared === detected) return true
    
    // Allow common aliases
    const aliases: Record<string, string[]> = {
      'image/jpeg': ['image/jpg'],
      'audio/mpeg': ['audio/mp3'],
    }
    
    return aliases[detected]?.includes(declared) || aliases[declared]?.includes(detected) || false
  }

  /**
   * Sanitize filename to prevent path traversal and injection attacks
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    let sanitized = filename
      .replace(/[<>:"\/\\|?*\x00-\x1f]/g, '') // Remove prohibited characters
      .replace(/\.\./g, '')  // Remove path traversal attempts
      .replace(/^\.+/, '')   // Remove leading dots
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/[^\w\-_.]/g, '') // Keep only safe characters
      .substring(0, 255)     // Limit length
    
    // Ensure extension is safe
    const parts = sanitized.split('.')
    if (parts.length > 1) {
      const extension = parts.pop()?.toLowerCase()
      if (extension && this.isAllowedExtension(extension)) {
        sanitized = [...parts.slice(0, -1), parts[parts.length - 1], extension].join('.')
      } else {
        // Remove unsafe extension
        sanitized = parts.join('.')
      }
    }
    
    // Ensure filename is not empty after sanitization
    if (!sanitized || sanitized.length === 0) {
      sanitized = `file_${Date.now()}`
    }
    
    return sanitized
  }

  /**
   * Check if file extension is allowed
   */
  private isAllowedExtension(extension: string): boolean {
    const allowedExtensions = [
      // Images
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif',
      // Audio
      'mp3', 'wav', 'ogg', 'aac', 'm4a',
      // Video
      'mp4', 'webm', 'avi', 'mov', 'mkv',
      // Documents
      'pdf', 'txt', 'md', 'json', 'xml', 'csv',
    ]
    
    return allowedExtensions.includes(extension.toLowerCase())
  }

  /**
   * Validate filename is not a reserved system name
   */
  private validateFilenameNotReserved(filename: string): void {
    const reservedNames = [
      // Windows reserved names
      'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 
      'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 
      'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
      // Unix/Linux reserved
      '.', '..', 'dev', 'proc', 'sys', 'etc', 'tmp', 'var', 'usr',
      // Application specific
      'config', 'admin', 'api', 'system', 'root', 'index'
    ]
    
    const baseName = filename.split('.')[0].toUpperCase()
    if (reservedNames.includes(baseName)) {
      throw new InvalidInputError(`Filename '${filename}' uses a reserved name`)
    }
  }

  /**
   * Sanitize metadata string fields
   */
  private sanitizeMetadataString(value: string, maxLength: number): string {
    return value
      .replace(/[<>\"'&]/g, '') // Remove HTML/JS injection chars
      .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters  
      .trim()
      .substring(0, maxLength)
  }

  /**
   * Sanitize custom metadata object
   */
  private sanitizeCustomMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}
    const maxKeys = 20
    const maxValueLength = 1000
    
    let keyCount = 0
    for (const [key, value] of Object.entries(metadata)) {
      if (keyCount >= maxKeys) break
      
      // Sanitize key name
      const cleanKey = key
        .replace(/[^\w\-_]/g, '')
        .substring(0, 50)
      
      if (!cleanKey) continue
      
      // Sanitize value based on type
      let cleanValue: any
      if (typeof value === 'string') {
        cleanValue = this.sanitizeMetadataString(value, maxValueLength)
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        cleanValue = value
      } else if (typeof value === 'boolean') {
        cleanValue = value
      } else {
        // Skip complex objects, arrays, functions, etc.
        continue
      }
      
      sanitized[cleanKey] = cleanValue
      keyCount++
    }
    
    return sanitized
  }

  /**
   * Validate and sanitize URL expiration time
   * @param expiresIn - Requested expiration time in seconds
   * @returns Safe expiration time within configured limits
   */
  private validateExpirationTime(expiresIn?: number): number {
    // Default to 1 hour (industry standard)
    const defaultExpiry = this.config.defaultUrlExpiry || 3600 // 1 hour
    const maxExpiry = this.config.maxUrlExpiry || 86400 // 24 hours maximum
    
    if (expiresIn === undefined) {
      return defaultExpiry
    }
    
    if (typeof expiresIn !== 'number' || !Number.isInteger(expiresIn)) {
      this.logger.warn('Invalid expiresIn value, using default', { 
        provided: expiresIn, 
        default: defaultExpiry 
      })
      return defaultExpiry
    }
    
    if (expiresIn < 60) { // Minimum 1 minute
      this.logger.warn('Expiration time too short, using 1 minute minimum', { 
        requested: expiresIn 
      })
      return 60
    }
    
    if (expiresIn > maxExpiry) {
      this.logger.warn('Expiration time too long, capping at maximum', { 
        requested: expiresIn, 
        maximum: maxExpiry 
      })
      return maxExpiry
    }
    
    return expiresIn
  }
}