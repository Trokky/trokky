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
  Migration,
  SecurityValidator,
  InvalidInputError,
  User,
  UserListOptions
} from '@trokky/core'
import { FilesystemAdapterConfig, FileMetadata, DocumentFile } from './types.js'

export class FilesystemAdapter implements StorageAdapter {
  private config: Required<Omit<FilesystemAdapterConfig, 'mediaBaseUrl'>> & { mediaBaseUrl?: string }
  
  // Security limits
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  private readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

  constructor(config: FilesystemAdapterConfig = {}) {
    this.config = {
      contentDir: config.contentDir || './content',
      mediaDir: config.mediaDir || './media',
      usersDir: config.usersDir || './users',
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
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fsExtra.ensureDir(this.config.contentDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.mediaDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.usersDir, { mode: this.config.dirMode })
      
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
      // Input validation is handled in getDocumentPath
      const filePath = this.getDocumentPath(collection, id)
      
      // Check if file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const documentFile: DocumentFile = this.safeParseJSON<DocumentFile>(content, this.dateReviver)

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
      // Validate document data
      SecurityValidator.validateDocumentData(data)
      
      // Check document size to prevent DoS attacks
      const dataSize = JSON.stringify(data).length
      if (dataSize > this.MAX_DOCUMENT_SIZE) {
        throw new InvalidInputError(`Document size ${dataSize} exceeds maximum allowed size of ${this.MAX_DOCUMENT_SIZE} bytes`, 'size')
      }
      
      // Input validation is handled in getDocumentPath
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

      // Write to file with Date serialization - use atomic write to prevent race conditions
      const jsonContent = this.config.prettyJson
        ? JSON.stringify(documentFile, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(documentFile, this.dateReplacer)

      await this.atomicWriteFile(filePath, jsonContent)

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
      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.sanitizeListOptions(options)
      
      // Apply resource limits
      const limit = Math.min(options.limit || 1000, 1000) // Cap at 1000 documents
      const offset = Math.max(options.offset || 0, 0)
      
      const collectionDir = path.join(this.config.contentDir, collection)
      this.validateSecurePath(collectionDir, this.config.contentDir)
      
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

      // Apply pagination with validated limits
      return documents.slice(offset, offset + limit)
    } catch (error) {
      throw new Error(`Failed to list documents in collection ${collection}: ${error}`)
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    try {
      // Input validation is handled in getDocumentPath
      const filePath = this.getDocumentPath(collection, id)
      
      // Atomic delete - check and delete in one operation
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Document ${collection}/${id} not found`)
      }
      throw new Error(`Failed to delete document ${collection}/${id}: ${error}`)
    }
  }

  // Media operations
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
      const metadataContent = this.config.prettyJson
        ? JSON.stringify(fileMetadata, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(fileMetadata, this.dateReplacer)

      await this.atomicWriteFile(metadataPath, metadataContent)

      // Generate file URL (relative path for portability)
      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      // Generate appropriate URL based on configuration
      const fileUrl = this.config.mediaBaseUrl 
        ? `${this.config.mediaBaseUrl}/${metadata.id}/file`
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

      return mediaFile
    } catch (error) {
      throw new Error(`Failed to upload file ${metadata.filename}: ${error}`)
    }
  }

  public async getFile(id: string): Promise<MediaFile | null> {
    try {
      // Input validation is handled in getMediaMetadataPath
      const metadataPath = this.getMediaMetadataPath(id)
      
      // Check if metadata file exists
      try {
        await fs.access(metadataPath, constants.F_OK)
      } catch {
        return null
      }

      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const fileMetadata: FileMetadata = this.safeParseJSON<FileMetadata>(metadataContent, this.dateReviver)

      const filePath = this.getMediaPath(id, fileMetadata.extension)
      
      // Check if actual file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        // Metadata exists but file is missing
        throw new Error(`Media file ${id} metadata found but file is missing`)
      }

      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      // Generate appropriate URL based on configuration
      const fileUrl = this.config.mediaBaseUrl 
        ? `${this.config.mediaBaseUrl}/${fileMetadata.id}/file`
        : `file://${path.resolve(filePath)}`

      const mediaFile: MediaFile = {
        id: fileMetadata.id,
        url: fileUrl,
        filename: fileMetadata.filename,
        contentType: fileMetadata.contentType,
        size: fileMetadata.size,
        metadata: {
          // Include basic file metadata
          path: relativeUrl,
          extension: fileMetadata.extension,
          originalFilename: fileMetadata.filename,
          // Include all user-editable metadata fields (include even if empty string)
          ...(fileMetadata.title !== undefined && { title: fileMetadata.title }),
          ...(fileMetadata.alt !== undefined && { alt: fileMetadata.alt }),
          ...(fileMetadata.author !== undefined && { author: fileMetadata.author }),
          ...(fileMetadata.credit !== undefined && { credit: fileMetadata.credit })
        },
        _createdAt: fileMetadata.createdAt instanceof Date ? fileMetadata.createdAt : new Date(fileMetadata.createdAt)
      }

      return mediaFile
    } catch (error) {
      throw new Error(`Failed to get file ${id}: ${error}`)
    }
  }

  public async updateFile(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    try {
      // Input validation
      SecurityValidator.validateDocumentId(id)
      
      const metadataPath = this.getMediaMetadataPath(id)
      
      // Check if metadata file exists
      try {
        await fs.access(metadataPath, constants.F_OK)
      } catch {
        throw new Error(`Media file ${id} not found`)
      }

      // Read existing metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const existingMetadata: FileMetadata = this.safeParseJSON<FileMetadata>(metadataContent, this.dateReviver)

      // Update metadata with new values
      const updatedMetadata: FileMetadata = {
        ...existingMetadata,
        ...metadata,
        updatedAt: new Date(),
        // Preserve core fields that shouldn't be changed
        id: existingMetadata.id,
        filename: existingMetadata.filename,
        contentType: existingMetadata.contentType,
        size: existingMetadata.size,
        extension: existingMetadata.extension,
        originalPath: existingMetadata.originalPath,
        createdAt: existingMetadata.createdAt
      }

      // Write updated metadata atomically
      const updatedMetadataContent = this.config.prettyJson
        ? JSON.stringify(updatedMetadata, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(updatedMetadata, this.dateReplacer)

      await this.atomicWriteFile(metadataPath, updatedMetadataContent)

      // Return updated MediaFile
      const filePath = this.getMediaPath(id, updatedMetadata.extension)
      const relativeUrl = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

      // Generate appropriate URL based on configuration
      const fileUrl = this.config.mediaBaseUrl 
        ? `${this.config.mediaBaseUrl}/${updatedMetadata.id}/file`
        : `file://${path.resolve(filePath)}`

      const mediaFile: MediaFile = {
        id: updatedMetadata.id,
        url: fileUrl,
        filename: updatedMetadata.filename,
        contentType: updatedMetadata.contentType,
        size: updatedMetadata.size,
        metadata: {
          path: relativeUrl,
          extension: updatedMetadata.extension,
          originalFilename: updatedMetadata.filename,
          // Include custom metadata fields
          ...metadata
        },
        _createdAt: updatedMetadata.createdAt instanceof Date ? updatedMetadata.createdAt : new Date(updatedMetadata.createdAt)
      }

      console.log('[DEBUG] FilesystemAdapter.updateFile - Updated metadata successfully:', {
        id,
        updatedFields: Object.keys(metadata),
        filename: updatedMetadata.filename
      })

      return mediaFile
    } catch (error) {
      console.error('[ERROR] FilesystemAdapter.updateFile failed:', error)
      throw new Error(`Failed to update file metadata ${id}: ${error}`)
    }
  }

  public async getFileContent(id: string): Promise<ArrayBuffer | null> {
    try {
      // Input validation is handled in getMediaMetadataPath
      const metadataPath = this.getMediaMetadataPath(id)
      
      // Check if metadata file exists
      try {
        await fs.access(metadataPath, constants.F_OK)
      } catch {
        return null
      }

      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const fileMetadata: FileMetadata = this.safeParseJSON<FileMetadata>(metadataContent, this.dateReviver)

      const filePath = this.getMediaPath(id, fileMetadata.extension)
      
      // Check if actual file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      // Read file content as buffer and convert to ArrayBuffer
      const buffer = await fs.readFile(filePath)
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } catch (error) {
      throw new Error(`Failed to get file content ${id}: ${error}`)
    }
  }

  public async deleteFile(id: string): Promise<void> {
    try {
      // Input validation is handled in getMediaMetadataPath
      const metadataPath = this.getMediaMetadataPath(id)
      
      // Read metadata to get file extension
      let extension = ''
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        const fileMetadata: FileMetadata = this.safeParseJSON<FileMetadata>(metadataContent, this.dateReviver)
        extension = fileMetadata.extension
      } catch {
        throw new Error(`Media file ${id} not found`)
      }

      const filePath = this.getMediaPath(id, extension)

      // Delete both the file and metadata
      await Promise.all([
        fs.unlink(filePath).catch(() => {}), // Don't fail if file is already missing
        fs.unlink(metadataPath).catch(() => {}) // Don't fail if metadata is already missing
      ])
    } catch (error) {
      throw new Error(`Failed to delete file ${id}: ${error}`)
    }
  }

  public async listMedia(options: ListOptions = {}): Promise<MediaFile[]> {
    try {
      // Apply resource limits
      const limit = Math.min(options.limit || 1000, 1000)
      const offset = Math.max(options.offset || 0, 0)
      
      const metadataDir = path.join(this.config.mediaDir, '.metadata')
      
      console.log('[DEBUG] FilesystemAdapter.listMedia - checking metadata dir:', metadataDir)
      
      // Check if metadata directory exists
      try {
        await fs.access(metadataDir, constants.F_OK)
        console.log('[DEBUG] Metadata directory exists')
      } catch (error) {
        console.log('[DEBUG] Metadata directory does not exist:', error)
        return []
      }

      const files = await fs.readdir(metadataDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      
      console.log('[DEBUG] Found metadata files:', jsonFiles)

      let mediaFiles: MediaFile[] = []

      // Read all media metadata files
      for (const file of jsonFiles) {
        const id = path.basename(file, '.json')
        console.log('[DEBUG] Processing media file:', id)
        try {
          const mediaFile = await this.getFile(id)
          if (mediaFile) {
            console.log('[DEBUG] Successfully loaded media file:', { id: mediaFile.id, filename: mediaFile.filename })
            mediaFiles.push(mediaFile)
          }
        } catch (error) {
          // Skip corrupted files but log the error
          console.error(`[ERROR] Failed to load media file ${id}:`, error)
        }
      }

      console.log('[DEBUG] Total loaded media files:', mediaFiles.length)

      // Sort by creation date (newest first)
      mediaFiles.sort((a, b) => new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime())

      // Apply pagination
      const result = mediaFiles.slice(offset, offset + limit)
      console.log('[DEBUG] Returning media files after pagination:', result.length)
      
      return result
    } catch (error) {
      console.error('[ERROR] FilesystemAdapter.listMedia failed:', error)
      throw new Error(`Failed to list media files: ${error}`)
    }
  }

  // User operations (system entities, stored separately from content)
  public async getUser(id: string): Promise<User | null> {
    try {
      const filePath = this.getUserPath(id)
      
      // Check if file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const user: User = this.safeParseJSON<User>(content, this.dateReviver)
      return user
    } catch (error) {
      throw new Error(`Failed to read user ${id}: ${error}`)
    }
  }

  public async saveUser(id: string, userData: Partial<User>): Promise<User> {
    try {
      const filePath = this.getUserPath(id)
      const userDir = path.dirname(filePath)

      // Ensure users directory exists
      await fsExtra.ensureDir(userDir, { mode: this.config.dirMode })

      // Check if user already exists
      let existingUser: User | null = null
      try {
        existingUser = await this.getUser(id)
      } catch {
        // User doesn't exist, this is a new user
      }

      const now = new Date().toISOString()
      const isUpdate = existingUser !== null

      const user: User = {
        id,
        username: userData.username || existingUser?.username || '',
        email: userData.email || existingUser?.email || '',
        passwordHash: userData.passwordHash || existingUser?.passwordHash || '',
        firstName: userData.firstName || existingUser?.firstName || '',
        lastName: userData.lastName || existingUser?.lastName || '',
        role: userData.role || existingUser?.role || 'viewer',
        permissions: userData.permissions || existingUser?.permissions || ['read'],
        isActive: userData.isActive ?? existingUser?.isActive ?? true,
        profileImage: userData.profileImage || existingUser?.profileImage,
        preferences: userData.preferences || existingUser?.preferences || {},
        lastLoginAt: userData.lastLoginAt || existingUser?.lastLoginAt,
        createdAt: existingUser?.createdAt || now,
        updatedAt: now
      }

      // Write to file atomically
      const jsonContent = this.config.prettyJson
        ? JSON.stringify(user, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(user, this.dateReplacer)

      await this.atomicWriteFile(filePath, jsonContent)

      if (this.config.syncWrites) {
        // Force sync to disk
        const fileHandle = await fs.open(filePath, 'r+')
        await fileHandle.sync()
        await fileHandle.close()
      }

      return user
    } catch (error) {
      throw new Error(`Failed to save user ${id}: ${error}`)
    }
  }

  public async listUsers(options: UserListOptions = {}): Promise<User[]> {
    try {
      // Apply resource limits
      const limit = Math.min(options.limit || 1000, 1000)
      const offset = Math.max(options.offset || 0, 0)
      
      // Check if users directory exists
      try {
        await fs.access(this.config.usersDir, constants.F_OK)
      } catch {
        return []
      }

      const files = await fs.readdir(this.config.usersDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      let users: User[] = []

      // Read all users
      for (const file of jsonFiles) {
        const id = path.basename(file, '.json')
        try {
          const user = await this.getUser(id)
          if (user) {
            users.push(user)
          }
        } catch (error) {
          // Skip corrupted files but log the error
          if (!this.config.silent) {
            console.warn(`Skipping corrupted user ${id}: ${error}`)
          }
        }
      }

      // Apply filtering
      if (options.role) {
        users = users.filter(user => user.role === options.role)
      }
      if (options.isActive !== undefined) {
        users = users.filter(user => user.isActive === options.isActive)
      }

      // Sort by creation date (newest first)
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Apply pagination
      return users.slice(offset, offset + limit)
    } catch (error) {
      throw new Error(`Failed to list users: ${error}`)
    }
  }

  public async deleteUser(id: string): Promise<void> {
    try {
      const filePath = this.getUserPath(id)
      
      // Atomic delete
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`User ${id} not found`)
      }
      throw new Error(`Failed to delete user ${id}: ${error}`)
    }
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    try {
      const users = await this.listUsers()
      return users.find(user => user.username === username) || null
    } catch (error) {
      throw new Error(`Failed to get user by username ${username}: ${error}`)
    }
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.listUsers()
      return users.find(user => user.email === email) || null
    } catch (error) {
      throw new Error(`Failed to get user by email ${email}: ${error}`)
    }
  }

  // Utility operations
  public async healthCheck(): Promise<boolean> {
    try {
      // Ensure directories exist first
      await fsExtra.ensureDir(this.config.contentDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.mediaDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.usersDir, { mode: this.config.dirMode })
      
      // Check if directories are accessible
      await fs.access(this.config.contentDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.mediaDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.usersDir, constants.R_OK | constants.W_OK)
      
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
    // Validate inputs for security
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)
    
    const documentPath = path.join(this.config.contentDir, collection, `${id}.json`)
    this.validateSecurePath(documentPath, this.config.contentDir)
    
    return documentPath
  }

  private getMediaPath(id: string, extension: string): string {
    // Validate inputs
    SecurityValidator.validateDocumentId(id)
    this.validateFileExtension(extension)
    
    const mediaPath = path.join(this.config.mediaDir, `${id}.${extension}`)
    this.validateSecurePath(mediaPath, this.config.mediaDir)
    
    return mediaPath
  }

  private getMediaMetadataPath(id: string): string {
    // Validate inputs
    SecurityValidator.validateDocumentId(id)
    
    const metadataPath = path.join(this.config.mediaDir, '.metadata', `${id}.json`)
    this.validateSecurePath(metadataPath, this.config.mediaDir)
    
    return metadataPath
  }

  private getUserPath(id: string): string {
    // Validate inputs
    SecurityValidator.validateDocumentId(id)
    
    const userPath = path.join(this.config.usersDir, `${id}.json`)
    this.validateSecurePath(userPath, this.config.usersDir)
    
    return userPath
  }

  private validateSecurePath(targetPath: string, basePath: string): void {
    const resolvedTarget = path.resolve(targetPath)
    const resolvedBase = path.resolve(basePath)
    
    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      throw new InvalidInputError('Path traversal attempt detected', 'path')
    }
  }

  private validateFileExtension(extension: string): void {
    // Basic extension validation - prevent executable extensions and dangerous files
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'vbe', 'js', 'jse',
      'wsf', 'wsh', 'msi', 'msp', 'mst', 'reg', 'scf', 'lnk', 'inf',
      'php', 'php3', 'php4', 'php5', 'phtml', 'pl', 'py', 'rb', 'sh'
    ]
    
    const cleanExt = extension.toLowerCase().replace(/^\./, '')
    
    if (dangerousExtensions.includes(cleanExt)) {
      throw new InvalidInputError(`File extension '${extension}' is not allowed for security reasons`, 'extension')
    }
    
    // Ensure extension is alphanumeric with some common safe characters
    if (!/^[a-z0-9_-]+$/i.test(cleanExt)) {
      throw new InvalidInputError(`Invalid file extension format: ${extension}`, 'extension')
    }
  }

  private validateMediaMetadata(metadata: MediaMetadata): void {
    // Validate required fields
    if (!metadata.id || !metadata.filename || !metadata.contentType || !metadata.extension) {
      throw new InvalidInputError('Missing required metadata fields', 'metadata')
    }

    // Validate file size
    if (metadata.size > this.MAX_FILE_SIZE) {
      throw new InvalidInputError(`File size ${metadata.size} exceeds maximum allowed size of ${this.MAX_FILE_SIZE} bytes`, 'size')
    }

    // Validate filename format
    if (!/^[a-zA-Z0-9._-]+$/.test(metadata.filename)) {
      throw new InvalidInputError('Invalid filename format. Only alphanumeric characters, dots, underscores, and hyphens are allowed', 'filename')
    }

    // Validate content type format
    if (!/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/.test(metadata.contentType)) {
      throw new InvalidInputError('Invalid content type format', 'contentType')
    }
  }

  private safeParseJSON<T>(content: string, reviver?: (key: string, value: any) => any): T {
    // Check content size to prevent DoS attacks
    if (content.length > this.MAX_DOCUMENT_SIZE) {
      throw new InvalidInputError(`JSON content size ${content.length} exceeds maximum allowed size of ${this.MAX_DOCUMENT_SIZE} bytes`, 'size')
    }

    try {
      return JSON.parse(content, reviver)
    } catch (error) {
      throw new InvalidInputError(`Invalid JSON format: ${error}`, 'json')
    }
  }

  private async atomicWriteFile(filePath: string, content: string): Promise<void> {
    // Write to temporary file first, then rename to prevent race conditions
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`
    
    try {
      await fs.writeFile(tempPath, content, {
        mode: this.config.fileMode,
        flag: 'wx' // Fail if file exists
      })
      
      // Atomic rename
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
      throw error
    }
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