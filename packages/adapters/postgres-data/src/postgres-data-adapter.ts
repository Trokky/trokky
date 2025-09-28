import { Pool, PoolClient, type PoolConfig } from 'pg'
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
  SettingsConfig,
  createLogger,
  AuditContext,
  AuditActorType,
  AuditLog,
  AuditOperation,
  AUDIT_OPERATIONS,
  DataTransaction
} from '@trokky/core'
import type {
  PostgresDataAdapterConfig,
  DocumentRow,
  UserRow,
  AppTokenRow,
  AuditLogRow,
  WebhookRow,
  SettingsRow,
  MigrationRow
} from './types.js'

export class PostgresDataAdapter implements DataStorageAdapter {
  private config: Required<PostgresDataAdapterConfig>
  private pool: Pool
  private logger = createLogger('adapter', 'PostgresDataAdapter')
  private initialized = false

  // Security limits
  private readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly MAX_LIST_LIMIT = 1000

  constructor(config: PostgresDataAdapterConfig = {}) {
    this.config = {
      connection: config.connection || process.env.DATABASE_URL || 'postgresql://localhost:5432/trokky',
      pool: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ...config.pool
      },
      schema: config.schema || 'public',
      tablePrefix: config.tablePrefix || 'trokky_',
      autoMigrate: config.autoMigrate ?? true,
      enableQueryLogging: config.enableQueryLogging ?? false,
      ssl: config.ssl ?? false,
      connectionTimeout: config.connectionTimeout || 5000
    }

    // Initialize connection pool
    const poolConfig: PoolConfig = typeof this.config.connection === 'string'
      ? {
          connectionString: this.config.connection,
          ...this.config.pool,
          ...(this.config.ssl !== undefined && { ssl: this.config.ssl })
        }
      : {
          ...this.config.connection,
          ...this.config.pool,
          ...(this.config.ssl !== undefined && { ssl: this.config.ssl })
        }

    this.pool = new Pool(poolConfig)

    // Setup error handling
    this.pool.on('error', (err) => {
      this.logger.error('PostgreSQL pool error', err)
    })

    this.pool.on('connect', (client) => {
      if (this.config.enableQueryLogging) {
        this.logger.debug('New PostgreSQL client connected')
      }
    })
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Test connection
      await this.healthCheck()

      // Run migrations if enabled
      if (this.config.autoMigrate) {
        await this.runMigrations()
      }

      this.initialized = true
      this.logger.info('PostgreSQL adapter initialized successfully', {
        schema: this.config.schema,
        tablePrefix: this.config.tablePrefix
      })
    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL adapter', error)
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private tableName(entity: string): string {
    return `${this.config.schema}.${this.config.tablePrefix}${entity}`
  }

  private async query(text: string, params?: any[]): Promise<any> {
    await this.ensureInitialized()

    if (this.config.enableQueryLogging) {
      this.logger.debug('Executing query', { text, params })
    }

    try {
      const result = await this.pool.query(text, params)
      return result
    } catch (error) {
      this.logger.error('Query failed', { text, params, error })
      throw error
    }
  }

  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================

  async getDocument(collection: string, id: string): Promise<Document | null> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `SELECT * FROM ${this.tableName('documents')} WHERE collection = $1 AND id = $2`,
      [collection, id]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: DocumentRow = result.rows[0]
    return {
      _id: row.id,
      _collection: row.collection,
      _createdAt: row.created_at.toISOString(),
      _updatedAt: row.updated_at.toISOString(),
      _createdBy: row.created_by,
      _updatedBy: row.updated_by,
      ...row.data
    }
  }

  async saveDocument(
    collection: string,
    id: string,
    data: DocumentData,
    auditContext?: AuditContext
  ): Promise<Document> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)
    SecurityValidator.validateDocumentData(data)

    const dataJson = JSON.stringify(data)
    if (dataJson.length > this.MAX_DOCUMENT_SIZE) {
      throw new InvalidInputError(`Document exceeds maximum size of ${this.MAX_DOCUMENT_SIZE} bytes`)
    }

    const now = new Date()
    const userId = auditContext?.userId

    try {
      // Use UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
      const result = await this.query(`
        INSERT INTO ${this.tableName('documents')} (collection, id, data, created_at, updated_at, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $4, $5, $5)
        ON CONFLICT (collection, id)
        DO UPDATE SET
          data = $3,
          updated_at = $4,
          updated_by = $5
        RETURNING *
      `, [collection, id, data, now, userId])

      const row: DocumentRow = result.rows[0]

      // Create audit log if context provided
      if (auditContext) {
        await this.createAuditLog({
          documentId: id,
          collection,
          operation: AUDIT_OPERATIONS.UPDATE,
          actorType: auditContext.userType,
          actorId: auditContext.userId,
          actorUsername: auditContext.username,
          changes: { after: data },
          timestamp: now,
          revision: 1,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent
        })
      }

      return {
        _id: row.id,
        _collection: row.collection,
        _createdAt: row.created_at.toISOString(),
        _updatedAt: row.updated_at.toISOString(),
        _createdBy: row.created_by,
        _updatedBy: row.updated_by,
        ...row.data
      }
    } catch (error) {
      this.logger.error('Failed to save document', { collection, id, error })
      throw error
    }
  }

  async listDocuments(collection: string, options: ListOptions = {}): Promise<Document[]> {
    SecurityValidator.validateCollectionName(collection)

    const limit = Math.min(options.limit || 50, this.MAX_LIST_LIMIT)
    const offset = options.offset || 0

    let query = `SELECT * FROM ${this.tableName('documents')} WHERE collection = $1`
    const params: any[] = [collection]

    // Add filtering if provided
    if (options.filter) {
      // Simple JSONB filtering - can be enhanced for more complex queries
      Object.entries(options.filter).forEach(([key, value], index) => {
        query += ` AND data->>'${key}' = $${params.length + 1}`
        params.push(String(value))
      })
    }

    // Add sorting
    if (options.sort) {
      const sortFields = Array.isArray(options.sort) ? options.sort : [options.sort]
      const sortClauses = sortFields.map(sortField => {
        const [field, direction = 'asc'] = sortField.split(':')
        const sortDirection = direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC'

        if (field.startsWith('_')) {
          // System field
          const dbField = field === '_createdAt' ? 'created_at' :
                         field === '_updatedAt' ? 'updated_at' : 'id'
          return `${dbField} ${sortDirection}`
        } else {
          // Data field
          return `data->>'${field}' ${sortDirection}`
        }
      })
      query += ` ORDER BY ${sortClauses.join(', ')}`
    } else {
      query += ` ORDER BY updated_at DESC`
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await this.query(query, params)

    return result.rows.map((row: DocumentRow) => ({
      _id: row.id,
      _collection: row.collection,
      _createdAt: row.created_at.toISOString(),
      _updatedAt: row.updated_at.toISOString(),
      _createdBy: row.created_by,
      _updatedBy: row.updated_by,
      ...row.data
    }))
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `DELETE FROM ${this.tableName('documents')} WHERE collection = $1 AND id = $2`,
      [collection, id]
    )

    if (result.rowCount === 0) {
      throw new InvalidInputError(`Document ${collection}:${id} not found`)
    }
  }

  async documentExists(collection: string, id: string): Promise<boolean> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `SELECT 1 FROM ${this.tableName('documents')} WHERE collection = $1 AND id = $2 LIMIT 1`,
      [collection, id]
    )

    return result.rows.length > 0
  }

  async countDocuments(collection: string, filter?: Record<string, unknown>): Promise<number> {
    SecurityValidator.validateCollectionName(collection)

    let query = `SELECT COUNT(*) as count FROM ${this.tableName('documents')} WHERE collection = $1`
    const params: any[] = [collection]

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query += ` AND data->>'${key}' = $${params.length + 1}`
        params.push(String(value))
      })
    }

    const result = await this.query(query, params)
    return parseInt(result.rows[0].count, 10)
  }

  // ==========================================================================
  // AUDIT LOG OPERATIONS
  // ==========================================================================

  async createAuditLog(auditLog: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const result = await this.query(`
      INSERT INTO ${this.tableName('audit_logs')}
      (id, operation, resource_type, resource_id, actor_type, actor_id, changes, metadata, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      id,
      auditLog.operation,
      auditLog.collection,
      auditLog.documentId,
      auditLog.actorType,
      auditLog.actorId,
      auditLog.changes,
      auditLog.metadata || {},
      auditLog.timestamp
    ])

    const row: AuditLogRow = result.rows[0]
    return {
      id: row.id,
      documentId: row.resource_id,
      collection: row.resource_type,
      operation: row.operation as AuditOperation,
      actorType: row.actor_type as AuditActorType,
      actorId: row.actor_id,
      actorUsername: auditLog.actorUsername,
      changes: row.changes,
      timestamp: row.timestamp,
      revision: auditLog.revision,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      sessionId: auditLog.sessionId,
      metadata: row.metadata
    }
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as health')
      return result.rows[0].health === 1
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  async getStorageInfo(): Promise<{
    collections: string[]
    documentCount: number
    userCount: number
    tokenCount: number
    storageSize?: number
    [key: string]: unknown
  }> {
    const [collectionsResult, docsResult, usersResult, tokensResult] = await Promise.all([
      this.query(`SELECT DISTINCT collection FROM ${this.tableName('documents')}`),
      this.query(`SELECT COUNT(*) as count FROM ${this.tableName('documents')}`),
      this.query(`SELECT COUNT(*) as count FROM ${this.tableName('users')}`),
      this.query(`SELECT COUNT(*) as count FROM ${this.tableName('app_tokens')}`)
    ])

    return {
      collections: collectionsResult.rows.map((row: any) => row.collection),
      documentCount: parseInt(docsResult.rows[0].count, 10),
      userCount: parseInt(usersResult.rows[0].count, 10),
      tokenCount: parseInt(tokensResult.rows[0].count, 10),
      database: 'postgresql'
    }
  }

  async beginTransaction(): Promise<PostgresTransaction> {
    const client = await this.pool.connect()
    await client.query('BEGIN')
    return new PostgresTransaction(client)
  }

  // ==========================================================================
  // USER OPERATIONS (Placeholder - to be implemented)
  // ==========================================================================

  async getUser(id: string): Promise<User | null> {
    // TODO: Implement user operations
    throw new Error('User operations not yet implemented')
  }

  async saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User> {
    throw new Error('User operations not yet implemented')
  }

  async listUsers(options?: UserListOptions): Promise<User[]> {
    throw new Error('User operations not yet implemented')
  }

  async deleteUser(id: string): Promise<void> {
    throw new Error('User operations not yet implemented')
  }

  async getUserByUsername(username: string): Promise<User | null> {
    throw new Error('User operations not yet implemented')
  }

  async getUserByEmail(email: string): Promise<User | null> {
    throw new Error('User operations not yet implemented')
  }

  // ==========================================================================
  // APP TOKEN OPERATIONS (Placeholder - to be implemented)
  // ==========================================================================

  async getAppToken(id: string): Promise<AppToken | null> {
    throw new Error('App token operations not yet implemented')
  }

  async saveAppToken(id: string, tokenData: CreateAppTokenData | Partial<UpdateAppTokenData>): Promise<AppToken> {
    throw new Error('App token operations not yet implemented')
  }

  async listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]> {
    throw new Error('App token operations not yet implemented')
  }

  async deleteAppToken(id: string): Promise<void> {
    throw new Error('App token operations not yet implemented')
  }

  async getAppTokenByHash(hash: string): Promise<AppToken | null> {
    throw new Error('App token operations not yet implemented')
  }

  // ==========================================================================
  // MIGRATION SUPPORT
  // ==========================================================================

  private async runMigrations(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('migrations')} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(255) NOT NULL
      )
    `)

    // Run initial schema migrations
    await this.createTables()
  }

  private async createTables(): Promise<void> {
    // Documents table
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('documents')} (
        collection VARCHAR(255) NOT NULL,
        id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        PRIMARY KEY (collection, id)
      )
    `)

    // Create indexes for better performance
    await this.query(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_collection_idx
      ON ${this.tableName('documents')} (collection)
    `)

    await this.query(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_updated_at_idx
      ON ${this.tableName('documents')} (updated_at DESC)
    `)

    await this.query(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_data_gin_idx
      ON ${this.tableName('documents')} USING GIN (data)
    `)

    // Audit logs table
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('audit_logs')} (
        id VARCHAR(255) PRIMARY KEY,
        operation VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255) NOT NULL,
        actor_type VARCHAR(50) NOT NULL,
        actor_id VARCHAR(255) NOT NULL,
        changes JSONB,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `)

    await this.query(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}audit_logs_resource_idx
      ON ${this.tableName('audit_logs')} (resource_type, resource_id)
    `)

    await this.query(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}audit_logs_timestamp_idx
      ON ${this.tableName('audit_logs')} (timestamp DESC)
    `)

    this.logger.info('Database tables created successfully')
  }
}

/**
 * PostgreSQL transaction implementation
 */
export class PostgresTransaction implements DataTransaction {
  constructor(private client: PoolClient) {}

  async commit(): Promise<void> {
    try {
      await this.client.query('COMMIT')
    } finally {
      this.client.release()
    }
  }

  async rollback(): Promise<void> {
    try {
      await this.client.query('ROLLBACK')
    } finally {
      this.client.release()
    }
  }

  async execute<T>(operations: () => Promise<T>): Promise<T> {
    try {
      return await operations()
    } catch (error) {
      await this.rollback()
      throw error
    }
  }
}