import { promises as fs, constants } from 'fs'
import * as fsExtra from 'fs-extra'
import * as path from 'path'
import {
  StorageAdapter,
  Document,
  DocumentData,
  ListOptions,
  MediaFile,
  MediaMetadata,
  Migration
} from '@trokky/core'
import { FilesystemAdapterConfig, FileMetadata, DocumentFile } from './types.js'

export class FilesystemAdapter implements StorageAdapter {
  private config: Required<FilesystemAdapterConfig>

  constructor(config: FilesystemAdapterConfig = {}) {
    this.config = {
      contentDir: config.contentDir || './content',
      mediaDir: config.mediaDir || './media',
      createDirs: config.createDirs ?? true,
      prettyJson: config.prettyJson ?? true,
      jsonSpaces: config.jsonSpaces ?? 2,
      syncWrites: config.syncWrites ?? false,
      fileMode: config.fileMode ?? 0o644,
      dirMode: config.dirMode ?? 0o755,
      silent: config.silent ?? false
    }

    // Initialize directories
    if (this.config.createDirs) {
      this.initializeDirectories()
    }
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fsExtra.ensureDir(this.config.contentDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.mediaDir, { mode: this.config.dirMode })
      
      // Create metadata directory for media files
      const mediaMetadataDir = path.join(this.config.mediaDir, '.metadata')
      await fsExtra.ensureDir(mediaMetadataDir, { mode: this.config.dirMode })
    } catch (error) {
      // Don't throw on directory creation failure during initialization
      // Let individual operations handle their own directory creation
      if (!this.config.silent) {
        console.warn(`Warning: Failed to initialize directories: ${error}`)
      }
    }
  }

  // Document operations
  public async getDocument(collection: string, id: string): Promise<Document | null> {
    try {
      const filePath = this.getDocumentPath(collection, id)
      
      // Check if file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const documentFile: DocumentFile = JSON.parse(content, this.dateReviver)

      // Convert stored data back to Document format
      const document: Document = {
        id: documentFile.id,
        ...documentFile.data,
        _collection: documentFile.collection,
        _createdAt: documentFile.metadata.createdAt instanceof Date ? documentFile.metadata.createdAt : new Date(documentFile.metadata.createdAt),
        _updatedAt: documentFile.metadata.updatedAt instanceof Date ? documentFile.metadata.updatedAt : new Date(documentFile.metadata.updatedAt),
        _revision: documentFile.metadata.revision,
        _status: documentFile.metadata.status
      }

      return document
    } catch (error) {
      throw new Error(`Failed to read document ${collection}/${id}: ${error}`)
    }
  }

  public async saveDocument(collection: string, id: string, data: DocumentData): Promise<Document> {
    try {
      const filePath = this.getDocumentPath(collection, id)
      const collectionDir = path.dirname(filePath)

      // Ensure collection directory exists
      await fsExtra.ensureDir(collectionDir, { mode: this.config.dirMode })

      // Check if document already exists to determine if it's an update
      let existingDoc: Document | null = null
      try {
        existingDoc = await this.getDocument(collection, id)
      } catch {
        // Document doesn't exist, this is a new document
      }

      const now = new Date()
      const isUpdate = existingDoc !== null

      const documentFile: DocumentFile = {
        id,
        collection,
        data: { ...data },
        metadata: {
          createdAt: isUpdate ? existingDoc!._createdAt : now,
          updatedAt: now,
          revision: isUpdate ? (existingDoc!._revision || 0) + 1 : 1,
          status: existingDoc?._status
        }
      }

      // Write to file with Date serialization
      const jsonContent = this.config.prettyJson
        ? JSON.stringify(documentFile, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(documentFile, this.dateReplacer)

      await fs.writeFile(filePath, jsonContent, { 
        mode: this.config.fileMode,
        flag: 'w'
      })

      if (this.config.syncWrites) {
        // Force sync to disk
        const fileHandle = await fs.open(filePath, 'r+')
        await fileHandle.sync()
        await fileHandle.close()
      }

      // Return the document in the expected format
      const document: Document = {
        id,
        ...data,
        _collection: collection,
        _createdAt: documentFile.metadata.createdAt,
        _updatedAt: documentFile.metadata.updatedAt,
        _revision: documentFile.metadata.revision,
        _status: documentFile.metadata.status
      }

      return document
    } catch (error) {
      throw new Error(`Failed to save document ${collection}/${id}: ${error}`)
    }
  }

  public async listDocuments(collection: string, options: ListOptions = {}): Promise<Document[]> {
    try {
      const collectionDir = path.join(this.config.contentDir, collection)
      
      // Check if collection directory exists
      try {
        await fs.access(collectionDir, constants.F_OK)
      } catch {
        return []
      }

      const files = await fs.readdir(collectionDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      let documents: Document[] = []

      // Read all documents
      for (const file of jsonFiles) {
        const id = path.basename(file, '.json')
        try {
          const doc = await this.getDocument(collection, id)
          if (doc) {
            documents.push(doc)
          }
        } catch (error) {
          // Skip corrupted files but log the error
          if (!this.config.silent) {
            console.warn(`Skipping corrupted document ${collection}/${id}: ${error}`)
          }
        }
      }

      // Apply filtering
      if (options.filter) {
        documents = documents.filter(doc => this.matchesFilter(doc, options.filter!))
      }

      // Apply sorting
      if (options.sort) {
        const sortFields = Array.isArray(options.sort) ? options.sort : [options.sort]
        documents = this.sortDocuments(documents, sortFields)
      }

      // Apply pagination
      const offset = options.offset || 0
      const limit = options.limit || documents.length
      
      return documents.slice(offset, offset + limit)
    } catch (error) {
      throw new Error(`Failed to list documents in collection ${collection}: ${error}`)
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    try {
      const filePath = this.getDocumentPath(collection, id)
      
      // Check if file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        throw new Error(`Document ${collection}/${id} not found`)
      }

      await fs.unlink(filePath)
    } catch (error) {
      throw new Error(`Failed to delete document ${collection}/${id}: ${error}`)
    }
  }

  // Media operations
  public async uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile> {
    try {
      const filename = `${metadata.id}.${metadata.extension}`
      const filePath = path.join(this.config.mediaDir, filename)
      const metadataPath = path.join(this.config.mediaDir, '.metadata', `${metadata.id}.json`)

      // Ensure media directory exists
      await fsExtra.ensureDir(path.dirname(filePath), { mode: this.config.dirMode })
      await fsExtra.ensureDir(path.dirname(metadataPath), { mode: this.config.dirMode })

      // Write file content
      const buffer = await this.fileToBuffer(file)
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

      // Write metadata
      const metadataContent = this.config.prettyJson
        ? JSON.stringify(fileMetadata, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(fileMetadata, this.dateReplacer)

      await fs.writeFile(metadataPath, metadataContent, { mode: this.config.fileMode })

      // Generate file URL (relative path for portability)
      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      const mediaFile: MediaFile = {
        id: metadata.id,
        url: `file://${path.resolve(filePath)}`,
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

      return mediaFile
    } catch (error) {
      throw new Error(`Failed to upload file ${metadata.filename}: ${error}`)
    }
  }

  public async getFile(id: string): Promise<MediaFile | null> {
    try {
      const metadataPath = path.join(this.config.mediaDir, '.metadata', `${id}.json`)
      
      // Check if metadata file exists
      try {
        await fs.access(metadataPath, constants.F_OK)
      } catch {
        return null
      }

      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const fileMetadata: FileMetadata = JSON.parse(metadataContent, this.dateReviver)

      const filePath = path.join(this.config.mediaDir, `${id}.${fileMetadata.extension}`)
      
      // Check if actual file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        // Metadata exists but file is missing
        throw new Error(`Media file ${id} metadata found but file is missing`)
      }

      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      const mediaFile: MediaFile = {
        id: fileMetadata.id,
        url: `file://${path.resolve(filePath)}`,
        filename: fileMetadata.filename,
        contentType: fileMetadata.contentType,
        size: fileMetadata.size,
        metadata: {
          path: relativeUrl,
          extension: fileMetadata.extension,
          originalFilename: fileMetadata.filename
        },
        _createdAt: fileMetadata.createdAt
      }

      return mediaFile
    } catch (error) {
      throw new Error(`Failed to get file ${id}: ${error}`)
    }
  }

  public async deleteFile(id: string): Promise<void> {
    try {
      const metadataPath = path.join(this.config.mediaDir, '.metadata', `${id}.json`)
      
      // Read metadata to get file extension
      let extension = ''
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        const fileMetadata: FileMetadata = JSON.parse(metadataContent, this.dateReviver)
        extension = fileMetadata.extension
      } catch {
        throw new Error(`Media file ${id} not found`)
      }

      const filePath = path.join(this.config.mediaDir, `${id}.${extension}`)

      // Delete both the file and metadata
      await Promise.all([
        fs.unlink(filePath).catch(() => {}), // Don't fail if file is already missing
        fs.unlink(metadataPath).catch(() => {}) // Don't fail if metadata is already missing
      ])
    } catch (error) {
      throw new Error(`Failed to delete file ${id}: ${error}`)
    }
  }

  // Utility operations
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if directories are accessible
      await fs.access(this.config.contentDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.mediaDir, constants.R_OK | constants.W_OK)
      
      // Try to write a test file
      const testFile = path.join(this.config.contentDir, '.health-check')
      await fs.writeFile(testFile, 'test')
      await fs.unlink(testFile)
      
      return true
    } catch {
      return false
    }
  }

  public async migrate(migrations: Migration[]): Promise<void> {
    // For filesystem adapter, migrations might involve reorganizing file structure
    // This is a placeholder - actual migration logic would depend on specific needs
    const migrationLogPath = path.join(this.config.contentDir, '.migrations.json')
    
    let appliedMigrations: string[] = []
    try {
      const logContent = await fs.readFile(migrationLogPath, 'utf-8')
      appliedMigrations = JSON.parse(logContent)
    } catch {
      // No migration log exists yet
    }

    for (const migration of migrations) {
      if (!appliedMigrations.includes(migration.version)) {
        try {
          await migration.up()
          appliedMigrations.push(migration.version)
          
          // Update migration log
          await fs.writeFile(migrationLogPath, JSON.stringify(appliedMigrations, null, 2))
        } catch (error) {
          // Rollback on failure
          try {
            await migration.down()
          } catch (rollbackError) {
            throw new Error(`Migration ${migration.version} failed and rollback failed: ${error}, rollback: ${rollbackError}`)
          }
          throw new Error(`Migration ${migration.version} failed: ${error}`)
        }
      }
    }
  }

  // Private helper methods
  private getDocumentPath(collection: string, id: string): string {
    return path.join(this.config.contentDir, collection, `${id}.json`)
  }

  private dateReplacer = (key: string, value: any): any => {
    // Convert Date objects to ISO strings
    if (value instanceof Date) {
      return value.toISOString()
    }
    return value
  }

  private dateReviver = (key: string, value: any): any => {
    // Convert ISO date strings back to Date objects
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
      return new Date(value)
    }
    return value
  }

  private reviveDatesInObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.reviveDatesInObject(item))
    }

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
        // console.log(`Converting date string ${value} to Date object`)
        result[key] = new Date(value)
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.reviveDatesInObject(value)
      } else {
        result[key] = value
      }
    }
    return result
  }

  private async fileToBuffer(file: File): Promise<Buffer> {
    // Convert File to Buffer for Node.js filesystem
    const arrayBuffer = await file.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private matchesFilter(document: Document, filter: Record<string, unknown>): boolean {
    for (const [field, value] of Object.entries(filter)) {
      const docValue = (document as any)[field]
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle comparison operators
        for (const [op, compareValue] of Object.entries(value as Record<string, unknown>)) {
          switch (op) {
            case '$eq':
              if (docValue !== compareValue) return false
              break
            case '$ne':
              if (docValue === compareValue) return false
              break
            case '$gt':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue <= compareValue) return false
              break
            case '$gte':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue < compareValue) return false
              break
            case '$lt':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue >= compareValue) return false
              break
            case '$lte':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue > compareValue) return false
              break
            case '$in':
              if (!Array.isArray(compareValue) || !compareValue.includes(docValue)) return false
              break
            case '$nin':
              if (!Array.isArray(compareValue) || compareValue.includes(docValue)) return false
              break
            default:
              // Unknown operator, skip
              break
          }
        }
      } else {
        // Direct value comparison
        if (docValue !== value) return false
      }
    }
    
    return true
  }

  private sortDocuments(documents: Document[], sortFields: string[]): Document[] {
    return documents.sort((a, b) => {
      for (const sortField of sortFields) {
        const [field, direction = 'asc'] = sortField.split('.')
        const aValue = (a as any)[field]
        const bValue = (b as any)[field]
        
        let comparison = 0
        if (aValue < bValue) comparison = -1
        else if (aValue > bValue) comparison = 1
        
        if (direction === 'desc') comparison *= -1
        
        if (comparison !== 0) return comparison
      }
      
      return 0
    })
  }
}