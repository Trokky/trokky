import type { D1Database } from '@cloudflare/workers-types'
import {
  DataStorageAdapter,
  Document,
  DocumentData,
  ListOptions,
  User,
  CreateUserData,
  UpdateUserData,
  AppToken,
  CreateAppTokenData,
  UpdateAppTokenData,
  InvalidInputError,
  SecurityValidator,
  createLogger,
  generateUUID
} from '@trokky/core'
import type {
  CloudflareD1AdapterConfig,
  D1DocumentRow,
  D1UserRow,
  D1AppTokenRow,
  D1AuditLogRow
} from './types.js'

/**
 * Cloudflare D1 Data Storage Adapter
 * 
 * Provides data storage using Cloudflare D1 SQL database.
 * Optimized for edge runtime with minimal dependencies.
 */
export class CloudflareD1Adapter implements DataStorageAdapter {
  private db: D1Database | null = null
  private config: CloudflareD1AdapterConfig
  private logger = createLogger('adapter', 'CloudflareD1')
  private tablePrefix: string

  constructor(config: CloudflareD1AdapterConfig = {}) {
    this.config = config
    this.tablePrefix = config.tablePrefix || ''
    
    if (config.database) {
      this.db = config.database
    }

    if (!this.db && !config.databaseName) {
      this.logger.warn('No D1 database provided. Call setDatabase() before use.')
    }
  }

  /**
   * Set the D1 database instance (for runtime binding)
   */
  public setDatabase(database: D1Database): void {
    this.db = database
    this.logger.info('D1 database binding set')
  }

  /**
   * Initialize database schema
   */
  public async initialize(): Promise<void> {
    if (!this.db) {
      throw new Error('D1 database not configured')
    }

    try {
      // Create base schema tables if they don't exist
      await this.createSchema()
      
      // Run custom migrations if provided
      if (this.config.migrations && this.config.migrations.length > 0) {
        for (const migration of this.config.migrations) {
          await this.db.exec(migration)
        }
        this.logger.info('Custom migrations executed')
      }

      this.logger.info('CloudflareD1Adapter initialized')
    } catch (error) {
      this.logger.error('Failed to initialize D1 adapter', error)
      throw error
    }
  }

  /**
   * Create database schema if it doesn't exist
   */
  private async createSchema(): Promise<void> {
    if (!this.db) return

    const createTables = `
      -- Documents table
      CREATE TABLE IF NOT EXISTS ${this.tableName('documents')} (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        data TEXT NOT NULL,
        slug TEXT,
        published INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        revision INTEGER DEFAULT 1
      );

      -- Indexes for documents
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}docs_collection ON ${this.tableName('documents')} (collection);
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}docs_published ON ${this.tableName('documents')} (published);
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}docs_status ON ${this.tableName('documents')} (status);
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}docs_slug ON ${this.tableName('documents')} (slug);
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}docs_updated ON ${this.tableName('documents')} (updated_at);

      -- Users table
      CREATE TABLE IF NOT EXISTS ${this.tableName('users')} (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        preferences TEXT DEFAULT '{}',
        last_login_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- App tokens table
      CREATE TABLE IF NOT EXISTS ${this.tableName('app_tokens')} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        permissions TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        last_used_at TEXT,
        expires_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Audit logs table
      CREATE TABLE IF NOT EXISTS ${this.tableName('audit_logs')} (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      );
    `

    await this.db.exec(createTables)

    // Create FTS table if enabled
    if (this.config.enableFTS) {
      const createFTS = `
        CREATE VIRTUAL TABLE IF NOT EXISTS ${this.tableName('documents_fts')} USING fts5(
          collection, data, content=${this.tableName('documents')}, content_rowid=rowid
        );

        -- Trigger to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS ${this.tableName('documents_fts_insert')} AFTER INSERT ON ${this.tableName('documents')} BEGIN
          INSERT INTO ${this.tableName('documents_fts')} (rowid, collection, data) 
          VALUES (new.rowid, new.collection, new.data);
        END;

        CREATE TRIGGER IF NOT EXISTS ${this.tableName('documents_fts_delete')} AFTER DELETE ON ${this.tableName('documents')} BEGIN
          DELETE FROM ${this.tableName('documents_fts')} WHERE rowid = old.rowid;
        END;

        CREATE TRIGGER IF NOT EXISTS ${this.tableName('documents_fts_update')} AFTER UPDATE ON ${this.tableName('documents')} BEGIN
          DELETE FROM ${this.tableName('documents_fts')} WHERE rowid = old.rowid;
          INSERT INTO ${this.tableName('documents_fts')} (rowid, collection, data) 
          VALUES (new.rowid, new.collection, new.data);
        END;
      `
      
      await this.db.exec(createFTS)
      this.logger.info('FTS tables and triggers created')
    }

    this.logger.info('Database schema initialized')
  }

  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================

  public async getDocument(collection: string, id: string): Promise<Document | null> {
    try {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        SELECT * FROM ${this.tableName('documents')} 
        WHERE collection = ? AND id = ? 
        LIMIT 1
      `
      
      const result = await this.db
        .prepare(query)
        .bind(collection, id)
        .first<D1DocumentRow>()

      if (!result) return null

      return this.rowToDocument(result)
    } catch (error) {
      this.logger.error(`Failed to get document ${collection}/${id}`, error)
      throw error
    }
  }

  public async saveDocument(collection: string, id: string, data: DocumentData): Promise<Document> {
    try {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentData(data)

      if (!this.db) throw new Error('Database not initialized')

      // Use provided ID or generate if empty
      const documentId = id || this.generateId(collection)
      const now = new Date().toISOString()
      
      // Check if document exists
      const existing = await this.getDocument(collection, documentId)
      
      if (existing) {
        // Update existing document
        const query = `
          UPDATE ${this.tableName('documents')}
          SET data = ?, 
              slug = ?,
              published = ?,
              status = ?,
              updated_at = ?,
              updated_by = ?,
              revision = revision + 1
          WHERE collection = ? AND id = ?
        `
        
        await this.db
          .prepare(query)
          .bind(
            JSON.stringify(data),
            (data as any).slug || null,
            (data as any).published ? 1 : 0,
            (data as any).status || 'draft',
            now,
            (data as any)._updatedBy || null,
            collection,
            documentId
          )
          .run()
          
        this.logger.debug('Document updated', { collection, id: documentId })
      } else {
        // Insert new document
        const query = `
          INSERT INTO ${this.tableName('documents')} (
            id, collection, data, slug, published, status,
            created_at, updated_at, created_by, updated_by, revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        
        await this.db
          .prepare(query)
          .bind(
            documentId,
            collection,
            JSON.stringify(data),
            (data as any).slug || null,
            (data as any).published ? 1 : 0,
            (data as any).status || 'draft',
            now,
            now,
            (data as any)._createdBy || null,
            (data as any)._updatedBy || null,
            1
          )
          .run()
          
        this.logger.debug('Document created', { collection, id: documentId })
      }

      // Return the saved document
      const saved = await this.getDocument(collection, documentId)
      if (!saved) throw new Error('Failed to retrieve saved document')
      
      return saved
    } catch (error) {
      this.logger.error(`Failed to save document in ${collection}`, error)
      throw error
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    try {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        DELETE FROM ${this.tableName('documents')} 
        WHERE collection = ? AND id = ?
      `
      
      await this.db
        .prepare(query)
        .bind(collection, id)
        .run()

      this.logger.debug('Document deleted', { collection, id })
    } catch (error) {
      this.logger.error(`Failed to delete document ${collection}/${id}`, error)
      throw error
    }
  }

  public async listDocuments(collection: string, options: ListOptions = {}): Promise<Document[]> {
    try {
      SecurityValidator.validateCollectionName(collection)

      if (!this.db) throw new Error('Database not initialized')

      let query = `SELECT * FROM ${this.tableName('documents')} WHERE collection = ?`
      const bindings: any[] = [collection]

      // Apply filters
      if (options.filter) {
        const filterClauses: string[] = []
        for (const [key, value] of Object.entries(options.filter)) {
          if (key === 'published' || key === 'status' || key === 'slug') {
            filterClauses.push(`${key} = ?`)
            bindings.push(key === 'published' ? (value ? 1 : 0) : value)
          } else {
            // For JSON data filters, use JSON extract
            filterClauses.push(`json_extract(data, '$.${key}') = ?`)
            bindings.push(typeof value === 'object' ? JSON.stringify(value) : value)
          }
        }
        if (filterClauses.length > 0) {
          query += ` AND (${filterClauses.join(' AND ')})`
        }
      }

      // Apply sorting
      if (options.sort) {
        const sortString = Array.isArray(options.sort) ? options.sort[0] : options.sort
        const sortField = sortString.startsWith('-') ? sortString.slice(1) : sortString
        const sortOrder = sortString.startsWith('-') ? 'DESC' : 'ASC'
        
        if (['created_at', 'updated_at', 'slug', 'status', 'published'].includes(sortField)) {
          query += ` ORDER BY ${sortField} ${sortOrder}`
        } else {
          query += ` ORDER BY json_extract(data, '$.${sortField}') ${sortOrder}`
        }
      } else {
        query += ' ORDER BY updated_at DESC'
      }

      // Apply pagination with proper parameterization
      if (options.limit !== undefined) {
        if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10000) {
          throw new InvalidInputError('Invalid limit: must be an integer between 1 and 10000')
        }
        query += ` LIMIT ?`
        bindings.push(options.limit)
      }
      if (options.offset !== undefined) {
        if (!Number.isInteger(options.offset) || options.offset < 0) {
          throw new InvalidInputError('Invalid offset: must be a non-negative integer')
        }
        query += ` OFFSET ?`
        bindings.push(options.offset)
      }

      const results = await this.db
        .prepare(query)
        .bind(...bindings)
        .all<D1DocumentRow>()

      return (results.results || []).map(row => this.rowToDocument(row))
    } catch (error) {
      this.logger.error(`Failed to list documents in ${collection}`, error)
      throw error
    }
  }

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  public async getUser(id: string): Promise<User | null> {
    try {
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        SELECT * FROM ${this.tableName('users')} 
        WHERE id = ? 
        LIMIT 1
      `
      
      const result = await this.db
        .prepare(query)
        .bind(id)
        .first<D1UserRow>()

      if (!result) return null

      return this.rowToUser(result)
    } catch (error) {
      this.logger.error(`Failed to get user ${id}`, error)
      throw error
    }
  }

  public async saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User> {
    try {
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const userId = id || this.generateId('user')
      const now = new Date().toISOString()
      
      // Check if user exists
      const existing = await this.getUser(userId)
      
      if (existing) {
        // Update existing user
        const query = `
          UPDATE ${this.tableName('users')}
          SET username = ?,
              email = ?,
              password_hash = ?,
              first_name = ?,
              last_name = ?,
              role = ?,
              permissions = ?,
              is_active = ?,
              preferences = ?,
              last_login_at = ?,
              updated_at = ?
          WHERE id = ?
        `
        
        // Handle password hash updates - use provided value or keep existing
        const passwordHash = (userData as any).passwordHash || existing.passwordHash
        
        await this.db
          .prepare(query)
          .bind(
            userData.username || existing.username,
            userData.email || existing.email,
            passwordHash,
            userData.firstName || existing.firstName || null,
            userData.lastName || existing.lastName || null,
            userData.role || existing.role || 'user',
            JSON.stringify(userData.permissions || existing.permissions || []),
            (userData.isActive !== undefined ? userData.isActive : existing.isActive) ? 1 : 0,
            JSON.stringify(userData.preferences || existing.preferences || {}),
            existing.lastLoginAt || null,
            now,
            userId
          )
          .run()
          
        this.logger.debug('User updated', { id: userId })
      } else {
        // Insert new user
        const query = `
          INSERT INTO ${this.tableName('users')} (
            id, username, email, password_hash, first_name, last_name,
            role, permissions, is_active, preferences, last_login_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        
        // Get password hash from user data - service layer should provide this
        const passwordHash = (userData as any).passwordHash || ''
        
        await this.db
          .prepare(query)
          .bind(
            userId,
            userData.username,
            userData.email,
            passwordHash,
            userData.firstName || null,
            userData.lastName || null,
            userData.role || 'user',
            JSON.stringify(userData.permissions || []),
            (userData.isActive !== false) ? 1 : 0,
            JSON.stringify(userData.preferences || {}),
            null, // No last login for new users
            now,
            now
          )
          .run()
          
        this.logger.debug('User created', { id: userId })
      }

      // Return the saved user
      const saved = await this.getUser(userId)
      if (!saved) throw new Error('Failed to retrieve saved user')
      
      return saved
    } catch (error) {
      this.logger.error('Failed to save user', error)
      throw error
    }
  }

  public async deleteUser(id: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        DELETE FROM ${this.tableName('users')} 
        WHERE id = ?
      `
      
      await this.db
        .prepare(query)
        .bind(id)
        .run()

      this.logger.debug('User deleted', { id })
    } catch (error) {
      this.logger.error(`Failed to delete user ${id}`, error)
      throw error
    }
  }

  public async listUsers(options: ListOptions = {}): Promise<User[]> {
    try {
      if (!this.db) throw new Error('Database not initialized')

      let query = `SELECT * FROM ${this.tableName('users')} WHERE 1=1`
      const bindings: any[] = []

      // Apply filters
      if (options.filter) {
        for (const [key, value] of Object.entries(options.filter)) {
          if (['role', 'is_active'].includes(key)) {
            query += ` AND ${key} = ?`
            bindings.push(key === 'is_active' ? (value ? 1 : 0) : value)
          }
        }
      }

      // Apply sorting
      query += ' ORDER BY created_at DESC'

      // Apply pagination with proper parameterization
      if (options.limit !== undefined) {
        if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10000) {
          throw new InvalidInputError('Invalid limit: must be an integer between 1 and 10000')
        }
        query += ` LIMIT ?`
        bindings.push(options.limit)
      }
      if (options.offset !== undefined) {
        if (!Number.isInteger(options.offset) || options.offset < 0) {
          throw new InvalidInputError('Invalid offset: must be a non-negative integer')
        }
        query += ` OFFSET ?`
        bindings.push(options.offset)
      }

      const results = await this.db
        .prepare(query)
        .bind(...bindings)
        .all<D1UserRow>()

      return (results.results || []).map(row => this.rowToUser(row))
    } catch (error) {
      this.logger.error('Failed to list users', error)
      throw error
    }
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    try {
      SecurityValidator.validateUsername(username)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        SELECT * FROM ${this.tableName('users')} 
        WHERE username = ? 
        LIMIT 1
      `
      
      const result = await this.db
        .prepare(query)
        .bind(username)
        .first<D1UserRow>()

      if (!result) return null

      return this.rowToUser(result)
    } catch (error) {
      this.logger.error(`Failed to get user by username ${username}`, error)
      throw error
    }
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    try {
      SecurityValidator.validateEmail(email)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        SELECT * FROM ${this.tableName('users')} 
        WHERE email = ? 
        LIMIT 1
      `
      
      const result = await this.db
        .prepare(query)
        .bind(email)
        .first<D1UserRow>()

      if (!result) return null

      return this.rowToUser(result)
    } catch (error) {
      this.logger.error(`Failed to get user by email ${email}`, error)
      throw error
    }
  }

  // ==========================================================================
  // APP TOKEN OPERATIONS
  // ==========================================================================

  public async getAppToken(id: string): Promise<AppToken | null> {
    try {
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        SELECT * FROM ${this.tableName('app_tokens')} 
        WHERE id = ? 
        LIMIT 1
      `
      
      const result = await this.db
        .prepare(query)
        .bind(id)
        .first<D1AppTokenRow>()

      if (!result) return null

      return this.rowToAppToken(result)
    } catch (error) {
      this.logger.error(`Failed to get app token ${id}`, error)
      throw error
    }
  }

  public async getAppTokenByHash(tokenHash: string): Promise<AppToken | null> {
    try {
      if (!this.db) throw new Error('Database not initialized')

      const query = `
        SELECT * FROM ${this.tableName('app_tokens')} 
        WHERE token_hash = ? 
        LIMIT 1
      `
      
      const result = await this.db
        .prepare(query)
        .bind(tokenHash)
        .first<D1AppTokenRow>()

      if (!result) return null

      return this.rowToAppToken(result)
    } catch (error) {
      this.logger.error('Failed to get app token by hash', error)
      throw error
    }
  }

  public async saveAppToken(id: string, tokenData: CreateAppTokenData | Partial<UpdateAppTokenData>): Promise<AppToken> {
    try {
      if (!this.db) throw new Error('Database not initialized')

      const tokenId = id || this.generateId('token')
      const now = new Date().toISOString()
      
      // Check if token exists
      const existing = await this.getAppToken(tokenId)
      
      if (existing) {
        // Update existing token
        const query = `
          UPDATE ${this.tableName('app_tokens')}
          SET name = ?,
              permissions = ?,
              description = ?,
              is_active = ?,
              last_used_at = ?,
              expires_at = ?,
              updated_at = ?
          WHERE id = ?
        `
        
        await this.db
          .prepare(query)
          .bind(
            tokenData.name || existing.name,
            JSON.stringify(tokenData.permissions || existing.permissions),
            tokenData.description || existing.description || null,
            existing.isActive ? 1 : 0,
            existing.lastUsedAt || null,
            tokenData.expiresAt || existing.expiresAt || null,
            now,
            tokenId
          )
          .run()
          
        this.logger.debug('App token updated', { id: tokenId })
      } else {
        // Insert new token
        const query = `
          INSERT INTO ${this.tableName('app_tokens')} (
            id, name, token_hash, permissions, description,
            is_active, last_used_at, expires_at, created_by,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        
        // Get token hash and createdBy from token data - service layer should provide these
        const tokenHash = (tokenData as any).tokenHash || ''
        const createdBy = (tokenData as any).createdBy || 'system'
        
        await this.db
          .prepare(query)
          .bind(
            tokenId,
            tokenData.name,
            tokenHash,
            JSON.stringify(tokenData.permissions),
            tokenData.description || null,
            1, // Active by default
            null, // No last used at creation
            tokenData.expiresAt || null,
            createdBy,
            now,
            now
          )
          .run()
          
        this.logger.debug('App token created', { id: tokenId })
      }

      // Return the saved token
      const saved = await this.getAppToken(tokenId)
      if (!saved) throw new Error('Failed to retrieve saved app token')
      
      return saved
    } catch (error) {
      this.logger.error('Failed to save app token', error)
      throw error
    }
  }

  public async deleteAppToken(id: string): Promise<void> {
    try {
      SecurityValidator.validateDocumentId(id)

      if (!this.db) throw new Error('Database not initialized')

      const query = `
        DELETE FROM ${this.tableName('app_tokens')} 
        WHERE id = ?
      `
      
      await this.db
        .prepare(query)
        .bind(id)
        .run()

      this.logger.debug('App token deleted', { id })
    } catch (error) {
      this.logger.error(`Failed to delete app token ${id}`, error)
      throw error
    }
  }

  public async listAppTokens(options: ListOptions = {}): Promise<AppToken[]> {
    try {
      if (!this.db) throw new Error('Database not initialized')

      let query = `SELECT * FROM ${this.tableName('app_tokens')} WHERE 1=1`
      const bindings: any[] = []

      // Apply filters
      if (options.filter) {
        for (const [key, value] of Object.entries(options.filter)) {
          if (key === 'is_active') {
            query += ` AND ${key} = ?`
            bindings.push(value ? 1 : 0)
          }
        }
      }

      // Apply sorting
      query += ' ORDER BY created_at DESC'

      // Apply pagination with proper parameterization
      if (options.limit !== undefined) {
        if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10000) {
          throw new InvalidInputError('Invalid limit: must be an integer between 1 and 10000')
        }
        query += ` LIMIT ?`
        bindings.push(options.limit)
      }
      if (options.offset !== undefined) {
        if (!Number.isInteger(options.offset) || options.offset < 0) {
          throw new InvalidInputError('Invalid offset: must be a non-negative integer')
        }
        query += ` OFFSET ?`
        bindings.push(options.offset)
      }

      const results = await this.db
        .prepare(query)
        .bind(...bindings)
        .all<D1AppTokenRow>()

      return (results.results || []).map(row => this.rowToAppToken(row))
    } catch (error) {
      this.logger.error('Failed to list app tokens', error)
      throw error
    }
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false

      // Try a simple query
      const query = `SELECT 1 as health FROM ${this.tableName('documents')} LIMIT 1`
      await this.db.prepare(query).first()
      
      return true
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  public async searchDocuments(collection: string, searchTerm: string, options: ListOptions = {}): Promise<Document[]> {
    try {
      SecurityValidator.validateCollectionName(collection)
      
      // Validate and sanitize search term
      if (!searchTerm || typeof searchTerm !== 'string') {
        throw new InvalidInputError('Search term must be a non-empty string')
      }
      if (searchTerm.length > 1000) {
        throw new InvalidInputError('Search term too long (max 1000 characters)')
      }
      
      // Sanitize search term for FTS - escape quotes and special characters
      const sanitizedSearchTerm = searchTerm
        .replace(/"/g, '""')
        .replace(/'/g, "''")
        .trim()
      
      if (!sanitizedSearchTerm) {
        throw new InvalidInputError('Invalid search term after sanitization')
      }

      if (!this.db) throw new Error('Database not initialized')
      if (!this.config.enableFTS) {
        // Fallback to LIKE search if FTS is not enabled
        return this.searchWithoutFTS(collection, sanitizedSearchTerm, options)
      }
      
      // Validate pagination parameters
      const limit = options.limit || 50
      const offset = options.offset || 0
      
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new InvalidInputError('Invalid limit for search: must be an integer between 1 and 1000')
      }
      if (!Number.isInteger(offset) || offset < 0) {
        throw new InvalidInputError('Invalid offset for search: must be a non-negative integer')
      }

      const query = `
        SELECT d.* FROM ${this.tableName('documents')} d
        JOIN ${this.tableName('documents_fts')} fts ON d.rowid = fts.rowid
        WHERE fts.collection = ? AND fts.data MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `

      const results = await this.db
        .prepare(query)
        .bind(
          collection,
          sanitizedSearchTerm,
          limit,
          offset
        )
        .all<D1DocumentRow>()

      return (results.results || []).map(row => this.rowToDocument(row))
    } catch (error) {
      this.logger.error(`Failed to search documents in ${collection}`, error)
      throw error
    }
  }

  private async searchWithoutFTS(collection: string, searchTerm: string, options: ListOptions = {}): Promise<Document[]> {
    // Simple LIKE search fallback with sanitized input
    // Escape LIKE wildcards in search term to prevent injection
    const escapedSearchTerm = searchTerm
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
    
    // Validate pagination parameters
    const limit = options.limit || 50
    const offset = options.offset || 0
    
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new InvalidInputError('Invalid limit for search: must be an integer between 1 and 1000')
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new InvalidInputError('Invalid offset for search: must be a non-negative integer')
    }
    
    const query = `
      SELECT * FROM ${this.tableName('documents')}
      WHERE collection = ? AND data LIKE ? ESCAPE '\\'
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `

    const results = await this.db!
      .prepare(query)
      .bind(
        collection,
        `%${escapedSearchTerm}%`,
        limit,
        offset
      )
      .all<D1DocumentRow>()

    return (results.results || []).map(row => this.rowToDocument(row))
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  private tableName(table: string): string {
    return this.tablePrefix ? `${this.tablePrefix}_${table}` : table
  }

  private generateId(prefix: string): string {
    // Use crypto-secure UUID generation
    const uuid = generateUUID()
    return `${prefix}-${uuid}`
  }

  private rowToDocument(row: D1DocumentRow): Document {
    const data = JSON.parse(row.data)
    return {
      _id: row.id,
      _collection: row.collection,
      ...data,
      slug: row.slug || undefined,
      published: row.published === 1,
      status: row.status || 'draft',
      _createdAt: new Date(row.created_at),
      _updatedAt: new Date(row.updated_at),
      _createdBy: row.created_by || undefined,
      _updatedBy: row.updated_by || undefined,
      _revision: row.revision
    }
  }

  private rowToUser(row: D1UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      role: row.role as any,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      isActive: row.is_active === 1,
      preferences: row.preferences ? JSON.parse(row.preferences) : {},
      lastLoginAt: row.last_login_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private rowToAppToken(row: D1AppTokenRow): AppToken {
    return {
      id: row.id,
      name: row.name,
      tokenHash: row.token_hash,
      permissions: JSON.parse(row.permissions),
      description: row.description || undefined,
      isActive: row.is_active === 1,
      lastUsedAt: row.last_used_at || undefined,
      expiresAt: row.expires_at || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}