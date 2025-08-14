import { promises as fs, constants } from 'fs'
import * as fsExtra from 'fs-extra'
import * as path from 'path'
import {
  MediaStorageAdapter,
  MediaFile,
  MediaMetadata,
  MediaListOptions,
  MediaVariant,
  SecurityValidator,
  InvalidInputError,
  createLogger
} from '@trokky/core'
import { FilesystemMediaAdapterConfig, FileMetadata } from './types'

export class FilesystemMediaAdapter implements MediaStorageAdapter {
  private config: Required<Omit<FilesystemMediaAdapterConfig, 'mediaBaseUrl'>> & { 
    mediaBaseUrl?: string; 
  }
  private logger = createLogger('adapter', 'FilesystemMediaAdapter')
  
  // Security limits
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

  constructor(config: FilesystemMediaAdapterConfig = {}) {
    this.config = {
      mediaDir: config.mediaDir || './media',
      createDirs: config.createDirs ?? true,
      prettyJson: config.prettyJson ?? true,
      jsonSpaces: config.jsonSpaces ?? 2,
      syncWrites: config.syncWrites ?? false,
      fileMode: config.fileMode ?? 0o644,
      dirMode: config.dirMode ?? 0o755,
      silent: config.silent ?? false,
      mediaBaseUrl: config.mediaBaseUrl
    }

    // Initialize directories
    if (this.config.createDirs) {
      this.initializeDirectories()
    }

    if (!this.config.silent) {
      this.logger.info('FilesystemMediaAdapter initialized', {
        mediaDir: this.config.mediaDir
      })
    }
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fsExtra.ensureDir(this.config.mediaDir, { mode: this.config.dirMode })
    } catch (error) {
      if (!this.config.silent) {
        this.logger.error('Failed to initialize media directories', error)
      }
      throw error
    }
  }

  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================

  public async uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile> {
    try {
      // Validate media metadata
      this.validateMediaMetadata(metadata)
      
      // Use secure path methods
      const filePath = this.getMediaPath(metadata.id, metadata.extension)
      const metadataPath = this.getMediaMetadataPath(metadata.id)

      // Ensure media directory exists
      await fsExtra.ensureDir(path.dirname(filePath), { mode: this.config.dirMode })
      await fsExtra.ensureDir(path.dirname(metadataPath), { mode: this.config.dirMode })

      // Write file content
      const buffer = await this.fileToBuffer(file)
      
      // Validate file size
      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new InvalidInputError(
          `File too large (${buffer.length} bytes). Maximum size is ${this.MAX_FILE_SIZE} bytes.`,
          'size'
        )
      }
      
      await fs.writeFile(filePath, buffer, { mode: this.config.fileMode })

      const now = new Date()
      const fileMetadata: FileMetadata = {
        id: metadata.id,
        filename: metadata.filename,
        contentType: metadata.contentType,
        size: metadata.size,
        extension: metadata.extension,
        originalPath: filePath,
        createdAt: now,
        updatedAt: now
      }

      // Write metadata atomically
      const metadataContent = this.formatJson(fileMetadata)
      await this.atomicWriteFile(metadataPath, metadataContent)

      // Generate file URL (relative path for portability)
      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      // Generate API-based URL for controlled access
      const fileUrl = this.config.mediaBaseUrl 
        ? `${this.config.mediaBaseUrl}/api/media/${metadata.id}/file`
        : `file://${path.resolve(filePath)}`

      const mediaFile: MediaFile = {
        id: metadata.id,
        url: fileUrl,
        filename: metadata.filename,
        contentType: metadata.contentType,
        size: metadata.size,
        metadata: {
          path: relativeUrl,
          extension: metadata.extension,
          originalFilename: metadata.filename
        },
        _createdAt: now
      }

      if (!this.config.silent) {
        this.logger.info('File uploaded', { 
          id: metadata.id, 
          filename: metadata.filename,
          size: metadata.size
        })
      }

      return mediaFile
    } catch (error) {
      this.logger.error(`Failed to upload file ${metadata.filename}`, error)
      throw error
    }
  }

  public async getFile(id: string): Promise<MediaFile | null> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      const metadataPath = this.getMediaMetadataPath(id)
      
      // Check if metadata file exists
      try {
        await fs.access(metadataPath, constants.F_OK)
      } catch {
        return null
      }

      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const fileMetadata: FileMetadata = this.safeParseJSON<FileMetadata>(metadataContent)

      const filePath = this.getMediaPath(id, fileMetadata.extension)
      
      // Check if actual file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        // Metadata exists but file is missing
        this.logger.warn(`Media file ${id} metadata found but file is missing`)
        return null
      }

      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      // Generate API-based URL for controlled access
      const fileUrl = this.config.mediaBaseUrl 
        ? `${this.config.mediaBaseUrl}/api/media/${fileMetadata.id}/file`
        : `file://${path.resolve(filePath)}`

      const mediaFile: MediaFile = {
        id: fileMetadata.id,
        url: fileUrl,
        filename: fileMetadata.filename,
        contentType: fileMetadata.contentType,
        size: fileMetadata.size,
        metadata: {
          path: relativeUrl,
          extension: fileMetadata.extension,
          originalFilename: fileMetadata.filename,
          title: fileMetadata.title,
          alt: fileMetadata.alt,
          author: fileMetadata.author,
          credit: fileMetadata.credit,
          tags: fileMetadata.tags,
          imageVariants: fileMetadata.imageVariants ? 
            await this.updateVariantUrls(fileMetadata.imageVariants, fileMetadata.id) : 
            undefined,
          originalDimensions: fileMetadata.originalDimensions
        },
        _createdAt: fileMetadata.createdAt
      }

      return mediaFile
    } catch (error) {
      this.logger.error(`Failed to get file ${id}`, error)
      throw new Error(`Failed to get file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async updateFile(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    try {
      SecurityValidator.validateDocumentId(id)

      const metadataPath = this.getMediaMetadataPath(id)
      
      // Check if metadata file exists
      try {
        await fs.access(metadataPath, constants.F_OK)
      } catch {
        throw new Error(`Media file ${id} not found`)
      }

      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const fileMetadata: FileMetadata = this.safeParseJSON<FileMetadata>(metadataContent)

      // Update metadata
      const updatedMetadata: FileMetadata = {
        ...fileMetadata,
        ...metadata,
        id: fileMetadata.id, // Ensure ID cannot be changed
        updatedAt: new Date()
      }

      // Write updated metadata
      const jsonContent = this.formatJson(updatedMetadata)
      await this.atomicWriteFile(metadataPath, jsonContent)

      if (!this.config.silent) {
        this.logger.info('File metadata updated', { id })
      }

      // Return updated media file
      return (await this.getFile(id))!
    } catch (error) {
      this.logger.error(`Failed to update file ${id}`, error)
      throw error
    }
  }

  public async getFileContent(id: string): Promise<ArrayBuffer | null> {
    try {
      SecurityValidator.validateDocumentId(id)

      const mediaFile = await this.getFile(id)
      if (!mediaFile) {
        return null
      }

      const filePath = this.getMediaPath(id, mediaFile.metadata?.extension as string)
      
      try {
        const buffer = await fs.readFile(filePath)
        const sliced = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        // Ensure we return ArrayBuffer, not SharedArrayBuffer
        if (sliced instanceof ArrayBuffer) {
          return sliced
        } else {
          // Copy SharedArrayBuffer to ArrayBuffer
          const arrayBuffer = new ArrayBuffer(sliced.byteLength)
          new Uint8Array(arrayBuffer).set(new Uint8Array(sliced))
          return arrayBuffer
        }
      } catch {
        return null
      }
    } catch (error) {
      this.logger.error(`Failed to get file content for ${id}`, error)
      return null
    }
  }

  public async listMedia(options: MediaListOptions = {}): Promise<MediaFile[]> {
    try {
      // Check if media directory exists
      try {
        await fs.access(this.config.mediaDir, constants.F_OK)
      } catch {
        return []
      }

      const files = await fs.readdir(this.config.mediaDir)
      const metadataFiles = files.filter(file => file.endsWith('.meta.json'))

      const mediaFiles: MediaFile[] = []
      
      for (const metadataFile of metadataFiles) {
        try {
          const id = metadataFile.replace('.meta.json', '')
          const mediaFile = await this.getFile(id)
          if (mediaFile) {
            mediaFiles.push(mediaFile)
          }
        } catch (error) {
          this.logger.warn(`Skipping invalid metadata file ${metadataFile}`, error)
          continue
        }
      }

      // Apply filters
      let filteredFiles = mediaFiles

      if (options.contentType) {
        filteredFiles = filteredFiles.filter(file => 
          file.contentType.includes(options.contentType!)
        )
      }

      if (options.sizeRange) {
        filteredFiles = filteredFiles.filter(file => {
          const size = file.size
          if (options.sizeRange!.min && size < options.sizeRange!.min) return false
          if (options.sizeRange!.max && size > options.sizeRange!.max) return false
          return true
        })
      }

      if (options.dateRange) {
        filteredFiles = filteredFiles.filter(file => {
          const date = file._createdAt
          if (options.dateRange!.from && date < options.dateRange!.from) return false
          if (options.dateRange!.to && date > options.dateRange!.to) return false
          return true
        })
      }

      // Apply sorting
      if (options.sort) {
        this.sortMediaFiles(filteredFiles, options.sort, options.sortDirection)
      }

      // Apply pagination
      const { offset = 0, limit } = options
      const start = offset
      const end = limit ? start + limit : undefined

      return filteredFiles.slice(start, end)
    } catch (error) {
      this.logger.error('Failed to list media files', error)
      throw new Error(`Failed to list media: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async deleteFile(id: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(id)

      const mediaFile = await this.getFile(id)
      if (!mediaFile) {
        throw new Error(`Media file ${id} not found`)
      }

      const filePath = this.getMediaPath(id, mediaFile.metadata?.extension as string)
      const metadataPath = this.getMediaMetadataPath(id)

      // Delete variant files first
      await this.deleteVariantFiles(id)

      // Delete main file and metadata
      try {
        await fs.unlink(filePath)
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }

      try {
        await fs.unlink(metadataPath)
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }

      if (!this.config.silent) {
        this.logger.info('File deleted', { id })
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${id}`, error)
      throw error
    }
  }

  // ==========================================================================
  // VARIANT OPERATIONS
  // ==========================================================================

  public async saveVariantFile(parentId: string, variantName: string, buffer: Buffer, format: string): Promise<string> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      SecurityValidator.validateDocumentId(variantName)

      // Create variants directory if it doesn't exist
      const variantsDir = path.join(this.config.mediaDir, 'variants')
      await fsExtra.ensureDir(variantsDir, { mode: this.config.dirMode })

      // Create parent directory for this image's variants
      const parentVariantsDir = path.join(variantsDir, parentId)
      await fsExtra.ensureDir(parentVariantsDir, { mode: this.config.dirMode })

      // Save variant file
      const variantFilename = `${variantName}.${format}`
      const variantPath = path.join(parentVariantsDir, variantFilename)
      
      await fs.writeFile(variantPath, buffer, { mode: this.config.fileMode })
      
      if (!this.config.silent) {
        this.logger.info('Variant file saved', { parentId, variantName, format })
      }
      
      // Return relative path for URL generation
      return `variants/${parentId}/${variantFilename}`
    } catch (error) {
      this.logger.error(`Failed to save variant file ${parentId}/${variantName}`, error)
      throw error
    }
  }

  public async getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      SecurityValidator.validateDocumentId(variantName)

      // First check if the parent media file exists
      const mediaFile = await this.getFile(parentId)
      if (!mediaFile) {
        return null
      }

      // Get variant info from metadata to determine format
      const variants = mediaFile.metadata?.imageVariants as Record<string, any>
      if (!variants || !variants[variantName]) {
        return null
      }

      const variantInfo = variants[variantName]
      const variantFilename = `${variantName}.${variantInfo.format || 'webp'}`
      const variantPath = path.join(this.config.mediaDir, 'variants', parentId, variantFilename)

      // Security check: ensure the resolved path is still within the media directory
      const resolvedPath = path.resolve(variantPath)
      const mediaBaseDir = path.resolve(this.config.mediaDir)
      if (!resolvedPath.startsWith(mediaBaseDir)) {
        throw new Error('Access denied: path traversal detected')
      }

      // Check if variant file exists
      try {
        await fs.access(resolvedPath, constants.F_OK)
        const stats = await fs.stat(resolvedPath)
        if (!stats.isFile()) {
          return null
        }
      } catch {
        return null
      }

      // Read and return variant file content
      const buffer = await fs.readFile(resolvedPath)
      const sliced = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      // Ensure we return ArrayBuffer, not SharedArrayBuffer
      if (sliced instanceof ArrayBuffer) {
        return sliced
      } else {
        // Copy SharedArrayBuffer to ArrayBuffer
        const arrayBuffer = new ArrayBuffer(sliced.byteLength)
        new Uint8Array(arrayBuffer).set(new Uint8Array(sliced))
        return arrayBuffer
      }
    } catch (error) {
      this.logger.error(`Failed to get variant content for ${parentId}/${variantName}`, error)
      return null
    }
  }

  public async deleteVariantFiles(parentId: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(parentId)

      const parentVariantsDir = path.join(this.config.mediaDir, 'variants', parentId)
      
      // Check if directory exists before trying to delete
      try {
        await fs.access(parentVariantsDir, constants.F_OK)
        await fs.rm(parentVariantsDir, { recursive: true, force: true })
        
        if (!this.config.silent) {
          this.logger.info('Variant files deleted', { parentId })
        }
      } catch {
        // Directory doesn't exist, nothing to delete
      }
    } catch (error) {
      this.logger.error(`Failed to delete variant files for ${parentId}`, error)
      throw error
    }
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  public async healthCheck(): Promise<boolean> {
    try {
      // Test directory access
      await fs.access(this.config.mediaDir, constants.R_OK | constants.W_OK)
      return true
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  private getMediaPath(id: string, extension: string): string {
    SecurityValidator.validateDocumentId(id)
    // Basic validation for extension (no need for full document ID validation)
    if (!extension || typeof extension !== 'string' || extension.length > 10) {
      throw new InvalidInputError('Invalid file extension', 'extension')
    }
    
    return path.join(this.config.mediaDir, `${id}.${extension}`)
  }

  private getMediaMetadataPath(id: string): string {
    SecurityValidator.validateDocumentId(id)
    
    return path.join(this.config.mediaDir, `${id}.meta.json`)
  }

  private validateMediaMetadata(metadata: MediaMetadata): void {
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new InvalidInputError('Media metadata must have a valid ID', 'id')
    }
    
    if (!metadata.filename || typeof metadata.filename !== 'string') {
      throw new InvalidInputError('Media metadata must have a valid filename', 'filename')
    }
    
    if (!metadata.contentType || typeof metadata.contentType !== 'string') {
      throw new InvalidInputError('Media metadata must have a valid content type', 'contentType')
    }
    
    if (!metadata.extension || typeof metadata.extension !== 'string') {
      throw new InvalidInputError('Media metadata must have a valid extension', 'extension')
    }
    
    if (typeof metadata.size !== 'number' || metadata.size <= 0) {
      throw new InvalidInputError('Media metadata must have a valid size', 'size')
    }
  }

  private formatJson(data: any): string {
    if (this.config.prettyJson) {
      return JSON.stringify(data, this.dateReplacer, this.config.jsonSpaces)
    }
    return JSON.stringify(data, this.dateReplacer)
  }

  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return value.toISOString()
    }
    return value
  }

  private dateReviver(key: string, value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
      return new Date(value)
    }
    return value
  }

  private safeParseJSON<T>(content: string): T {
    try {
      return JSON.parse(content, this.dateReviver)
    } catch (error) {
      throw new Error(`Invalid JSON content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async atomicWriteFile(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`
    
    try {
      await fs.writeFile(tempPath, content, { 
        mode: this.config.fileMode,
        encoding: 'utf8'
      })
      
      if (this.config.syncWrites) {
        const fd = await fs.open(tempPath, 'r+')
        await fd.sync()
        await fd.close()
      }
      
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
      throw error
    }
  }

  private async fileToBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await file.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  public async getVariantUrl(parentId: string, variantName: string): Promise<string | null> {
    try {
      SecurityValidator.validateDocumentId(parentId)
      SecurityValidator.validateDocumentId(variantName)
      
      if (this.config.mediaBaseUrl) {
        return `${this.config.mediaBaseUrl}/api/media/${parentId}/variants/${variantName}`
      }
      return `file://${path.resolve(this.config.mediaDir, 'variants', parentId, variantName)}`
    } catch (error) {
      this.logger.error(`Failed to get variant URL for ${parentId}/${variantName}`, error)
      return null
    }
  }

  private async updateVariantUrls(imageVariants: Record<string, any>, parentId: string): Promise<Record<string, any>> {
    const updatedVariants: Record<string, any> = {}
    for (const [variantName, variantData] of Object.entries(imageVariants)) {
      const url = await this.getVariantUrl(parentId, variantName)
      updatedVariants[variantName] = {
        ...variantData,
        url: url || variantData.url // Fall back to existing URL if generation fails
      }
    }
    return updatedVariants
  }

  private sortMediaFiles(files: MediaFile[], sortBy: string, direction: 'asc' | 'desc' = 'asc'): void {
    files.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'name':
          aValue = a.filename.toLowerCase()
          bValue = b.filename.toLowerCase()
          break
        case 'size':
          aValue = a.size
          bValue = b.size
          break
        case 'date':
          aValue = a._createdAt
          bValue = b._createdAt
          break
        case 'type':
          aValue = a.contentType
          bValue = b.contentType
          break
        default:
          return 0
      }

      let comparison = 0
      if (aValue < bValue) comparison = -1
      else if (aValue > bValue) comparison = 1

      return direction === 'desc' ? -comparison : comparison
    })
  }
}