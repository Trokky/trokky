import { promises as fs, constants } from 'fs'
import * as fsExtra from 'fs-extra'
import * as path from 'path'
import {
  DataStorageAdapter,
  Document,
  DocumentData,
  ListOptions,
  Migration,
  SecurityValidator,
  InvalidInputError,
  User,
  UserListOptions,
  CreateUserData,
  UpdateUserData,
  AppToken,
  AppTokenListOptions,
  CreateAppTokenData,
  UpdateAppTokenData,
  WebhookConfig,
  WebhookListOptions,
  createLogger
} from '@trokky/core'
import { FilesystemDataAdapterConfig, DocumentFile, UserFile, AppTokenFile } from './types'

export class FilesystemDataAdapter implements DataStorageAdapter {
  private config: Required<Omit<FilesystemDataAdapterConfig, 'webhooksDir'>> & { webhooksDir: string }
  private logger = createLogger('adapter', 'FilesystemDataAdapter')
  
  // Security limits
  private readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

  constructor(config: FilesystemDataAdapterConfig = {}) {
    this.config = {
      contentDir: config.contentDir || './content',
      usersDir: config.usersDir || './users',
      tokensDir: config.tokensDir || './tokens',
      webhooksDir: config.webhooksDir || './webhooks',
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

    if (!this.config.silent) {
      this.logger.info('FilesystemDataAdapter initialized', {
        contentDir: this.config.contentDir,
        usersDir: this.config.usersDir,
        tokensDir: this.config.tokensDir
      })
    }
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fsExtra.ensureDir(this.config.contentDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.usersDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.tokensDir, { mode: this.config.dirMode })
      await fsExtra.ensureDir(this.config.webhooksDir, { mode: this.config.dirMode })
    } catch (error) {
      if (!this.config.silent) {
        this.logger.error('Failed to initialize directories', error)
      }
      throw error
    }
  }

  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================

  public async getDocument(collection: string, id: string): Promise<Document | null> {
    try {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      const filePath = this.getDocumentPath(collection, id)
      
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null // File doesn't exist
      }

      const fileContent = await fs.readFile(filePath, 'utf8')
      const documentFile: DocumentFile = JSON.parse(fileContent)

      return {
        id: documentFile.id,
        _collection: collection,
        _createdAt: new Date(documentFile.metadata.createdAt),
        _updatedAt: new Date(documentFile.metadata.updatedAt),
        _revision: documentFile.metadata.revision,
        _status: documentFile.metadata.status,
        ...documentFile.data
      }
    } catch (error) {
      this.logger.error(`Failed to get document ${id} from collection ${collection}`, error)
      throw new Error(`Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async saveDocument(collection: string, id: string, data: DocumentData): Promise<Document> {
    try {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      const collectionDir = path.join(this.config.contentDir, collection)
      await fsExtra.ensureDir(collectionDir, { mode: this.config.dirMode })

      const filePath = this.getDocumentPath(collection, id)
      let documentFile: DocumentFile

      // Check if document exists
      let isUpdate = false
      try {
        await fs.access(filePath, constants.F_OK)
        const existingContent = await fs.readFile(filePath, 'utf8')
        const existingDoc: DocumentFile = JSON.parse(existingContent)
        
        // Document exists, this is an update
        isUpdate = true
        documentFile = {
          id,
          collection,
          data,
          metadata: {
            createdAt: existingDoc.metadata.createdAt,
            updatedAt: new Date(),
            revision: existingDoc.metadata.revision + 1,
            status: existingDoc.metadata.status
          }
        }
      } catch {
        // Document doesn't exist, this is a new document
        documentFile = {
          id,
          collection,
          data,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            revision: 1,
            status: 'draft'
          }
        }
      }

      // Validate content size
      const jsonContent = this.formatJson(documentFile)
      if (jsonContent.length > this.MAX_DOCUMENT_SIZE) {
        throw new InvalidInputError(`Document content too large (${jsonContent.length} bytes). Maximum size is ${this.MAX_DOCUMENT_SIZE} bytes.`, 'size')
      }

      // Write document file
      await this.atomicWriteFile(filePath, jsonContent)

      if (!this.config.silent) {
        this.logger.info(`Document ${isUpdate ? 'updated' : 'created'}`, { collection, id, revision: documentFile.metadata.revision })
      }

      return {
        id: documentFile.id,
        _collection: collection,
        _createdAt: documentFile.metadata.createdAt,
        _updatedAt: documentFile.metadata.updatedAt,
        _revision: documentFile.metadata.revision,
        _status: documentFile.metadata.status,
        ...documentFile.data
      }
    } catch (error) {
      this.logger.error(`Failed to save document ${id} in collection ${collection}`, error)
      throw error
    }
  }

  public async listDocuments(collection: string, options: ListOptions = {}): Promise<Document[]> {
    try {
      SecurityValidator.validateCollectionName(collection)

      const collectionDir = path.join(this.config.contentDir, collection)
      
      // Check if collection directory exists
      try {
        await fs.access(collectionDir, constants.F_OK)
      } catch {
        return [] // Collection doesn't exist
      }

      const files = await fs.readdir(collectionDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      // Read all documents
      const documents: Document[] = []
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(collectionDir, file)
          const fileContent = await fs.readFile(filePath, 'utf8')
          const documentFile: DocumentFile = JSON.parse(fileContent)

          const document: Document = {
            id: documentFile.id,
            _collection: collection,
            _createdAt: new Date(documentFile.metadata.createdAt),
            _updatedAt: new Date(documentFile.metadata.updatedAt),
            _revision: documentFile.metadata.revision,
            _status: documentFile.metadata.status,
            ...documentFile.data
          }

          documents.push(document)
        } catch (error) {
          this.logger.warn(`Skipping invalid document file ${file}`, error)
          continue
        }
      }

      // Apply filters
      let filteredDocuments = documents

      if (options.filter) {
        filteredDocuments = documents.filter(doc => {
          for (const [key, value] of Object.entries(options.filter!)) {
            if ((doc as any)[key] !== value) {
              return false
            }
          }
          return true
        })
      }

      // Apply sorting
      if (options.sort) {
        const sortFields = Array.isArray(options.sort) ? options.sort : [options.sort]
        filteredDocuments.sort((a, b) => {
          for (const field of sortFields) {
            const aVal = (a as any)[field]
            const bVal = (b as any)[field]
            if (aVal < bVal) return -1
            if (aVal > bVal) return 1
          }
          return 0
        })
      }

      // Apply pagination
      const { offset = 0, limit } = options
      const start = offset
      const end = limit ? start + limit : undefined

      return filteredDocuments.slice(start, end)
    } catch (error) {
      this.logger.error(`Failed to list documents in collection ${collection}`, error)
      throw new Error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    try {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      const filePath = this.getDocumentPath(collection, id)
      
      try {
        await fs.unlink(filePath)
        if (!this.config.silent) {
          this.logger.info('Document deleted', { collection, id })
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`Document ${id} not found in collection ${collection}`)
        }
        throw error
      }
    } catch (error) {
      this.logger.error(`Failed to delete document ${id} from collection ${collection}`, error)
      throw error
    }
  }

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  public async getUser(id: string): Promise<User | null> {
    try {
      SecurityValidator.validateDocumentId(id)

      const filePath = this.getUserPath(id)
      
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const fileContent = await fs.readFile(filePath, 'utf8')
      const userFile: UserFile = JSON.parse(fileContent)

      return this.userFileToUser(userFile)
    } catch (error) {
      this.logger.error(`Failed to get user ${id}`, error)
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User> {
    try {
      SecurityValidator.validateDocumentId(id)

      await fsExtra.ensureDir(this.config.usersDir, { mode: this.config.dirMode })

      const filePath = this.getUserPath(id)
      let userFile: UserFile
      let isUpdate = false

      // Check if user exists
      try {
        await fs.access(filePath, constants.F_OK)
        const existingContent = await fs.readFile(filePath, 'utf8')
        const existingUser: UserFile = JSON.parse(existingContent)
        
        // User exists, this is an update
        isUpdate = true
        const updateData = userData as Partial<UpdateUserData>
        userFile = {
          ...existingUser,
          ...updateData,
          id,
          updatedAt: new Date().toISOString()
        }
      } catch {
        // User doesn't exist, this is a new user
        const createData = userData as CreateUserData
        userFile = {
          id,
          username: createData.username,
          email: createData.email,
          passwordHash: '', // Will be set by the caller
          firstName: createData.firstName,
          lastName: createData.lastName,
          role: createData.role,
          permissions: createData.permissions || [],
          isActive: createData.isActive ?? true,
          profileImage: createData.profileImage,
          preferences: createData.preferences,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }

      // Write user file
      const jsonContent = this.formatJson(userFile)
      await this.atomicWriteFile(filePath, jsonContent)

      if (!this.config.silent) {
        this.logger.info(`User ${isUpdate ? 'updated' : 'created'}`, { 
          id, 
          username: userFile.username,
          email: userFile.email
        })
      }

      return this.userFileToUser(userFile)
    } catch (error) {
      this.logger.error(`Failed to save user ${id}`, error)
      throw error
    }
  }

  public async listUsers(options: UserListOptions = {}): Promise<User[]> {
    try {
      // Ensure users directory exists
      try {
        await fs.access(this.config.usersDir, constants.F_OK)
      } catch {
        return []
      }

      const files = await fs.readdir(this.config.usersDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      const users: User[] = []
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.config.usersDir, file)
          const fileContent = await fs.readFile(filePath, 'utf8')
          const userFile: UserFile = JSON.parse(fileContent)

          const user = this.userFileToUser(userFile)
          users.push(user)
        } catch (error) {
          this.logger.warn(`Skipping invalid user file ${file}`, error)
          continue
        }
      }

      // Apply filters
      let filteredUsers = users

      if (options.role) {
        filteredUsers = filteredUsers.filter(user => user.role === options.role)
      }

      if (options.isActive !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.isActive === options.isActive)
      }

      // Apply pagination
      const { offset = 0, limit } = options
      const start = offset
      const end = limit ? start + limit : undefined

      return filteredUsers.slice(start, end)
    } catch (error) {
      this.logger.error('Failed to list users', error)
      throw new Error(`Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async deleteUser(id: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(id)

      const filePath = this.getUserPath(id)
      
      try {
        await fs.unlink(filePath)
        if (!this.config.silent) {
          this.logger.info('User deleted', { id })
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`User ${id} not found`)
        }
        throw error
      }
    } catch (error) {
      this.logger.error(`Failed to delete user ${id}`, error)
      throw error
    }
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    try {
      const users = await this.listUsers()
      return users.find(user => user.username === username) || null
    } catch (error) {
      this.logger.error(`Failed to get user by username ${username}`, error)
      throw new Error(`Failed to get user by username: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.listUsers()
      return users.find(user => user.email === email) || null
    } catch (error) {
      this.logger.error(`Failed to get user by email ${email}`, error)
      throw new Error(`Failed to get user by email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ==========================================================================
  // APP TOKEN OPERATIONS
  // ==========================================================================

  public async getAppToken(id: string): Promise<AppToken | null> {
    try {
      SecurityValidator.validateDocumentId(id)

      const filePath = this.getTokenPath(id)
      
      try {
        await fs.access(filePath, constants.F_OK)
      } catch {
        return null
      }

      const fileContent = await fs.readFile(filePath, 'utf8')
      const tokenFile: AppTokenFile = JSON.parse(fileContent)

      return this.tokenFileToAppToken(tokenFile)
    } catch (error) {
      this.logger.error(`Failed to get app token ${id}`, error)
      throw new Error(`Failed to get app token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async saveAppToken(id: string, tokenData: CreateAppTokenData | Partial<UpdateAppTokenData> | AppToken): Promise<AppToken> {
    try {
      SecurityValidator.validateDocumentId(id)

      await fsExtra.ensureDir(this.config.tokensDir, { mode: this.config.dirMode })

      const filePath = this.getTokenPath(id)
      let tokenFile: AppTokenFile
      let isUpdate = false

      // Check if token exists
      try {
        await fs.access(filePath, constants.F_OK)
        const existingContent = await fs.readFile(filePath, 'utf8')
        const existingToken: AppTokenFile = JSON.parse(existingContent)
        
        // Token exists, this is an update
        isUpdate = true
        const updateData = tokenData as Partial<UpdateAppTokenData>
        tokenFile = {
          ...existingToken,
          ...updateData,
          id,
          updatedAt: new Date().toISOString()
        }
      } catch {
        // Token doesn't exist, this is a new token
        // Check if we received a complete AppToken object (from core engine)
        if ('tokenHash' in tokenData && 'createdBy' in tokenData) {
          // Complete AppToken object from core engine
          const completeToken = tokenData as AppToken
          tokenFile = {
            ...completeToken,
            id // Ensure ID matches
          }
        } else {
          // CreateAppTokenData from API
          const createData = tokenData as CreateAppTokenData
          tokenFile = {
            id,
            name: createData.name,
            description: createData.description,
            tokenHash: '', // Will be set by the caller
            permissions: createData.permissions,
            createdBy: '', // Will be set by the caller
            isActive: true,
            usageCount: 0,
            expiresAt: createData.expiresAt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }
      }

      // Write token file
      const jsonContent = this.formatJson(tokenFile)
      await this.atomicWriteFile(filePath, jsonContent)

      if (!this.config.silent) {
        this.logger.info(`App token ${isUpdate ? 'updated' : 'created'}`, { 
          id, 
          name: tokenFile.name 
        })
      }

      return this.tokenFileToAppToken(tokenFile)
    } catch (error) {
      this.logger.error(`Failed to save app token ${id}`, error)
      throw error
    }
  }

  public async listAppTokens(options: AppTokenListOptions = {}): Promise<AppToken[]> {
    try {
      // Ensure tokens directory exists
      try {
        await fs.access(this.config.tokensDir, constants.F_OK)
      } catch {
        return []
      }

      const files = await fs.readdir(this.config.tokensDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      const tokens: AppToken[] = []
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.config.tokensDir, file)
          const fileContent = await fs.readFile(filePath, 'utf8')
          const tokenFile: AppTokenFile = JSON.parse(fileContent)

          const token = this.tokenFileToAppToken(tokenFile)
          tokens.push(token)
        } catch (error) {
          this.logger.warn(`Skipping invalid token file ${file}`, error)
          continue
        }
      }

      // Apply filters
      let filteredTokens = tokens

      if (options.createdBy) {
        filteredTokens = filteredTokens.filter(token => token.createdBy === options.createdBy)
      }

      if (options.isActive !== undefined) {
        filteredTokens = filteredTokens.filter(token => token.isActive === options.isActive)
      }

      // Apply pagination
      const { offset = 0, limit } = options
      const start = offset
      const end = limit ? start + limit : undefined

      return filteredTokens.slice(start, end)
    } catch (error) {
      this.logger.error('Failed to list app tokens', error)
      throw new Error(`Failed to list app tokens: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async deleteAppToken(id: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(id)

      const filePath = this.getTokenPath(id)
      
      try {
        await fs.unlink(filePath)
        if (!this.config.silent) {
          this.logger.info('App token deleted', { id })
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`App token ${id} not found`)
        }
        throw error
      }
    } catch (error) {
      this.logger.error(`Failed to delete app token ${id}`, error)
      throw error
    }
  }

  public async getAppTokenByHash(hash: string): Promise<AppToken | null> {
    try {
      const tokens = await this.listAppTokens()
      return tokens.find(token => token.tokenHash === hash) || null
    } catch (error) {
      this.logger.error(`Failed to get app token by hash`, error)
      throw new Error(`Failed to get app token by hash: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ==========================================================================
  // WEBHOOK OPERATIONS
  // ==========================================================================

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

      this.logger.debug(`Webhook retrieved: ${id}`)
      return webhook
    } catch (error) {
      this.logger.error(`Failed to get webhook ${id}`, error)
      throw new Error(`Failed to get webhook ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        secret: webhookData.secret || existingWebhook?.secret || '',
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

      this.logger.info(`Webhook saved: ${id} (${isUpdate ? 'updated' : 'created'})`)
      return webhook
    } catch (error) {
      this.logger.error(`Failed to save webhook ${id}`, error)
      throw new Error(`Failed to save webhook ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
            this.logger.warn(`Could not read webhook file ${file}`, error)
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

      this.logger.debug(`Listed webhooks: ${filteredWebhooks.length} results`)
      return filteredWebhooks
    } catch (error) {
      this.logger.error('Failed to list webhooks', error)
      throw new Error(`Failed to list webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        this.logger.debug(`Webhook ${id} does not exist, nothing to delete`)
        return
      }

      await fs.unlink(filePath)
      this.logger.info(`Webhook deleted: ${id}`)
    } catch (error) {
      this.logger.error(`Failed to delete webhook ${id}`, error)
      throw new Error(`Failed to delete webhook ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS FOR WEBHOOKS
  // ==========================================================================

  private getWebhookPath(id: string): string {
    SecurityValidator.validateDocumentId(id)
    const webhookPath = path.join(this.config.webhooksDir, `${id}.json`)
    this.validateSecurePath(webhookPath, this.config.webhooksDir)
    return webhookPath
  }

  private matchesEventPattern(webhookEvent: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern.endsWith('*')) {
      return webhookEvent.startsWith(pattern.slice(0, -1))
    }
    return webhookEvent === pattern
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  public async healthCheck(): Promise<boolean> {
    try {
      // Test directory access
      await fs.access(this.config.contentDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.usersDir, constants.R_OK | constants.W_OK)
      await fs.access(this.config.tokensDir, constants.R_OK | constants.W_OK)
      
      return true
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  public async migrate(migrations: Migration[]): Promise<void> {
    // Basic migration support - implement as needed
    this.logger.info('Migration support not implemented for filesystem adapter', {
      migrationsCount: migrations.length
    })
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  private getDocumentPath(collection: string, id: string): string {
    return path.join(this.config.contentDir, collection, `${id}.json`)
  }

  private getUserPath(id: string): string {
    return path.join(this.config.usersDir, `${id}.json`)
  }

  private getTokenPath(id: string): string {
    return path.join(this.config.tokensDir, `${id}.json`)
  }

  private formatJson(data: any): string {
    if (this.config.prettyJson) {
      return JSON.stringify(data, null, this.config.jsonSpaces)
    }
    return JSON.stringify(data)
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

  private userFileToUser(userFile: UserFile): User {
    return {
      id: userFile.id,
      username: userFile.username,
      email: userFile.email,
      passwordHash: userFile.passwordHash,
      firstName: userFile.firstName,
      lastName: userFile.lastName,
      role: userFile.role as any,
      permissions: userFile.permissions as any[],
      isActive: userFile.isActive,
      profileImage: userFile.profileImage,
      preferences: userFile.preferences as any,
      lastLoginAt: userFile.lastLoginAt,
      createdAt: userFile.createdAt,
      updatedAt: userFile.updatedAt
    }
  }

  private tokenFileToAppToken(tokenFile: AppTokenFile): AppToken {
    return {
      id: tokenFile.id,
      name: tokenFile.name,
      description: tokenFile.description,
      tokenHash: tokenFile.tokenHash,
      permissions: tokenFile.permissions as any[],
      createdBy: tokenFile.createdBy,
      isActive: tokenFile.isActive,
      lastUsedAt: tokenFile.lastUsedAt,
      usageCount: tokenFile.usageCount,
      expiresAt: tokenFile.expiresAt,
      createdAt: tokenFile.createdAt,
      updatedAt: tokenFile.updatedAt
    }
  }

  // JSON parsing and serialization helpers
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

  private validateSecurePath(targetPath: string, basePath: string): void {
    const resolvedTarget = path.resolve(targetPath)
    const resolvedBase = path.resolve(basePath)
    
    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      throw new InvalidInputError('Path traversal attempt detected', 'path')
    }
  }
}