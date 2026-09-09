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
  MediaListResult,
  Migration,
  SecurityValidator,
  InvalidInputError,
  User,
  UserListOptions,
  AppToken,
  AppTokenListOptions,
  WebhookConfig,
  WebhookListOptions,
  AuditContext,
  AuditActorType
} from '../../core/index.js'
import { FilesystemAdapterConfig, FileMetadata, DocumentFile } from './types.js'

/**
 * @deprecated FilesystemAdapter is deprecated. Use the split storage architecture instead:
 * 
 * ```ts
 * // Old way (deprecated)
 * const adapter = new FilesystemAdapter({ contentDir: './content', mediaDir: './media' })
 * 
 * // New way (recommended)
 * const trokky = await TrokkyExpress.create({
 *   storage: {
 *     data: { adapter: 'filesystem-data', options: { contentDir: './data/content' } },
 *     media: { adapter: 'filesystem-media', options: { mediaDir: './data/media' } }
 *   }
 * })
 * ```
 * 
 * This provides better separation of concerns, improved scalability, and clearer configuration.
 * See migration guide in docs for more details.
 */
export class FilesystemAdapter implements StorageAdapter {
  private config: Required<Omit<FilesystemAdapterConfig, 'mediaBaseUrl' | 'tokensDir' | 'webhooksDir'>> & { 
    mediaBaseUrl?: string; 
    tokensDir: string;
    webhooksDir: string;
  }
  
  // Security limits
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  private readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

  constructor(config: FilesystemAdapterConfig = {}) {
    // Show deprecation warning
    if (!config.silent) {
      console.warn(
        '⚠️  [DEPRECATED] FilesystemAdapter is deprecated. Please migrate to the split storage architecture:\n' +
        '   Use TrokkyExpress.create() with storage.data and storage.media adapters.\n' +
        '   See migration guide: https://docs.trokky.dev/migration/split-storage'
      )
    }
    
    this.config = {
      contentDir: config.contentDir || './content',
      mediaDir: config.mediaDir || './media',
      usersDir: config.usersDir || './users',
      tokensDir: config.tokensDir || './tokens',
      webhooksDir: config.webhooksDir || './webhooks',
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
      await fsExtra.ensureDir(this.config.webhooksDir, { mode: this.config.dirMode })
      
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
        _id: documentFile.id,
        ...documentFile.data,
        _collection: documentFile.collection,
        _createdAt: documentFile.metadata.createdAt instanceof Date ? documentFile.metadata.createdAt : new Date(documentFile.metadata.createdAt),
        _updatedAt: documentFile.metadata.updatedAt instanceof Date ? documentFile.metadata.updatedAt : new Date(documentFile.metadata.updatedAt),
        _revision: documentFile.metadata.revision,
        _status: documentFile.metadata.status,
        _createdBy: documentFile.metadata.createdBy,
        _updatedBy: documentFile.metadata.updatedBy,
        _createdByType: documentFile.metadata.createdByType as AuditActorType | undefined,
        _updatedByType: documentFile.metadata.updatedByType as AuditActorType | undefined
      }

      return document
    } catch (error) {
      throw new Error(`Failed to read document ${collection}/${id}: ${error}`)
    }
  }

  public async saveDocument(collection: string, id: string, data: DocumentData, auditContext?: AuditContext): Promise<Document> {
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
          status: existingDoc?._status,
          // Add audit metadata
          createdBy: isUpdate ? existingDoc!._createdBy : auditContext?.userId,
          updatedBy: auditContext?.userId,
          createdByType: isUpdate ? existingDoc!._createdByType : auditContext?.userType,
          updatedByType: auditContext?.userType
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
        _id: id,
        ...data,
        _collection: collection,
        _createdAt: documentFile.metadata.createdAt,
        _updatedAt: documentFile.metadata.updatedAt,
        _revision: documentFile.metadata.revision,
        _status: documentFile.metadata.status,
        _createdBy: documentFile.metadata.createdBy,
        _updatedBy: documentFile.metadata.updatedBy,
        _createdByType: documentFile.metadata.createdByType as AuditActorType | undefined,
        _updatedByType: documentFile.metadata.updatedByType as AuditActorType | undefined
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

      const mediaFile: MediaFile = {
        id: metadata.id,
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

      const mediaFile: MediaFile = {
        id: fileMetadata.id,
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
          ...(fileMetadata.credit !== undefined && { credit: fileMetadata.credit }),
          // Include image processing metadata with updated URLs
          ...(fileMetadata.imageVariants && { 
            imageVariants: this.updateVariantUrls(fileMetadata.imageVariants, fileMetadata.id) 
          }),
          ...(fileMetadata.originalDimensions && { originalDimensions: fileMetadata.originalDimensions })
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

      const mediaFile: MediaFile = {
        id: updatedMetadata.id,
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
      const sliced = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer | SharedArrayBuffer
      // Ensure we return ArrayBuffer, not SharedArrayBuffer
      if (sliced instanceof ArrayBuffer) {
        return sliced
      } else {
        // Copy SharedArrayBuffer to ArrayBuffer
        const sharedBuffer = sliced as SharedArrayBuffer
        const arrayBuffer = new ArrayBuffer(sharedBuffer.byteLength)
        new Uint8Array(arrayBuffer).set(new Uint8Array(sharedBuffer))
        return arrayBuffer
      }
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

      // Delete metadata FIRST, then main file
      // This ensures if file deletion fails, the file won't show up in listMedia()
      // since listMedia() uses metadata files as source of truth
      const unlinkWithErrorCheck = async (path: string) => {
        try {
          await fs.unlink(path)
        } catch (error: any) {
          // Only ignore "file not found" errors, throw everything else
          if (error.code !== 'ENOENT') {
            throw error
          }
        }
      }

      // Delete metadata first, then file
      await unlinkWithErrorCheck(metadataPath)
      await unlinkWithErrorCheck(filePath)
    } catch (error) {
      throw new Error(`Failed to delete file ${id}: ${error}`)
    }
  }

  public async listMedia(options: ListOptions = {}): Promise<MediaListResult> {
    try {
      // Apply resource limits
      const limit = Math.min(options.limit || 1000, 1000)
      const offset = Math.max(options.offset || 0, 0)

      const metadataDir = path.join(this.config.mediaDir, '.metadata')


      // Check if metadata directory exists
      try {
        await fs.access(metadataDir, constants.F_OK)
      } catch (error) {
        return { items: [], total: 0 }
      }

      const files = await fs.readdir(metadataDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))


      const mediaFiles: MediaFile[] = []

      // Read all media metadata files
      for (const file of jsonFiles) {
        const id = path.basename(file, '.json')
        try {
          const mediaFile = await this.getFile(id)
          if (mediaFile) {
            mediaFiles.push(mediaFile)
          }
        } catch (error) {
          // Skip corrupted files but log the error
          console.error(`[ERROR] Failed to load media file ${id}:`, error)
        }
      }


      // Sort by creation date (newest first)
      mediaFiles.sort((a, b) => new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime())

      // Store total before pagination
      const total = mediaFiles.length

      // Apply pagination
      const items = mediaFiles.slice(offset, offset + limit)

      return { items, total }
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
        permissions: userData.permissions || existingUser?.permissions || ['content:read'],
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

  public async getUserByOAuthProvider(provider: string, providerId: string): Promise<User | null> {
    if (!provider || !providerId) {
      return null
    }

    try {
      const users = await this.listUsers()
      return users.find(user =>
        user.oauthProviders?.some(p => p.provider === provider && p.providerId === providerId)
      ) || null
    } catch (error) {
      throw new Error(`Failed to get user by OAuth provider ${provider}:${providerId}: ${error}`)
    }
  }

  // App Token operations (system entities, stored separately from content)
  public async getAppToken(id: string): Promise<AppToken | null> {
    try {
      const filePath = this.getTokenPath(id)
      
      // Check if file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const token: AppToken = this.safeParseJSON<AppToken>(content, this.dateReviver)
      return token
    } catch (error) {
      throw new Error(`Failed to read app token ${id}: ${error}`)
    }
  }

  public async saveAppToken(id: string, tokenData: Partial<AppToken>): Promise<AppToken> {
    try {
      const filePath = this.getTokenPath(id)
      const tokenDir = path.dirname(filePath)

      // Ensure tokens directory exists
      await fsExtra.ensureDir(tokenDir, { mode: this.config.dirMode })

      // Check if token already exists
      let existingToken: AppToken | null = null
      try {
        existingToken = await this.getAppToken(id)
      } catch {
        // Token doesn't exist, this is a new token
      }

      const now = new Date().toISOString()
      const isUpdate = existingToken !== null

      const token: AppToken = {
        id,
        name: tokenData.name || existingToken?.name || '',
        description: tokenData.description || existingToken?.description,
        tokenHash: tokenData.tokenHash || existingToken?.tokenHash || '',
        permissions: tokenData.permissions || existingToken?.permissions || [],
        createdBy: tokenData.createdBy || existingToken?.createdBy || '',
        isActive: tokenData.isActive ?? existingToken?.isActive ?? true,
        lastUsedAt: tokenData.lastUsedAt || existingToken?.lastUsedAt,
        usageCount: tokenData.usageCount ?? existingToken?.usageCount ?? 0,
        expiresAt: tokenData.expiresAt || existingToken?.expiresAt,
        createdAt: existingToken?.createdAt || now,
        updatedAt: now
      }

      // Validate required fields
      if (!token.name) {
        throw new Error('Token name is required')
      }
      if (!token.tokenHash) {
        throw new Error('Token hash is required')
      }
      if (!token.createdBy) {
        throw new Error('Token createdBy is required')
      }

      // Write token to file
      const jsonContent = this.config.prettyJson
        ? JSON.stringify(token, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(token, this.dateReplacer)
      
      if (this.config.syncWrites) {
        await fs.writeFile(filePath, jsonContent, { mode: this.config.fileMode, flag: 'w' })
      } else {
        await fs.writeFile(filePath, jsonContent, { mode: this.config.fileMode })
      }

      return token
    } catch (error) {
      throw new Error(`Failed to save app token ${id}: ${error}`)
    }
  }

  public async listAppTokens(options: AppTokenListOptions = {}): Promise<AppToken[]> {
    try {
      const limit = Math.min(options.limit || 1000, 1000)
      const offset = Math.max(options.offset || 0, 0)
      
      // Ensure tokens directory exists
      await fsExtra.ensureDir(this.config.tokensDir, { mode: this.config.dirMode })
      
      let files: string[]
      try {
        files = await fs.readdir(this.config.tokensDir)
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return []
        }
        throw error
      }

      const jsonFiles = files.filter(file => file.endsWith('.json'))
      const tokens: AppToken[] = []

      for (const file of jsonFiles) {
        const id = path.basename(file, '.json')
        try {
          const token = await this.getAppToken(id)
          if (token) {
            tokens.push(token)
          }
        } catch (error) {
          // Skip corrupted files but log the error
          if (!this.config.silent) {
            console.warn(`Skipping corrupted app token ${id}: ${error}`)
          }
        }
      }

      // Apply filtering
      let filteredTokens = tokens
      if (options.createdBy) {
        filteredTokens = filteredTokens.filter(token => token.createdBy === options.createdBy)
      }
      if (options.isActive !== undefined) {
        filteredTokens = filteredTokens.filter(token => token.isActive === options.isActive)
      }

      // Sort by creation date (newest first)
      filteredTokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Apply pagination
      return filteredTokens.slice(offset, offset + limit)
    } catch (error) {
      throw new Error(`Failed to list app tokens: ${error}`)
    }
  }

  public async deleteAppToken(id: string): Promise<void> {
    try {
      const filePath = this.getTokenPath(id)
      
      // Atomic delete
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`App token ${id} not found`)
      }
      throw new Error(`Failed to delete app token ${id}: ${error}`)
    }
  }

  public async getAppTokenByHash(hash: string): Promise<AppToken | null> {
    try {
      const tokens = await this.listAppTokens()
      return tokens.find(token => token.tokenHash === hash) || null
    } catch (error) {
      throw new Error(`Failed to get app token by hash: ${error}`)
    }
  }

  // Webhook operations (system entities, stored separately from content)
  public async getWebhook(id: string): Promise<WebhookConfig | null> {
    try {
      const filePath = this.getWebhookPath(id)
      
      // Check if file exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const webhook: WebhookConfig = this.safeParseJSON<WebhookConfig>(content, this.dateReviver)

      return webhook
    } catch (error) {
      throw new Error(`Failed to read webhook ${id}: ${error}`)
    }
  }

  public async saveWebhook(id: string, webhookData: Partial<WebhookConfig>): Promise<WebhookConfig> {
    try {
      SecurityValidator.validateDocumentId(id)
      
      const filePath = this.getWebhookPath(id)
      const webhookDir = path.dirname(filePath)

      // Ensure webhook directory exists
      await fsExtra.ensureDir(webhookDir, { mode: this.config.dirMode })

      // Check if webhook already exists
      let existingWebhook: WebhookConfig | null = null
      try {
        existingWebhook = await this.getWebhook(id)
      } catch {
        // Webhook doesn't exist, this is a new webhook
      }

      const now = new Date()
      const isUpdate = existingWebhook !== null

      const webhook: WebhookConfig = {
        id,
        name: webhookData.name || existingWebhook?.name || 'Untitled Webhook',
        url: webhookData.url || existingWebhook?.url || '',
        events: webhookData.events || existingWebhook?.events || [],
        active: webhookData.active !== undefined ? webhookData.active : (existingWebhook?.active ?? true),
        secret: webhookData.secret || existingWebhook?.secret || crypto.randomUUID(),
        headers: webhookData.headers || existingWebhook?.headers || {},
        retryPolicy: webhookData.retryPolicy || existingWebhook?.retryPolicy || {
          maxRetries: 3,
          backoffType: 'exponential',
          baseDelay: 1000,
          maxDelay: 30000,
          retryOnStatus: [500, 502, 503, 504, 408, 429]
        },
        createdBy: webhookData.createdBy || existingWebhook?.createdBy || 'system',
        createdAt: isUpdate ? existingWebhook!.createdAt : now,
        updatedAt: now
      }

      // Write to file with Date serialization
      const jsonContent = this.config.prettyJson
        ? JSON.stringify(webhook, this.dateReplacer, this.config.jsonSpaces)
        : JSON.stringify(webhook, this.dateReplacer)

      await fs.writeFile(filePath, jsonContent, { mode: this.config.fileMode })

      if (this.config.syncWrites) {
        const fd = await fs.open(filePath, 'r+')
        await fd.sync()
        await fd.close()
      }

      return webhook
    } catch (error) {
      throw new Error(`Failed to save webhook ${id}: ${error}`)
    }
  }

  public async listWebhooks(options: WebhookListOptions = {}): Promise<WebhookConfig[]> {
    try {
      // Ensure webhooks directory exists
      await fsExtra.ensureDir(this.config.webhooksDir, { mode: this.config.dirMode })

      const files = await fs.readdir(this.config.webhooksDir)
      const webhookFiles = files.filter(file => file.endsWith('.json'))

      const webhooks: WebhookConfig[] = []
      for (const file of webhookFiles) {
        try {
          const id = path.basename(file, '.json')
          const webhook = await this.getWebhook(id)
          if (webhook) {
            webhooks.push(webhook)
          }
        } catch (error) {
          // Skip invalid webhook files but log the issue
          if (!this.config.silent) {
            console.warn(`Warning: Could not read webhook file ${file}: ${error}`)
          }
        }
      }

      // Apply filters
      let filteredWebhooks = webhooks

      if (options.active !== undefined) {
        filteredWebhooks = filteredWebhooks.filter(webhook => webhook.active === options.active)
      }

      if (options.events && options.events.length > 0) {
        filteredWebhooks = filteredWebhooks.filter(webhook => 
          options.events!.some((eventPattern: string) => 
            webhook.events.some(webhookEvent => 
              this.matchesEventPattern(webhookEvent, eventPattern)
            )
          )
        )
      }

      if (options.createdBy) {
        filteredWebhooks = filteredWebhooks.filter(webhook => webhook.createdBy === options.createdBy)
      }

      // Sort by creation date (newest first)
      filteredWebhooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      // Apply pagination
      if (options.offset) {
        filteredWebhooks = filteredWebhooks.slice(options.offset)
      }

      if (options.limit) {
        filteredWebhooks = filteredWebhooks.slice(0, options.limit)
      }

      return filteredWebhooks
    } catch (error) {
      throw new Error(`Failed to list webhooks: ${error}`)
    }
  }

  public async deleteWebhook(id: string): Promise<void> {
    try {
      const filePath = this.getWebhookPath(id)
      
      // Check if webhook exists
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        // Webhook doesn't exist, nothing to delete
        return
      }

      await fs.unlink(filePath)
    } catch (error) {
      throw new Error(`Failed to delete webhook ${id}: ${error}`)
    }
  }

  // Path helpers for app tokens
  private getTokenPath(id: string): string {
    SecurityValidator.validateDocumentId(id)
    return path.join(this.config.tokensDir, `${id}.json`)
  }

  // Path helpers for webhooks
  private getWebhookPath(id: string): string {
    SecurityValidator.validateDocumentId(id)
    const webhookPath = path.join(this.config.webhooksDir, `${id}.json`)
    this.validateSecurePath(webhookPath, this.config.webhooksDir)
    return webhookPath
  }

  // Helper method for event pattern matching
  private matchesEventPattern(webhookEvent: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern.endsWith('*')) {
      return webhookEvent.startsWith(pattern.slice(0, -1))
    }
    return webhookEvent === pattern
  }

  // Utility operations
  public async healthCheck(): Promise<boolean> {
    try {
      // Ensure directories exist first
      await fsExtra.ensureDir(this.config.contentDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.mediaDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.usersDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.tokensDir, { mode: this.config.dirMode })
      
      // Check if directories are accessible
      await fs.access(this.config.contentDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.mediaDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.usersDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.tokensDir, constants.R_OK | constants.W_OK)
      
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

  // Variant file operations
  public async saveVariantFile(parentId: string, variantName: string, buffer: Buffer, format: string): Promise<string> {
    try {
      // Create variants directory if it doesn't exist
      const variantsDir = path.join(this.config.mediaDir, 'variants')
      await fsExtra.ensureDir(variantsDir, { mode: this.config.dirMode })

      // Create parent directory for this image's variants
      const parentVariantsDir = path.join(variantsDir, parentId)
      await fsExtra.ensureDir(parentVariantsDir, { mode: this.config.dirMode })

      // Save variant file
      const variantFilename = `${variantName}.${format}`
      const variantPath = path.join(parentVariantsDir, variantFilename)
      
      await fs.writeFile(variantPath, buffer)
      
      // Return relative path for URL generation
      return `variants/${parentId}/${variantFilename}`
    } catch (error) {
      console.error('[ERROR] FilesystemAdapter.saveVariantFile failed:', error)
      throw new Error(`Failed to save variant file ${parentId}/${variantName}: ${error}`)
    }
  }

  public getVariantUrl(parentId: string, variantName: string): string {
    // No URL generation - let frontend handle URL construction
    return ''
  }

  private updateVariantUrls(imageVariants: Record<string, any>, parentId: string): Record<string, any> {
    // Update variant URLs to use the new API format
    const updatedVariants: Record<string, any> = {}
    for (const [variantName, variantData] of Object.entries(imageVariants)) {
      updatedVariants[variantName] = {
        ...variantData,
        url: this.getVariantUrl(parentId, variantName)
      }
    }
    return updatedVariants
  }

  public async getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null> {
    try {
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
      const sliced = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer | SharedArrayBuffer
      // Ensure we return ArrayBuffer, not SharedArrayBuffer
      if (sliced instanceof ArrayBuffer) {
        return sliced
      } else {
        // Copy SharedArrayBuffer to ArrayBuffer
        const sharedBuffer = sliced as SharedArrayBuffer
        const arrayBuffer = new ArrayBuffer(sharedBuffer.byteLength)
        new Uint8Array(arrayBuffer).set(new Uint8Array(sharedBuffer))
        return arrayBuffer
      }
    } catch (error) {
      console.error(`[ERROR] FilesystemAdapter.getVariantContent failed for ${parentId}/${variantName}:`, error)
      return null
    }
  }

  public async deleteVariantFiles(parentId: string): Promise<void> {
    try {
      const parentVariantsDir = path.join(this.config.mediaDir, 'variants', parentId)
      
      // Check if directory exists before trying to delete
      try {
        await fs.access(parentVariantsDir, constants.F_OK)
        await fs.rm(parentVariantsDir, { recursive: true, force: true })
      } catch {
        // Directory doesn't exist, nothing to delete
      }
    } catch (error) {
      console.error('[ERROR] FilesystemAdapter.deleteVariantFiles failed:', error)
      throw new Error(`Failed to delete variant files for ${parentId}: ${error}`)
    }
  }
}