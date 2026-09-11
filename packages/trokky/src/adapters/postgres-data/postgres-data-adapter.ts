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
  AuthFlowState,
  SettingsConfig,
  createLogger,
  AuditContext,
  AuditActorType,
  AuditLog,
  AuditOperation,
  AUDIT_OPERATIONS,
  DataTransaction
} from '../../core/index.js'
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

/**
 * Serialise a value for a JSONB column. `undefined` and `null` both become SQL NULL, which
 * reads back as `undefined` — an unset field is never stored as `'{}'` or `'[]'`.
 */
function jsonColumnValue(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value)
}

export class PostgresDataAdapter implements DataStorageAdapter {
  private config: Required<PostgresDataAdapterConfig>
  private pool: Pool
  private logger = createLogger('adapter', 'PostgresDataAdapter')
  private initialized = false
  private initializationPromise: Promise<void> | null = null
  private closePromise: Promise<void> | null = null

  // Security limits
  private readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly MAX_LIST_LIMIT = 1000

  constructor(config: PostgresDataAdapterConfig = {}) {
    // Security: Validate schema and table prefix to prevent SQL injection
    const schemaPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    const prefixPattern = /^[a-zA-Z0-9_]*$/

    const schema = config.schema || 'public'
    const tablePrefix = config.tablePrefix || 'trokky_'

    if (!schemaPattern.test(schema)) {
      throw new Error(`Invalid PostgreSQL schema name: "${schema}". Schema names must start with a letter or underscore and contain only alphanumeric characters and underscores.`)
    }
    if (!prefixPattern.test(tablePrefix)) {
      throw new Error(`Invalid table prefix: "${tablePrefix}". Table prefixes must contain only alphanumeric characters and underscores.`)
    }

    this.config = {
      connection: config.connection || process.env.DATABASE_URL || 'postgresql://localhost:5432/trokky',
      pool: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ...config.pool
      },
      schema,
      tablePrefix,
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
      this.logger.debug('New PostgreSQL client connected')
    })

    this.logger.info('PostgresDataAdapter constructed', {
      schema: this.config.schema,
      tablePrefix: this.config.tablePrefix,
      autoMigrate: this.config.autoMigrate,
      enableQueryLogging: this.config.enableQueryLogging
    })

    // Initialize immediately like filesystem adapter - but async
    // Store initialization promise for later awaiting
    if (this.config.autoMigrate) {
      this.logger.info('Starting PostgreSQL auto-migration during construction')
      this.initializationPromise = this.initialize()
      // Start initialization but don't block construction
      this.initializationPromise
        .then(() => {
          this.logger.info('PostgreSQL adapter initialization completed successfully during construction')
        })
        .catch(error => {
          this.logger.error('Failed to initialize PostgreSQL adapter during construction', error)
        })
    } else {
      this.logger.info('PostgreSQL auto-migration disabled in config')
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('PostgreSQL adapter already initialized, skipping')
      return
    }

    this.logger.info('Starting PostgreSQL adapter initialization')

    try {
      // Test connection
      this.logger.info('Testing PostgreSQL connection...')
      const isHealthy = await this.healthCheck()
      this.logger.info('PostgreSQL connection test result', { healthy: isHealthy })

      // Run migrations if enabled
      if (this.config.autoMigrate) {
        this.logger.info('Running PostgreSQL migrations...')
        await this.runMigrations()
        this.logger.info('PostgreSQL migrations completed')
      } else {
        this.logger.info('PostgreSQL auto-migration disabled, skipping migrations')
      }

      this.initialized = true
      this.logger.info('✅ PostgreSQL adapter initialized successfully', {
        schema: this.config.schema,
        tablePrefix: this.config.tablePrefix,
        autoMigrate: this.config.autoMigrate
      })
    } catch (error) {
      this.logger.error('❌ Failed to initialize PostgreSQL adapter', error)
      throw error
    }
  }

  /**
   * Close the connection pool. Until this runs the pool's idle clients keep the event loop
   * alive, so a process that stops its HTTP server never exits and a test file leaks its
   * sockets into the next one.
   *
   * `pool.end()` throws if it is called a second time, and shutdown paths do get entered
   * twice (a SIGTERM arriving while a manual stop is already in flight), so the first call's
   * promise is remembered and replayed rather than re-ending the pool.
   */
  async close(): Promise<void> {
    if (!this.closePromise) {
      this.closePromise = this.pool.end()
      this.closePromise.then(
        () => this.logger.info('PostgreSQL connection pool closed'),
        error => this.logger.error('Error closing PostgreSQL connection pool', error)
      )
    }
    return this.closePromise
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      // If we have an initialization promise from constructor, await it
      if (this.initializationPromise) {
        await this.initializationPromise
      } else {
        // Fallback: initialize now if not done during construction
        await this.initialize()
      }
    }
  }

  private tableName(entity: string): string {
    return `${this.config.schema}.${this.config.tablePrefix}${entity}`
  }

  private async query(text: string, params?: any[]): Promise<any> {
    await this.ensureInitialized()

    if (this.config.enableQueryLogging) {
      this.logger.debug('Executing query', { text, paramCount: params?.length ?? 0 })
    }

    try {
      const result = await this.pool.query(text, params)
      return result
    } catch (error) {
      this.logger.error('Query failed', { text, paramCount: params?.length ?? 0, error })
      throw error
    }
  }

  private async directQuery(text: string, params?: any[]): Promise<any> {
    // Direct query without ensureInitialized() - used during initialization
    if (this.config.enableQueryLogging) {
      this.logger.debug('Executing direct query', { text, paramCount: params?.length ?? 0 })
    }

    try {
      const result = await this.pool.query(text, params)
      return result
    } catch (error) {
      this.logger.error('Direct query failed', { text, paramCount: params?.length ?? 0, error })
      throw error
    }
  }

  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================

  /**
   * Shared shape for every document read path, so get/save/list cannot drift apart.
   *
   * `_status` lives inside the JSONB payload, so it is pulled out of the data and re-emitted as
   * a metadata field with the same `'draft'` fallback the filesystem adapter applies; the rest of
   * the user data is spread last, exactly as the filesystem adapter does. SQL NULLs become
   * `undefined` — the contract never returns `null` for an unknown actor.
   */
  private mapRowToDocument(row: DocumentRow): Document {
    const { _status, ...data } = (row.data ?? {}) as Record<string, unknown>

    return {
      id: row.id,
      _id: row.id,
      _collection: row.collection,
      _createdAt: row.created_at,
      _updatedAt: row.updated_at,
      _revision: row.revision ?? 1,
      _status: (_status as Document['_status']) ?? 'draft',
      _createdBy: row.created_by ?? undefined,
      _updatedBy: row.updated_by ?? undefined,
      _createdByType: (row.created_by_type as AuditActorType | null) ?? undefined,
      _updatedByType: (row.updated_by_type as AuditActorType | null) ?? undefined,
      ...data
    }
  }

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

    return this.mapRowToDocument(result.rows[0])
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
    const userType = auditContext?.userType

    try {
      // UPSERT (INSERT ... ON CONFLICT ... DO UPDATE). `_status` is defaulted in SQL so the
      // create/update distinction is decided by the same statement that performs the write:
      // an explicit incoming status wins, otherwise the stored one is preserved on update and
      // 'draft' is used on create. `created_by`/`created_by_type` are left out of the SET list,
      // so the original creator survives an update (filesystem behaviour).
      const result = await this.query(`
        INSERT INTO ${this.tableName('documents')}
          (collection, id, data, created_at, updated_at, created_by, updated_by, created_by_type, updated_by_type, revision)
        VALUES (
          $1, $2,
          $3::jsonb || jsonb_build_object('_status', COALESCE($3::jsonb->>'_status', 'draft')),
          $4, $4, $5, $5, $6, $6, 1
        )
        ON CONFLICT (collection, id)
        DO UPDATE SET
          data = $3::jsonb || jsonb_build_object('_status', COALESCE($3::jsonb->>'_status', ${this.config.tablePrefix}documents.data->>'_status', 'draft')),
          updated_at = $4,
          updated_by = $5,
          updated_by_type = $6,
          revision = COALESCE(${this.config.tablePrefix}documents.revision, 1) + 1
        RETURNING *
      `, [collection, id, JSON.stringify(data), now, userId, userType])

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
          revision: row.revision ?? 1,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent
        })
      }

      return this.mapRowToDocument(row)
    } catch (error) {
      this.logger.error('Failed to save document', { collection, id, error })
      throw error
    }
  }

  /**
   * Document fields that live in their own column rather than inside the JSONB payload.
   * Anything not listed here — including `_status` and any other leading-underscore field the
   * schema happens to define — is addressed through `data`.
   */
  private static readonly DOCUMENT_SYSTEM_COLUMNS: Record<string, string> = {
    id: 'id',
    _id: 'id',
    _revision: 'revision',
    _createdAt: 'created_at',
    _updatedAt: 'updated_at',
    _createdBy: 'created_by',
    _updatedBy: 'updated_by',
    _createdByType: 'created_by_type',
    _updatedByType: 'updated_by_type'
  }

  /** SECURITY: field names reach the SQL text directly, so they are whitelisted first. */
  private static readonly DOCUMENT_FIELD_PATTERN = /^[a-zA-Z0-9_.\-]+$/

  /** Updatable user columns, in the order they are written. `json` columns are JSONB. */
  private static readonly USER_UPDATE_COLUMNS: ReadonlyArray<{ key: string; column: string; json?: boolean }> = [
    { key: 'username', column: 'username' },
    { key: 'email', column: 'email' },
    { key: 'passwordHash', column: 'password_hash' },
    { key: 'firstName', column: 'first_name' },
    { key: 'lastName', column: 'last_name' },
    { key: 'role', column: 'role' },
    { key: 'permissions', column: 'permissions', json: true },
    { key: 'isActive', column: 'is_active' },
    { key: 'profileImage', column: 'profile_image' },
    { key: 'preferences', column: 'preferences', json: true },
    { key: 'oauthProviders', column: 'oauth_providers', json: true },
    { key: 'mfa', column: 'mfa', json: true },
    { key: 'passkeys', column: 'passkeys', json: true },
    { key: 'lastLoginAt', column: 'last_login_at' }
  ]

  /**
   * Filter clauses shared by listDocuments and countDocuments, so the two cannot disagree
   * about what a filter means. Data fields are compared as `jsonb`, not as text: `String(value)`
   * turned `false`, `0` and `null` into strings that never matched anything.
   */
  private buildDocumentFilterClauses(filter: Record<string, unknown>, params: any[]): string[] {
    return Object.entries(filter).map(([key, value]) => {
      // SECURITY: Validate field name to prevent SQL injection
      // Allow only alphanumeric, underscore, dash, and dot (for nested fields)
      if (!PostgresDataAdapter.DOCUMENT_FIELD_PATTERN.test(key)) {
        throw new Error(`Invalid filter field name: ${key}`)
      }

      const column = PostgresDataAdapter.DOCUMENT_SYSTEM_COLUMNS[key]
      if (column) {
        if (value === null || value === undefined) {
          return `${column} IS NULL`
        }
        params.push(value)
        return `${column} = $${params.length}`
      }

      // Data field (including _status, which is stored inside the payload)
      params.push(key)
      const keyParam = `$${params.length}::text`
      params.push(JSON.stringify(value ?? null))
      return `data->${keyParam} = $${params.length}::jsonb`
    })
  }

  /**
   * Accepts both sort grammars the API surfaces: `-field` (leading minus = descending) and
   * `field.asc` / `field.desc`. The direction is stripped before the field name is validated,
   * otherwise `-title` reads as a field literally named `-title`.
   */
  private buildDocumentSortClause(rawSortField: string): string {
    let field = rawSortField.trim()
    let direction: 'ASC' | 'DESC' = 'ASC'

    if (field.startsWith('-')) {
      direction = 'DESC'
      field = field.slice(1)
    } else {
      const dotted = /^(.+)\.(asc|desc)$/i.exec(field)
      if (dotted) {
        field = dotted[1]
        direction = dotted[2].toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      }
    }

    // SECURITY: Validate field name to prevent SQL injection
    if (!PostgresDataAdapter.DOCUMENT_FIELD_PATTERN.test(field)) {
      throw new Error(`Invalid sort field name: ${field}`)
    }

    // Data fields are ordered by the stored jsonb value (`->`), not by its text rendering
    // (`->>`): as text, 13 sorts before 2. jsonb ordering compares numbers numerically and
    // strings by collation, which is what the filesystem adapter's `<` / `>` on the parsed
    // JS values does for a homogeneously-typed field.
    const column = PostgresDataAdapter.DOCUMENT_SYSTEM_COLUMNS[field] ?? `data->'${field}'`
    return `${column} ${direction}`
  }

  async listDocuments(collection: string, options: ListOptions = {}): Promise<Document[]> {
    SecurityValidator.validateCollectionName(collection)

    // No implicit default: an unbounded list returns everything up to the hard cap
    const limit = Math.min(options.limit ?? this.MAX_LIST_LIMIT, this.MAX_LIST_LIMIT)
    const offset = options.offset || 0

    let query = `SELECT * FROM ${this.tableName('documents')} WHERE collection = $1`
    const params: any[] = [collection]

    if (options.filter) {
      const clauses = this.buildDocumentFilterClauses(options.filter, params)
      if (clauses.length > 0) {
        query += ` AND ${clauses.join(' AND ')}`
      }
    }

    if (options.sort) {
      const sortFields = Array.isArray(options.sort) ? options.sort : [options.sort]
      query += ` ORDER BY ${sortFields.map(field => this.buildDocumentSortClause(field)).join(', ')}`
    } else {
      query += ` ORDER BY created_at DESC`
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    this.logger.debug('Listing documents', { collection, query, paramCount: params.length })

    const result = await this.query(query, params)

    return result.rows.map((row: DocumentRow) => this.mapRowToDocument(row))
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
      // Same clause builder as listDocuments: same field validation, same jsonb equality,
      // same system-field column mapping
      const clauses = this.buildDocumentFilterClauses(filter, params)
      if (clauses.length > 0) {
        query += ` AND ${clauses.join(' AND ')}`
      }
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

  /**
   * Get audit logs for a specific document
   */
  async getDocumentAuditLogs(documentId: string, options: { limit?: number; offset?: number } = {}): Promise<AuditLog[]> {
    const limit = options.limit || 100
    const offset = options.offset || 0

    const result = await this.query(`
      SELECT * FROM ${this.tableName('audit_logs')}
      WHERE resource_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `, [documentId, limit, offset])

    return result.rows.map((row: AuditLogRow) => ({
      id: row.id,
      documentId: row.resource_id,
      collection: row.resource_type,
      operation: row.operation as AuditOperation,
      actorType: row.actor_type as AuditActorType,
      actorId: row.actor_id,
      changes: row.changes,
      timestamp: row.timestamp,
      metadata: row.metadata
    }))
  }

  /**
   * Get audit logs for a collection
   */
  async getCollectionAuditLogs(collection: string, options: { limit?: number; offset?: number } = {}): Promise<AuditLog[]> {
    const limit = options.limit || 100
    const offset = options.offset || 0

    const result = await this.query(`
      SELECT * FROM ${this.tableName('audit_logs')}
      WHERE resource_type = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `, [collection, limit, offset])

    return result.rows.map((row: AuditLogRow) => ({
      id: row.id,
      documentId: row.resource_id,
      collection: row.resource_type,
      operation: row.operation as AuditOperation,
      actorType: row.actor_type as AuditActorType,
      actorId: row.actor_id,
      changes: row.changes,
      timestamp: row.timestamp,
      metadata: row.metadata
    }))
  }

  /**
   * Get audit logs by actor
   */
  async getActorAuditLogs(actorId: string, options: { limit?: number; offset?: number } = {}): Promise<AuditLog[]> {
    const limit = options.limit || 100
    const offset = options.offset || 0

    const result = await this.query(`
      SELECT * FROM ${this.tableName('audit_logs')}
      WHERE actor_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `, [actorId, limit, offset])

    return result.rows.map((row: AuditLogRow) => ({
      id: row.id,
      documentId: row.resource_id,
      collection: row.resource_type,
      operation: row.operation as AuditOperation,
      actorType: row.actor_type as AuditActorType,
      actorId: row.actor_id,
      changes: row.changes,
      timestamp: row.timestamp,
      metadata: row.metadata
    }))
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
  // USER OPERATIONS
  // ==========================================================================

  async getUser(id: string): Promise<User | null> {
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `SELECT * FROM ${this.tableName('users')} WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: UserRow = result.rows[0]
    return this.mapRowToUser(row)
  }

  async saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User> {
    SecurityValidator.validateDocumentId(id)

    const now = new Date().toISOString()

    try {
      // Check if this is an update (user exists) or create (new user)
      const existingUser = await this.getUser(id)

      if (existingUser) {
        // Update existing user
        const result = await this.updateUserRow(id, userData as Partial<UpdateUserData>, now)

        const row: UserRow = result.rows[0]
        return this.mapRowToUser(row)
      } else {
        // Create new user
        const createData = userData as CreateUserData
        // Use passwordHash from caller (like filesystem adapter)
        const passwordHash = (createData as any).passwordHash || ''

        // Every supplied field is persisted: a restore writes a user in one create, and
        // hardcoding oauth_providers/mfa/passkeys or dropping lastLoginAt silently lost them.
        // Fields that were not supplied are stored as SQL NULL (not '{}' / '[]') so they read
        // back as undefined rather than as an empty value the caller never asked for.
        const result = await this.query(`
          INSERT INTO ${this.tableName('users')}
          (id, username, email, password_hash, first_name, last_name, role, permissions, is_active, profile_image, preferences, oauth_providers, mfa, passkeys, last_login_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
          RETURNING *
        `, [
          id,
          createData.username,
          createData.email,
          passwordHash,
          createData.firstName,
          createData.lastName,
          createData.role,
          JSON.stringify(createData.permissions ?? []),
          createData.isActive ?? true,
          createData.profileImage ?? null,
          jsonColumnValue(createData.preferences),
          jsonColumnValue((createData as any).oauthProviders),
          jsonColumnValue((createData as any).mfa),
          jsonColumnValue((createData as any).passkeys),
          (createData as any).lastLoginAt ?? null,
          now
        ])

        const row: UserRow = result.rows[0]
        return this.mapRowToUser(row)
      }
    } catch (error) {
      this.logger.error('Failed to save user', { id, userData, error })
      throw error
    }
  }

  async saveUserIf(
    id: string,
    userData: Partial<UpdateUserData>,
    condition: { passwordHash: string }
  ): Promise<User | null> {
    SecurityValidator.validateDocumentId(id)

    try {
      const result = await this.updateUserRow(id, userData, new Date().toISOString(), condition.passwordHash)

      if (!result.rowCount) {
        return null
      }

      const row: UserRow = result.rows[0]
      return this.mapRowToUser(row)
    } catch (error) {
      this.logger.error('Failed to conditionally save user', { id, error })
      throw error
    }
  }

  /**
   * Shared UPDATE for user rows. When expectedPasswordHash is provided the
   * write only applies while the stored hash still matches, in one statement.
   *
   * The SET list is built from the keys actually present in `updateData`. The previous
   * `COALESCE($n, col)` form could not tell "omitted" from "explicitly null", so clearing a
   * field was impossible: an explicit `null` silently kept the old value.
   */
  private async updateUserRow(
    id: string,
    updateData: Partial<UpdateUserData>,
    now: string,
    expectedPasswordHash?: string
  ): Promise<any> {
    const params: any[] = [id]
    const assignments: string[] = []

    for (const { key, column, json } of PostgresDataAdapter.USER_UPDATE_COLUMNS) {
      // An absent key and an explicit `undefined` both mean "unchanged"; an explicit `null`
      // writes NULL and clears the field.
      if (!Object.prototype.hasOwnProperty.call(updateData, key)) {
        continue
      }
      const value = (updateData as Record<string, unknown>)[key]
      if (value === undefined) {
        continue
      }

      params.push(json ? jsonColumnValue(value) : value)
      assignments.push(`${column} = $${params.length}`)
    }

    params.push(now)
    assignments.push(`updated_at = $${params.length}`)

    let condition = ''
    if (expectedPasswordHash !== undefined) {
      params.push(expectedPasswordHash)
      condition = ` AND password_hash = $${params.length}`
    }

    return await this.query(`
      UPDATE ${this.tableName('users')}
      SET
        ${assignments.join(',\n        ')}
      WHERE id = $1${condition}
      RETURNING *
    `, params)
  }

  async listUsers(options: UserListOptions = {}): Promise<User[]> {
    // No implicit default: an unbounded list returns everything up to the hard cap
    const limit = Math.min(options.limit ?? this.MAX_LIST_LIMIT, this.MAX_LIST_LIMIT)
    const offset = options.offset || 0

    let query = `SELECT * FROM ${this.tableName('users')}`
    const params: any[] = []
    const conditions: string[] = []

    // Add filtering
    if (options.role) {
      conditions.push(`role = $${params.length + 1}`)
      params.push(options.role)
    }

    if (options.isActive !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`)
      params.push(options.isActive)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await this.query(query, params)

    return result.rows.map((row: UserRow) => this.mapRowToUser(row))
  }

  async deleteUser(id: string): Promise<void> {
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `DELETE FROM ${this.tableName('users')} WHERE id = $1`,
      [id]
    )

    if (result.rowCount === 0) {
      throw new InvalidInputError(`User ${id} not found`)
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username || typeof username !== 'string') {
      throw new InvalidInputError('Username is required')
    }

    const result = await this.query(
      `SELECT * FROM ${this.tableName('users')} WHERE username = $1`,
      [username]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: UserRow = result.rows[0]
    return this.mapRowToUser(row)
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!email || typeof email !== 'string') {
      throw new InvalidInputError('Email is required')
    }

    const result = await this.query(
      `SELECT * FROM ${this.tableName('users')} WHERE email = $1`,
      [email]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: UserRow = result.rows[0]
    return this.mapRowToUser(row)
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username)
    return user === null
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email)
    return user === null
  }

  async getUserByOAuthProvider(provider: string, providerId: string): Promise<User | null> {
    if (!provider || !providerId) {
      return null
    }

    // Query using JSONB containment operator to find user with matching OAuth provider
    const result = await this.query(
      `SELECT * FROM ${this.tableName('users')}
       WHERE oauth_providers @> $1::jsonb`,
      [JSON.stringify([{ provider, providerId }])]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: UserRow = result.rows[0]
    return this.mapRowToUser(row)
  }

  async getUserByPasskeyCredentialId(credentialId: string): Promise<User | null> {
    if (!credentialId || typeof credentialId !== 'string') {
      return null
    }

    // Security: Validate credential ID format (base64url)
    // Base64url uses A-Z, a-z, 0-9, -, and _ characters
    if (!/^[A-Za-z0-9_-]+$/.test(credentialId)) {
      this.logger.warn('Invalid passkey credential ID format', {
        credentialIdPrefix: credentialId.substring(0, 8)
      })
      return null
    }

    // Query using JSONB containment operator to find user with matching passkey credential ID
    const result = await this.query(
      `SELECT * FROM ${this.tableName('users')}
       WHERE passkeys @> $1::jsonb`,
      [JSON.stringify([{ id: credentialId }])]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: UserRow = result.rows[0]
    return this.mapRowToUser(row)
  }

  /** Every nullable column is mapped to `undefined`: the contract never surfaces `null`. */
  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as any,
      // Created users always get `[]`; only an update that explicitly clears permissions
      // leaves NULL behind, and a cleared field reads back as undefined
      permissions: (row.permissions ?? undefined) as any[],
      isActive: row.is_active,
      profileImage: row.profile_image ?? undefined,
      preferences: (row.preferences as any) ?? undefined,
      oauthProviders: (row.oauth_providers as any[]) ?? undefined,
      mfa: (row.mfa as any) ?? undefined,
      passkeys: (row.passkeys as any[]) ?? undefined,
      lastLoginAt: row.last_login_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  // ==========================================================================
  // APP TOKEN OPERATIONS
  // ==========================================================================

  async getAppToken(id: string): Promise<AppToken | null> {
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `SELECT * FROM ${this.tableName('app_tokens')} WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: AppTokenRow = result.rows[0]
    return this.mapRowToAppToken(row)
  }

  async saveAppToken(id: string, tokenData: CreateAppTokenData | Partial<UpdateAppTokenData>): Promise<AppToken> {
    SecurityValidator.validateDocumentId(id)

    const now = new Date()

    try {
      // Check if this is an update (token exists) or create (new token)
      const existingToken = await this.getAppToken(id)

      if (existingToken) {
        // Update existing token
        const updateData = tokenData as Partial<UpdateAppTokenData>
        const result = await this.query(`
          UPDATE ${this.tableName('app_tokens')}
          SET
            name = COALESCE($2, name),
            permissions = COALESCE($3, permissions),
            is_active = COALESCE($4, is_active),
            expires_at = COALESCE($5, expires_at),
            updated_at = $6
          WHERE id = $1
          RETURNING *
        `, [
          id,
          updateData.name,
          JSON.stringify(updateData.permissions || []),
          updateData.isActive,
          updateData.expiresAt ? new Date(updateData.expiresAt) : null,
          now
        ])

        const row: AppTokenRow = result.rows[0]
        return this.mapRowToAppToken(row)
      } else {
        // Create new token
        const createData = tokenData as CreateAppTokenData
        // Use tokenHash from caller (this should be set by the calling code)
        const tokenHash = (createData as any).tokenHash || ''
        const createdBy = (createData as any).createdBy || 'system'

        const result = await this.query(`
          INSERT INTO ${this.tableName('app_tokens')}
          (id, name, hash, permissions, created_by, is_active, expires_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
          RETURNING *
        `, [
          id,
          createData.name,
          tokenHash,
          JSON.stringify(createData.permissions || []),
          createdBy,
          true,
          createData.expiresAt ? new Date(createData.expiresAt) : null,
          now
        ])

        const row: AppTokenRow = result.rows[0]
        return this.mapRowToAppToken(row)
      }
    } catch (error) {
      this.logger.error('Failed to save app token', { id, fields: Object.keys(tokenData), error })
      throw error
    }
  }

  async listAppTokens(options: AppTokenListOptions = {}): Promise<AppToken[]> {
    const limit = Math.min(options.limit || 50, this.MAX_LIST_LIMIT)
    const offset = options.offset || 0

    let query = `SELECT * FROM ${this.tableName('app_tokens')}`
    const params: any[] = []
    const conditions: string[] = []

    // Add filtering
    if (options.createdBy) {
      conditions.push(`created_by = $${params.length + 1}`)
      params.push(options.createdBy)
    }

    if (options.isActive !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`)
      params.push(options.isActive)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await this.query(query, params)

    return result.rows.map((row: AppTokenRow) => this.mapRowToAppToken(row))
  }

  async deleteAppToken(id: string): Promise<void> {
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `DELETE FROM ${this.tableName('app_tokens')} WHERE id = $1`,
      [id]
    )

    if (result.rowCount === 0) {
      throw new InvalidInputError(`App token ${id} not found`)
    }
  }

  async getAppTokenByHash(hash: string): Promise<AppToken | null> {
    if (!hash || typeof hash !== 'string') {
      throw new InvalidInputError('Token hash is required')
    }

    const result = await this.query(
      `SELECT * FROM ${this.tableName('app_tokens')} WHERE hash = $1 AND is_active = true`,
      [hash]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: AppTokenRow = result.rows[0]

    // Update last_used_at
    await this.query(
      `UPDATE ${this.tableName('app_tokens')} SET last_used_at = $1 WHERE id = $2`,
      [new Date(), row.id]
    )

    return this.mapRowToAppToken(row)
  }

  private mapRowToAppToken(row: AppTokenRow): AppToken {
    return {
      id: row.id,
      name: row.name,
      description: '', // Not stored in current schema, could be added
      tokenHash: row.hash,
      permissions: row.permissions as any[],
      createdBy: row.created_by,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : undefined,
      usageCount: 0, // Not tracked in current schema, could be added
      expiresAt: row.expires_at ? row.expires_at.toISOString() : undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }
  }

  // ==========================================================================
  // MIGRATION SUPPORT
  // ==========================================================================

  private async runMigrations(): Promise<void> {
    this.logger.info('Creating migrations tracking table...')
    // Create migrations table if it doesn't exist
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('migrations')} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(255) NOT NULL
      )
    `)

    this.logger.info('Running initial schema migrations...')
    // Run initial schema migrations
    await this.createTables()
    this.logger.info('Schema migrations completed')
  }

  private async createTables(): Promise<void> {
    this.logger.info('Creating documents table...')
    // Documents table
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('documents')} (
        collection VARCHAR(255) NOT NULL,
        id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_by_type VARCHAR(50),
        updated_by_type VARCHAR(50),
        revision INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (collection, id)
      )
    `)

    // Migrations for databases created before revision / actor-type tracking existed.
    // ADD COLUMN IF NOT EXISTS keeps them safe to re-run on every boot.
    for (const [column, definition] of [
      ['revision', 'INTEGER NOT NULL DEFAULT 1'],
      ['created_by_type', 'VARCHAR(50)'],
      ['updated_by_type', 'VARCHAR(50)']
    ]) {
      await this.directQuery(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = '${this.config.schema}'
            AND table_name = '${this.config.tablePrefix}documents'
            AND column_name = '${column}'
          ) THEN
            ALTER TABLE ${this.tableName('documents')}
            ADD COLUMN IF NOT EXISTS ${column} ${definition};
          END IF;
        END $$
      `)
    }

    this.logger.info('Creating performance indexes for documents...')
    // Create indexes for better performance
    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_collection_idx
      ON ${this.tableName('documents')} (collection)
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_updated_at_idx
      ON ${this.tableName('documents')} (updated_at DESC)
    `)

    // The default list order is created_at DESC
    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_created_at_idx
      ON ${this.tableName('documents')} (created_at DESC)
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}documents_data_gin_idx
      ON ${this.tableName('documents')} USING GIN (data)
    `)

    this.logger.info('Creating audit logs table...')
    // Audit logs table
    await this.directQuery(`
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

    this.logger.info('Creating performance indexes for audit logs...')
    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}audit_logs_resource_idx
      ON ${this.tableName('audit_logs')} (resource_type, resource_id)
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}audit_logs_timestamp_idx
      ON ${this.tableName('audit_logs')} (timestamp DESC)
    `)

    this.logger.info('Creating users table...')
    // Users table
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('users')} (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        permissions JSONB DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        profile_image VARCHAR(500),
        last_login_at VARCHAR(50),
        preferences JSONB DEFAULT '{}',
        oauth_providers JSONB DEFAULT '[]',
        mfa JSONB DEFAULT '{}',
        passkeys JSONB DEFAULT '[]',
        created_at VARCHAR(50) NOT NULL,
        updated_at VARCHAR(50) NOT NULL
      )
    `)

    // Migration: Add oauth_providers column if it doesn't exist (for existing databases)
    await this.directQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${this.config.schema}'
          AND table_name = '${this.config.tablePrefix}users'
          AND column_name = 'oauth_providers'
        ) THEN
          ALTER TABLE ${this.tableName('users')}
          ADD COLUMN oauth_providers JSONB DEFAULT '[]';
        END IF;
      END $$
    `)

    // Migration: Add mfa column if it doesn't exist (for existing databases)
    await this.directQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${this.config.schema}'
          AND table_name = '${this.config.tablePrefix}users'
          AND column_name = 'mfa'
        ) THEN
          ALTER TABLE ${this.tableName('users')}
          ADD COLUMN mfa JSONB DEFAULT '{}';
        END IF;
      END $$
    `)

    // Migration: Add passkeys column if it doesn't exist (for existing databases)
    await this.directQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${this.config.schema}'
          AND table_name = '${this.config.tablePrefix}users'
          AND column_name = 'passkeys'
        ) THEN
          ALTER TABLE ${this.tableName('users')}
          ADD COLUMN passkeys JSONB DEFAULT '[]';
        END IF;
      END $$
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}users_username_idx
      ON ${this.tableName('users')} (username)
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}users_email_idx
      ON ${this.tableName('users')} (email)
    `)

    // GIN index for efficient OAuth provider lookups
    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}users_oauth_providers_idx
      ON ${this.tableName('users')} USING GIN (oauth_providers)
    `)

    // GIN index for efficient passkey credential lookups
    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}users_passkeys_idx
      ON ${this.tableName('users')} USING GIN (passkeys)
    `)

    this.logger.info('Creating app tokens table...')
    // App tokens table
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('app_tokens')} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hash VARCHAR(255) UNIQUE NOT NULL,
        permissions JSONB DEFAULT '[]',
        created_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}app_tokens_hash_idx
      ON ${this.tableName('app_tokens')} (hash)
    `)

    this.logger.info('Creating webhooks table...')
    // Webhooks table
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('webhooks')} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        events JSONB DEFAULT '[]',
        headers JSONB DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        secret VARCHAR(255),
        timeout_ms INTEGER DEFAULT 5000,
        retry_attempts INTEGER DEFAULT 3,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    this.logger.info('Creating auth flow state table...')
    // Pending sign-ins: OAuth login state with its PKCE verifier, and WebAuthn
    // challenges. Short-lived and single-use, but they must outlive the process
    // so a restart between the two halves of a sign-in does not fail it.
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('auth_flow_state')} (
        id VARCHAR(255) PRIMARY KEY,
        kind VARCHAR(32) NOT NULL,
        data JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await this.directQuery(`
      CREATE INDEX IF NOT EXISTS ${this.config.tablePrefix}auth_flow_state_expires_idx
      ON ${this.tableName('auth_flow_state')} (expires_at)
    `)

    this.logger.info('Creating settings table...')
    // Settings table
    await this.directQuery(`
      CREATE TABLE IF NOT EXISTS ${this.tableName('settings')} (
        id VARCHAR(255) PRIMARY KEY,
        public_url VARCHAR(500),
        studio_title VARCHAR(255) DEFAULT 'Trokky Studio',
        default_theme VARCHAR(50) DEFAULT 'system',
        config JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(255)
      )
    `)

    this.logger.info('✅ All database tables and indexes created successfully')
  }

  /**
   * Get settings from database
   */
  async getSettings(): Promise<SettingsConfig | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM ${this.config.tablePrefix}settings WHERE id = $1`,
        ['studio-settings']
      )

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0] as SettingsRow
      return {
        id: row.id,
        publicUrl: row.public_url,
        studioTitle: row.studio_title,
        organizationName: row.config?.organizationName,
        primaryColor: row.config?.primaryColor,
        secondaryColor: row.config?.secondaryColor,
        logo: row.config?.logo,
        defaultTheme: row.default_theme as 'light' | 'dark' | 'system',
        // MFA settings
        mfaRequired: row.config?.mfaRequired,
        mfaEnforcedRoles: row.config?.mfaEnforcedRoles,
        mfaAllowedMethods: row.config?.mfaAllowedMethods,
        mfaTrustDeviceDays: row.config?.mfaTrustDeviceDays,
        mfaGracePeriodDays: row.config?.mfaGracePeriodDays,
        _createdAt: row.created_at.toISOString(),
        _updatedAt: row.updated_at.toISOString(),
        _updatedBy: row.updated_by
      }
    } catch (error) {
      this.logger.error('Failed to get settings', { error })
      throw error
    }
  }

  /**
   * Save settings to database
   */
  async saveSettings(settings: SettingsConfig): Promise<void> {
    try {
      // Extract branding and MFA fields for config JSONB
      const config = {
        organizationName: settings.organizationName,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        logo: settings.logo,
        // MFA settings
        mfaRequired: settings.mfaRequired,
        mfaEnforcedRoles: settings.mfaEnforcedRoles,
        mfaAllowedMethods: settings.mfaAllowedMethods,
        mfaTrustDeviceDays: settings.mfaTrustDeviceDays,
        mfaGracePeriodDays: settings.mfaGracePeriodDays
      }

      await this.query(
        `INSERT INTO ${this.tableName('settings')}
          (id, public_url, studio_title, default_theme, config, created_at, updated_at, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id)
        DO UPDATE SET
          public_url = EXCLUDED.public_url,
          studio_title = EXCLUDED.studio_title,
          default_theme = EXCLUDED.default_theme,
          config = EXCLUDED.config,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by`,
        [
          settings.id || 'studio-settings',
          settings.publicUrl,
          settings.studioTitle,
          settings.defaultTheme,
          JSON.stringify(config),
          settings._createdAt || new Date().toISOString(),
          settings._updatedAt || new Date().toISOString(),
          settings._updatedBy || 'system'
        ]
      )

      this.logger.info('Settings saved successfully', {
        id: settings.id || 'studio-settings',
        configFields: Object.keys(config)
      })
    } catch (error) {
      this.logger.error('Failed to save settings', { error })
      throw error
    }
  }

  // ==========================================================================
  // WEBHOOK OPERATIONS
  // ==========================================================================

  async getWebhook(id: string): Promise<WebhookConfig | null> {
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `SELECT * FROM ${this.tableName('webhooks')} WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row: WebhookRow = result.rows[0]
    return this.mapRowToWebhook(row)
  }

  async saveWebhook(id: string, webhookData: Partial<WebhookConfig>): Promise<WebhookConfig> {
    SecurityValidator.validateDocumentId(id)

    const now = new Date()

    try {
      // Check if this is an update (webhook exists) or create (new webhook)
      const existingWebhook = await this.getWebhook(id)

      if (existingWebhook) {
        // Update existing webhook
        const result = await this.query(`
          UPDATE ${this.tableName('webhooks')}
          SET
            name = COALESCE($2, name),
            url = COALESCE($3, url),
            events = COALESCE($4, events),
            headers = COALESCE($5, headers),
            is_active = COALESCE($6, is_active),
            secret = COALESCE($7, secret),
            timeout_ms = COALESCE($8, timeout_ms),
            retry_attempts = COALESCE($9, retry_attempts),
            updated_at = $10
          WHERE id = $1
          RETURNING *
        `, [
          id,
          webhookData.name,
          webhookData.url,
          webhookData.events ? JSON.stringify(webhookData.events) : null,
          webhookData.headers ? JSON.stringify(webhookData.headers) : null,
          webhookData.active,
          webhookData.secret,
          webhookData.retryPolicy?.baseDelay || null,
          webhookData.retryPolicy?.maxRetries || null,
          now
        ])

        const row: WebhookRow = result.rows[0]
        return this.mapRowToWebhook(row)
      } else {
        // Create new webhook
        const result = await this.query(`
          INSERT INTO ${this.tableName('webhooks')}
          (id, name, url, events, headers, is_active, secret, timeout_ms, retry_attempts, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
          RETURNING *
        `, [
          id,
          webhookData.name || 'Untitled Webhook',
          webhookData.url || '',
          JSON.stringify(webhookData.events || []),
          JSON.stringify(webhookData.headers || {}),
          webhookData.active ?? true,
          webhookData.secret || '',
          webhookData.retryPolicy?.baseDelay || 5000,
          webhookData.retryPolicy?.maxRetries || 3,
          webhookData.createdBy || 'system',
          now
        ])

        const row: WebhookRow = result.rows[0]
        return this.mapRowToWebhook(row)
      }
    } catch (error) {
      this.logger.error('Failed to save webhook', { id, webhookData, error })
      throw error
    }
  }

  async listWebhooks(options: WebhookListOptions = {}): Promise<WebhookConfig[]> {
    const limit = Math.min(options.limit || 50, this.MAX_LIST_LIMIT)
    const offset = options.offset || 0

    let query = `SELECT * FROM ${this.tableName('webhooks')}`
    const params: any[] = []
    const conditions: string[] = []

    // Add filtering
    if (options.active !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`)
      params.push(options.active)
    }

    if (options.createdBy) {
      conditions.push(`created_by = $${params.length + 1}`)
      params.push(options.createdBy)
    }

    if (options.events && options.events.length > 0) {
      // Match webhooks that have any of the specified events
      // Uses JSONB array contains operator
      conditions.push(`events ?| $${params.length + 1}`)
      params.push(options.events)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await this.query(query, params)

    return result.rows.map((row: WebhookRow) => this.mapRowToWebhook(row))
  }

  async deleteWebhook(id: string): Promise<void> {
    SecurityValidator.validateDocumentId(id)

    const result = await this.query(
      `DELETE FROM ${this.tableName('webhooks')} WHERE id = $1`,
      [id]
    )

    if (result.rowCount === 0) {
      this.logger.debug(`Webhook ${id} does not exist, nothing to delete`)
    } else {
      this.logger.info(`Webhook deleted: ${id}`)
    }
  }

  // ==========================================================================
  // AUTH FLOW STATE OPERATIONS
  // ==========================================================================

  async getAuthFlowState(id: string): Promise<AuthFlowState | null> {
    SecurityValidator.validateDocumentId(id)

    // Filtering on expires_at here rather than in the caller means an expired
    // row is never handed out even if the sweep has not run yet.
    const result = await this.query(
      `SELECT id, kind, data, expires_at
       FROM ${this.tableName('auth_flow_state')}
       WHERE id = $1 AND expires_at > NOW()`,
      [id]
    )

    const row = result.rows[0]
    if (!row) return null

    return {
      id: row.id,
      kind: row.kind,
      data: row.data || {},
      expiresAt: new Date(row.expires_at).toISOString(),
    }
  }

  async saveAuthFlowState(state: AuthFlowState): Promise<void> {
    SecurityValidator.validateDocumentId(state.id)

    await this.query(
      `INSERT INTO ${this.tableName('auth_flow_state')} (id, kind, data, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET kind = EXCLUDED.kind, data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`,
      [state.id, state.kind, JSON.stringify(state.data), state.expiresAt]
    )
  }

  async deleteAuthFlowState(id: string): Promise<void> {
    SecurityValidator.validateDocumentId(id)

    // Deleting an unknown id is not an error: these are single-use and the
    // sweep may already have removed it.
    await this.query(
      `DELETE FROM ${this.tableName('auth_flow_state')} WHERE id = $1`,
      [id]
    )
  }

  async deleteExpiredAuthFlowStates(): Promise<number> {
    const result = await this.query(
      `DELETE FROM ${this.tableName('auth_flow_state')} WHERE expires_at <= NOW()`
    )
    return result.rowCount || 0
  }

  private mapRowToWebhook(row: WebhookRow): WebhookConfig {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      events: row.events || [],
      secret: row.secret || '',
      active: row.is_active,
      headers: row.headers || {},
      retryPolicy: {
        maxRetries: row.retry_attempts || 3,
        backoffType: 'exponential',
        baseDelay: row.timeout_ms || 5000,
        maxDelay: 30000,
        retryOnStatus: [500, 502, 503, 504, 408, 429]
      },
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
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