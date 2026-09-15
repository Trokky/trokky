/**
 * Cloudflare D1 data storage adapter.
 *
 * D1 is SQLite, which differs from Postgres in ways that are invisible until a
 * conformance test fails, so the choices below are deliberate:
 *
 *  - **Timestamps are generated in JS, never by SQL.** SQLite's `CURRENT_TIMESTAMP`
 *    has one-second resolution; the suite orders fixtures 20ms apart, so rows would
 *    tie and sort arbitrarily.
 *  - **Document payloads are one JSON TEXT blob.** Shredding fields into columns
 *    loses the distinction between `0`, `false`, `''`, `null` and absent, all of
 *    which must round-trip byte-identically.
 *  - **Filters compare value *and* `json_type`.** `json_extract` collapses JSON
 *    booleans to 0/1, so a naive equality makes `false` match a stored `0`.
 *  - **Sorts use `json_extract`**, which yields real SQL numbers; the text
 *    accessors would sort 13 before 2.
 *  - **There is no `beginTransaction`.** D1 has no interactive transactions, and
 *    the interface allows omitting it. The three places that need atomicity each
 *    do it in one statement: the document upsert, `saveUserIf`'s conditional
 *    UPDATE, and `consumeAuthFlowState`'s `DELETE … RETURNING`.
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { InvalidInputError, SecurityValidator, createLogger } from '../../core/index.js'
import type {
  AppToken,
  AuditContext,
  CreateAppTokenData,
  CreateUserData,
  Document,
  DocumentData,
  ListOptions,
  UpdateUserData,
  User
} from '../../core/types/index.js'
import type {
  AuthFlowState,
  DataStorageAdapter,
  SettingsConfig
} from '../../core/types/storage-adapters.js'
import type {
  CloudflareD1AdapterConfig,
  D1AppTokenRow,
  D1AuthFlowStateRow,
  D1DocumentRow,
  D1UserRow
} from './types.js'

/** Field names allowed in a sort or filter position. */
const FIELD_PATTERN = /^[a-zA-Z0-9_.\-]+$/

/**
 * Document fields that live in their own column. Anything else — including any
 * other leading-underscore field a schema defines — is addressed through `data`.
 */
const DOCUMENT_SYSTEM_COLUMNS: Record<string, string> = {
  id: 'id',
  _id: 'id',
  _status: 'status',
  _revision: 'revision',
  _createdAt: 'created_at',
  _updatedAt: 'updated_at',
  _createdBy: 'created_by',
  _updatedBy: 'updated_by',
  _createdByType: 'created_by_type',
  _updatedByType: 'updated_by_type'
}

/** The user INSERT column list, in the order `userInsertValues` binds them. */
const USER_INSERT_COLUMNS = `(id, username, email, password_hash, first_name, last_name, role, permissions,
            is_active, profile_image, preferences, oauth_providers, mfa, passkeys,
            last_login_at, created_at, updated_at)`

/** User columns an update may set, in write order. */
const USER_UPDATE_COLUMNS: ReadonlyArray<{ key: string; column: string; json?: boolean; bool?: boolean }> = [
  { key: 'username', column: 'username' },
  { key: 'email', column: 'email' },
  { key: 'passwordHash', column: 'password_hash' },
  { key: 'firstName', column: 'first_name' },
  { key: 'lastName', column: 'last_name' },
  { key: 'role', column: 'role' },
  { key: 'permissions', column: 'permissions', json: true },
  { key: 'isActive', column: 'is_active', bool: true },
  { key: 'profileImage', column: 'profile_image' },
  { key: 'preferences', column: 'preferences', json: true },
  { key: 'oauthProviders', column: 'oauth_providers', json: true },
  { key: 'mfa', column: 'mfa', json: true },
  { key: 'passkeys', column: 'passkeys', json: true },
  { key: 'lastLoginAt', column: 'last_login_at' }
]

/** A SQL NULL must surface as `undefined`; `null` is reserved for real JSON nulls. */
function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value
}

/** JSON columns hold NULL when absent, never '{}' or '[]'. */
function jsonColumn(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value)
}

function parseJsonColumn<T>(value: string | null): T | undefined {
  if (value === null || value === undefined) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

/** SQLite has no boolean; 0/1 round-trips through INTEGER. */
function boolColumn(value: unknown): number | null {
  return value === null || value === undefined ? null : value ? 1 : 0
}

/** The `json_type` a stored value must have to equal this JS value. */
function expectedJsonType(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'real'
  if (typeof value === 'string') return 'text'
  if (Array.isArray(value)) return 'array'
  return 'object'
}

/** A JSON path that survives field names containing dots or hyphens. */
function jsonPath(field: string): string {
  return `$."${field.replace(/"/g, '""')}"`
}

function assertField(field: string): void {
  if (!FIELD_PATTERN.test(field)) {
    throw new InvalidInputError(`Invalid field name: ${field}`, 'field')
  }
}

export class CloudflareD1Adapter implements DataStorageAdapter {
  private readonly db: D1Database
  private readonly tablePrefix: string
  private readonly autoMigrate: boolean
  private readonly logger = createLogger('adapter', 'CloudflareD1')
  private migrated = false
  private migrationPromise: Promise<void> | null = null

  /** D1 rejects a single value over ~2MB, well below the 10MB other adapters allow. */
  private readonly MAX_DOCUMENT_SIZE = 1_500_000
  private readonly MAX_LIST_LIMIT = 1000

  constructor(config: CloudflareD1AdapterConfig) {
    if (!config?.database) {
      throw new InvalidInputError('A D1 database binding is required', 'database')
    }
    this.db = config.database
    this.tablePrefix = config.tablePrefix ?? 'trokky_'
    this.autoMigrate = config.autoMigrate ?? true
  }

  // ---------------------------------------------------------------- plumbing

  private table(name: string): string {
    return `${this.tablePrefix}${name}`
  }

  private now(): string {
    return new Date().toISOString()
  }

  /** Migrations run once; concurrent callers await the same promise. */
  private async ready(): Promise<void> {
    if (this.migrated) return
    if (!this.autoMigrate) {
      this.migrated = true
      return
    }
    if (!this.migrationPromise) {
      this.migrationPromise = this.migrate().then(
        () => {
          this.migrated = true
        },
        error => {
          this.migrationPromise = null
          throw error
        }
      )
    }
    await this.migrationPromise
  }

  /**
   * Create the schema. No DEFAULTs on the JSON columns: a default of '{}' would
   * turn an absent value into an empty object on read, where `undefined` is
   * required.
   */
  public async migrate(): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS ${this.table('documents')} (
         collection TEXT NOT NULL,
         id TEXT NOT NULL,
         data TEXT NOT NULL,
         status TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         created_by TEXT,
         updated_by TEXT,
         created_by_type TEXT,
         updated_by_type TEXT,
         revision INTEGER NOT NULL DEFAULT 1,
         PRIMARY KEY (collection, id)
       )`,
      `CREATE INDEX IF NOT EXISTS ${this.table('documents')}_collection_created
         ON ${this.table('documents')} (collection, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS ${this.table('users')} (
         id TEXT PRIMARY KEY,
         username TEXT NOT NULL UNIQUE,
         email TEXT NOT NULL UNIQUE,
         password_hash TEXT,
         first_name TEXT,
         last_name TEXT,
         role TEXT,
         permissions TEXT,
         is_active INTEGER,
         profile_image TEXT,
         preferences TEXT,
         oauth_providers TEXT,
         mfa TEXT,
         passkeys TEXT,
         last_login_at TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS ${this.table('users')}_created ON ${this.table('users')} (created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS ${this.table('app_tokens')} (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         description TEXT,
         hash TEXT NOT NULL UNIQUE,
         permissions TEXT,
         created_by TEXT,
         is_active INTEGER,
         usage_count INTEGER DEFAULT 0,
         last_used_at TEXT,
         expires_at TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`,
      `CREATE TABLE IF NOT EXISTS ${this.table('auth_flow_state')} (
         id TEXT PRIMARY KEY,
         kind TEXT NOT NULL,
         data TEXT NOT NULL,
         expires_at TEXT NOT NULL,
         created_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS ${this.table('auth_flow_state')}_expires
         ON ${this.table('auth_flow_state')} (expires_at)`,
      `CREATE TABLE IF NOT EXISTS ${this.table('settings')} (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         data TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`
    ]
    for (const sql of statements) {
      await this.db.prepare(sql).run()
    }
    this.logger.info('D1 schema ready')
  }

  public async close(): Promise<void> {
    // The binding is owned by the platform; there is nothing to release.
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.ready()
      const row = await this.db.prepare('SELECT 1 AS ok').first<{ ok: number }>()
      return row?.ok === 1
    } catch (error) {
      this.logger.warn('D1 health check failed', error)
      return false
    }
  }

  // --------------------------------------------------------------- documents

  private mapRowToDocument(row: D1DocumentRow): Document {
    const data = parseJsonColumn<Record<string, unknown>>(row.data) ?? {}
    // Any `_status` that leaked into the payload must not shadow the column.
    delete (data as Record<string, unknown>)._status

    return {
      id: row.id,
      _id: row.id,
      _collection: row.collection,
      _createdAt: new Date(row.created_at),
      _updatedAt: new Date(row.updated_at),
      _createdBy: orUndefined(row.created_by),
      _updatedBy: orUndefined(row.updated_by),
      _createdByType: orUndefined(row.created_by_type),
      _updatedByType: orUndefined(row.updated_by_type),
      _revision: Number(row.revision ?? 1),
      _status: (orUndefined(row.status) ?? 'draft') as Document['_status'],
      ...data
    } as Document
  }

  public async getDocument(collection: string, id: string): Promise<Document | null> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)
    await this.ready()

    const row = await this.db
      .prepare(`SELECT * FROM ${this.table('documents')} WHERE collection = ? AND id = ?`)
      .bind(collection, id)
      .first<D1DocumentRow>()

    return row ? this.mapRowToDocument(row) : null
  }

  public async saveDocument(
    collection: string,
    id: string,
    data: DocumentData,
    auditContext?: AuditContext
  ): Promise<Document> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)
    SecurityValidator.validateDocumentData(data)
    await this.ready()

    const { _status, ...payload } = (data ?? {}) as Record<string, unknown>
    const serialized = JSON.stringify(payload)
    if (serialized.length > this.MAX_DOCUMENT_SIZE) {
      throw new InvalidInputError(
        `Document exceeds the ${this.MAX_DOCUMENT_SIZE} byte limit for D1`,
        'data'
      )
    }

    const now = this.now()
    const status = (_status as string | undefined) ?? null
    const actor = auditContext?.userId ?? null
    const actorType = auditContext?.userType ?? null
    const documents = this.table('documents')

    // created_by / created_by_type are absent from the UPDATE list on purpose:
    // that is what preserves the original creator across later saves.
    const row = await this.db
      .prepare(
        `INSERT INTO ${documents}
           (collection, id, data, status, created_at, updated_at,
            created_by, updated_by, created_by_type, updated_by_type, revision)
         VALUES (?, ?, ?, COALESCE(?, 'draft'), ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(collection, id) DO UPDATE SET
           data = excluded.data,
           status = COALESCE(?, ${documents}.status, 'draft'),
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by,
           updated_by_type = excluded.updated_by_type,
           revision = COALESCE(${documents}.revision, 1) + 1
         RETURNING *`
      )
      .bind(collection, id, serialized, status, now, now, actor, actor, actorType, actorType, status)
      .first<D1DocumentRow>()

    if (!row) {
      throw new Error(`Failed to save document ${collection}/${id}`)
    }
    return this.mapRowToDocument(row)
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)
    await this.ready()

    const result = await this.db
      .prepare(`DELETE FROM ${this.table('documents')} WHERE collection = ? AND id = ?`)
      .bind(collection, id)
      .run()

    if ((result.meta?.changes ?? 0) === 0) {
      throw new InvalidInputError(`Document ${collection}/${id} not found`, 'id')
    }
  }

  /**
   * Filter clauses shared by listDocuments and countDocuments so the two can
   * never disagree. A data-field comparison checks `json_type` as well as the
   * value: json_extract turns JSON true/false into 1/0, so value alone would
   * make `false` match a stored `0`.
   */
  private buildFilterClauses(filter: Record<string, unknown> | undefined): {
    sql: string
    values: unknown[]
  } {
    const clauses: string[] = []
    const values: unknown[] = []
    if (!filter) return { sql: '', values }

    for (const [field, value] of Object.entries(filter)) {
      assertField(field)
      const column = DOCUMENT_SYSTEM_COLUMNS[field]
      if (column) {
        if (value === null || value === undefined) {
          clauses.push(`${column} IS NULL`)
        } else {
          clauses.push(`${column} = ?`)
          values.push(typeof value === 'boolean' ? boolColumn(value) : value)
        }
        continue
      }

      const path = jsonPath(field)
      clauses.push(`json_extract(data, ?) IS ? AND json_type(data, ?) = ?`)
      values.push(
        path,
        value === null || typeof value === 'object' ? JSON.stringify(value) : value,
        path,
        expectedJsonType(value)
      )
    }

    return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values }
  }

  /**
   * ORDER BY terms. Data fields go through json_extract, which yields a real SQL
   * number, so 2 sorts before 13; the text accessors would not.
   */
  private buildSortClause(sort: string | string[] | undefined): { sql: string; values: unknown[] } {
    const terms = sort === undefined ? [] : Array.isArray(sort) ? sort : [sort]
    if (terms.length === 0) {
      return { sql: ' ORDER BY created_at DESC', values: [] }
    }

    const parts: string[] = []
    const values: unknown[] = []
    for (const term of terms) {
      let field = term
      let direction = 'ASC'
      if (field.startsWith('-')) {
        direction = 'DESC'
        field = field.slice(1)
      } else {
        const suffix = /^(.+)\.(asc|desc)$/i.exec(field)
        if (suffix) {
          field = suffix[1]
          direction = suffix[2].toUpperCase()
        }
      }
      // Validate after stripping, or '-title' reads as a field called '-title'.
      assertField(field)

      const column = DOCUMENT_SYSTEM_COLUMNS[field]
      if (column) {
        parts.push(`${column} ${direction}`)
      } else {
        parts.push(`json_extract(data, ?) ${direction}`)
        values.push(jsonPath(field))
      }
    }
    return { sql: ` ORDER BY ${parts.join(', ')}`, values }
  }

  public async listDocuments(collection: string, options: ListOptions = {}): Promise<Document[]> {
    SecurityValidator.validateCollectionName(collection)
    await this.ready()

    const filter = this.buildFilterClauses(options.filter)
    const sort = this.buildSortClause(options.sort)
    // No implicit page size: an unbounded call returns everything up to the cap.
    const limit = Math.min(options.limit ?? this.MAX_LIST_LIMIT, this.MAX_LIST_LIMIT)
    const offset = options.offset ?? 0

    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.table('documents')} WHERE collection = ?${filter.sql}${sort.sql} LIMIT ? OFFSET ?`
      )
      .bind(collection, ...filter.values, ...sort.values, limit, offset)
      .all<D1DocumentRow>()

    return (result.results ?? []).map(row => this.mapRowToDocument(row))
  }

  public async countDocuments(collection: string, filter?: Record<string, unknown>): Promise<number> {
    SecurityValidator.validateCollectionName(collection)
    await this.ready()

    const clauses = this.buildFilterClauses(filter)
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${this.table('documents')} WHERE collection = ?${clauses.sql}`)
      .bind(collection, ...clauses.values)
      .first<{ count: number }>()

    return Number(row?.count ?? 0)
  }

  public async documentExists(collection: string, id: string): Promise<boolean> {
    SecurityValidator.validateCollectionName(collection)
    SecurityValidator.validateDocumentId(id)
    await this.ready()

    const row = await this.db
      .prepare(`SELECT 1 AS present FROM ${this.table('documents')} WHERE collection = ? AND id = ?`)
      .bind(collection, id)
      .first<{ present: number }>()

    return row !== null && row !== undefined
  }

  // ------------------------------------------------------------------- users

  private mapRowToUser(row: D1UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash ?? '',
      firstName: orUndefined(row.first_name),
      lastName: orUndefined(row.last_name),
      role: orUndefined(row.role),
      // No `?? []` here: an absent column must read back as undefined. The empty
      // array is a *create* default, applied when the row is written.
      permissions: parseJsonColumn<string[]>(row.permissions),
      isActive: row.is_active === null || row.is_active === undefined ? true : row.is_active === 1,
      profileImage: orUndefined(row.profile_image),
      preferences: parseJsonColumn(row.preferences),
      oauthProviders: parseJsonColumn(row.oauth_providers),
      mfa: parseJsonColumn(row.mfa),
      passkeys: parseJsonColumn(row.passkeys),
      lastLoginAt: orUndefined(row.last_login_at),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as unknown as User
  }

  public async getUser(id: string): Promise<User | null> {
    await this.ready()
    const row = await this.db
      .prepare(`SELECT * FROM ${this.table('users')} WHERE id = ?`)
      .bind(id)
      .first<D1UserRow>()
    return row ? this.mapRowToUser(row) : null
  }

  /**
   * Build the SET list from the keys actually present. A key holding `null`
   * clears the column; a key that is absent, or present as `undefined`, leaves
   * it alone. COALESCE cannot express that difference.
   */
  private buildUserAssignments(userData: Record<string, unknown>): { sql: string[]; values: unknown[] } {
    const sql: string[] = []
    const values: unknown[] = []

    for (const { key, column, json, bool } of USER_UPDATE_COLUMNS) {
      if (!(key in userData)) continue
      const value = userData[key]
      if (value === undefined) continue

      sql.push(`${column} = ?`)
      if (value === null) {
        values.push(null)
      } else if (json) {
        values.push(jsonColumn(value))
      } else if (bool) {
        values.push(boolColumn(value))
      } else {
        values.push(value)
      }
    }
    return { sql, values }
  }

  public async saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User> {
    await this.ready()
    const existing = await this.getUser(id)
    const now = this.now()
    const users = this.table('users')
    const input = (userData ?? {}) as Record<string, unknown>

    if (existing) {
      const assignments = this.buildUserAssignments(input)
      assignments.sql.push('updated_at = ?')
      assignments.values.push(now)

      const row = await this.db
        .prepare(`UPDATE ${users} SET ${assignments.sql.join(', ')} WHERE id = ? RETURNING *`)
        .bind(...assignments.values, id)
        .first<D1UserRow>()

      if (!row) throw new Error(`Failed to update user ${id}`)
      return this.mapRowToUser(row)
    }

    const row = await this.db
      .prepare(
        `INSERT INTO ${users} ${USER_INSERT_COLUMNS}
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         RETURNING *`
      )
      .bind(...this.userInsertValues(id, input, now))
      .first<D1UserRow>()

    if (!row) throw new Error(`Failed to create user ${id}`)
    return this.mapRowToUser(row)
  }

  /** The bind list for a user INSERT, shared so the two insert paths cannot drift. */
  private userInsertValues(id: string, input: Record<string, unknown>, now: string): unknown[] {
    return [
      id,
      input.username ?? null,
      input.email ?? null,
      input.passwordHash ?? '',
      input.firstName ?? null,
      input.lastName ?? null,
      input.role ?? null,
      jsonColumn(input.permissions ?? []),
      boolColumn(input.isActive === undefined ? true : input.isActive),
      input.profileImage ?? null,
      jsonColumn(input.preferences),
      jsonColumn(input.oauthProviders),
      jsonColumn(input.mfa),
      jsonColumn(input.passkeys),
      input.lastLoginAt ?? null,
      now,
      now
    ]
  }

  /**
   * Create the first user, atomically. SQLite serialises writers, so a single
   * `INSERT ... SELECT ... WHERE NOT EXISTS` is the check and the write under one
   * lock: of two concurrent calls, exactly one inserts and the other gets no row.
   */
  public async createFirstUser(id: string, userData: CreateUserData): Promise<User | null> {
    SecurityValidator.validateDocumentId(id)
    await this.ready()
    const users = this.table('users')
    const values = this.userInsertValues(id, (userData ?? {}) as unknown as Record<string, unknown>, this.now())

    const row = await this.db
      .prepare(
        `INSERT INTO ${users} ${USER_INSERT_COLUMNS}
         SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
         WHERE NOT EXISTS (SELECT 1 FROM ${users})
         RETURNING *`
      )
      .bind(...values)
      .first<D1UserRow>()

    return row ? this.mapRowToUser(row) : null
  }

  /**
   * Compare-and-swap in one statement. SQLite makes a single UPDATE atomic, so
   * no transaction is needed: the WHERE clause is the comparison, and RETURNING
   * proves whether it matched.
   */
  public async saveUserIf(
    id: string,
    userData: Partial<UpdateUserData>,
    condition: { passwordHash: string }
  ): Promise<User | null> {
    await this.ready()
    const assignments = this.buildUserAssignments((userData ?? {}) as Record<string, unknown>)
    assignments.sql.push('updated_at = ?')
    assignments.values.push(this.now())

    const row = await this.db
      .prepare(
        `UPDATE ${this.table('users')} SET ${assignments.sql.join(', ')}
         WHERE id = ? AND password_hash = ? RETURNING *`
      )
      .bind(...assignments.values, id, condition.passwordHash)
      .first<D1UserRow>()

    return row ? this.mapRowToUser(row) : null
  }

  public async listUsers(
    options: { role?: string; isActive?: boolean; limit?: number; offset?: number } = {}
  ): Promise<User[]> {
    await this.ready()
    const clauses: string[] = []
    const values: unknown[] = []

    if (options.role !== undefined) {
      clauses.push('role = ?')
      values.push(options.role)
    }
    if (options.isActive !== undefined) {
      clauses.push('is_active = ?')
      values.push(boolColumn(options.isActive))
    }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
    const limit = Math.min(options.limit ?? this.MAX_LIST_LIMIT, this.MAX_LIST_LIMIT)
    const offset = options.offset ?? 0

    const result = await this.db
      .prepare(`SELECT * FROM ${this.table('users')}${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, limit, offset)
      .all<D1UserRow>()

    return (result.results ?? []).map(row => this.mapRowToUser(row))
  }

  public async deleteUser(id: string): Promise<void> {
    await this.ready()
    const result = await this.db.prepare(`DELETE FROM ${this.table('users')} WHERE id = ?`).bind(id).run()
    if ((result.meta?.changes ?? 0) === 0) {
      throw new InvalidInputError(`User ${id} not found`, 'id')
    }
  }

  private async findUserBy(column: 'username' | 'email', value: string): Promise<User | null> {
    if (!value || typeof value !== 'string') {
      throw new InvalidInputError(`A ${column} is required`, column)
    }
    await this.ready()
    const row = await this.db
      .prepare(`SELECT * FROM ${this.table('users')} WHERE ${column} = ?`)
      .bind(value)
      .first<D1UserRow>()
    return row ? this.mapRowToUser(row) : null
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    return this.findUserBy('username', username)
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    return this.findUserBy('email', email)
  }

  public async isUsernameAvailable(username: string): Promise<boolean> {
    return (await this.getUserByUsername(username)) === null
  }

  public async isEmailAvailable(email: string): Promise<boolean> {
    return (await this.getUserByEmail(email)) === null
  }

  public async getUserByOAuthProvider(provider: string, providerId: string): Promise<User | null> {
    await this.ready()
    const result = await this.db
      .prepare(`SELECT * FROM ${this.table('users')} WHERE oauth_providers IS NOT NULL`)
      .all<D1UserRow>()

    for (const row of result.results ?? []) {
      const providers = parseJsonColumn<Array<Record<string, unknown>>>(row.oauth_providers) ?? []
      if (providers.some(p => p.provider === provider && String(p.providerId) === String(providerId))) {
        return this.mapRowToUser(row)
      }
    }
    return null
  }

  public async getUserByPasskeyCredentialId(credentialId: string): Promise<User | null> {
    if (!credentialId || !/^[A-Za-z0-9_-]+$/.test(credentialId)) {
      throw new InvalidInputError('Invalid credential id', 'credentialId')
    }
    await this.ready()
    const result = await this.db
      .prepare(`SELECT * FROM ${this.table('users')} WHERE passkeys IS NOT NULL`)
      .all<D1UserRow>()

    for (const row of result.results ?? []) {
      const passkeys = parseJsonColumn<Array<Record<string, unknown>>>(row.passkeys) ?? []
      if (passkeys.some(p => p.credentialId === credentialId || p.id === credentialId)) {
        return this.mapRowToUser(row)
      }
    }
    return null
  }

  // -------------------------------------------------------------- app tokens

  private mapRowToAppToken(row: D1AppTokenRow): AppToken {
    return {
      id: row.id,
      name: row.name,
      description: orUndefined(row.description) ?? '',
      hash: row.hash,
      // Unlike a user's permissions, a token's are always an array: there is no
      // "cleared" state for them, and the type says string[].
      permissions: parseJsonColumn<string[]>(row.permissions) ?? [],
      createdBy: orUndefined(row.created_by),
      isActive: row.is_active === null || row.is_active === undefined ? true : row.is_active === 1,
      usageCount: Number(row.usage_count ?? 0),
      lastUsedAt: orUndefined(row.last_used_at),
      expiresAt: orUndefined(row.expires_at),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as unknown as AppToken
  }

  public async getAppToken(id: string): Promise<AppToken | null> {
    await this.ready()
    const row = await this.db
      .prepare(`SELECT * FROM ${this.table('app_tokens')} WHERE id = ?`)
      .bind(id)
      .first<D1AppTokenRow>()
    return row ? this.mapRowToAppToken(row) : null
  }

  public async getAppTokenByHash(hash: string): Promise<AppToken | null> {
    if (!hash || typeof hash !== 'string') {
      throw new InvalidInputError('Token hash is required', 'hash')
    }
    await this.ready()
    const row = await this.db
      .prepare(`SELECT * FROM ${this.table('app_tokens')} WHERE hash = ? AND is_active = 1`)
      .bind(hash)
      .first<D1AppTokenRow>()
    if (!row) return null

    await this.db
      .prepare(`UPDATE ${this.table('app_tokens')} SET last_used_at = ?, usage_count = COALESCE(usage_count,0) + 1 WHERE id = ?`)
      .bind(this.now(), row.id)
      .run()

    return this.mapRowToAppToken(row)
  }

  public async saveAppToken(id: string, data: CreateAppTokenData | Partial<AppToken>): Promise<AppToken> {
    await this.ready()
    const now = this.now()
    const input = (data ?? {}) as Record<string, unknown>
    const tokens = this.table('app_tokens')
    const existing = await this.getAppToken(id)

    if (existing) {
      const sql: string[] = []
      const values: unknown[] = []
      for (const [key, column, json, bool] of [
        ['name', 'name', false, false],
        ['description', 'description', false, false],
        ['permissions', 'permissions', true, false],
        ['isActive', 'is_active', false, true],
        ['expiresAt', 'expires_at', false, false],
        ['lastUsedAt', 'last_used_at', false, false]
      ] as Array<[string, string, boolean, boolean]>) {
        if (!(key in input) || input[key] === undefined) continue
        sql.push(`${column} = ?`)
        values.push(json ? jsonColumn(input[key]) : bool ? boolColumn(input[key]) : input[key])
      }
      sql.push('updated_at = ?')
      values.push(now)

      const row = await this.db
        .prepare(`UPDATE ${tokens} SET ${sql.join(', ')} WHERE id = ? RETURNING *`)
        .bind(...values, id)
        .first<D1AppTokenRow>()
      if (!row) throw new Error(`Failed to update app token ${id}`)
      return this.mapRowToAppToken(row)
    }

    const row = await this.db
      .prepare(
        `INSERT INTO ${tokens}
           (id, name, description, hash, permissions, created_by, is_active,
            usage_count, last_used_at, expires_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`
      )
      .bind(
        id,
        input.name ?? null,
        input.description ?? null,
        input.hash ?? null,
        jsonColumn(input.permissions ?? []),
        input.createdBy ?? null,
        boolColumn(input.isActive === undefined ? true : input.isActive),
        0,
        input.lastUsedAt ?? null,
        input.expiresAt ?? null,
        now,
        now
      )
      .first<D1AppTokenRow>()

    if (!row) throw new Error(`Failed to create app token ${id}`)
    return this.mapRowToAppToken(row)
  }

  public async listAppTokens(
    options: { createdBy?: string; isActive?: boolean; limit?: number; offset?: number } = {}
  ): Promise<AppToken[]> {
    await this.ready()
    const clauses: string[] = []
    const values: unknown[] = []
    if (options.createdBy !== undefined) {
      clauses.push('created_by = ?')
      values.push(options.createdBy)
    }
    if (options.isActive !== undefined) {
      clauses.push('is_active = ?')
      values.push(boolColumn(options.isActive))
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
    const limit = Math.min(options.limit ?? this.MAX_LIST_LIMIT, this.MAX_LIST_LIMIT)

    const result = await this.db
      .prepare(`SELECT * FROM ${this.table('app_tokens')}${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, limit, options.offset ?? 0)
      .all<D1AppTokenRow>()

    return (result.results ?? []).map(row => this.mapRowToAppToken(row))
  }

  public async deleteAppToken(id: string): Promise<void> {
    await this.ready()
    const result = await this.db.prepare(`DELETE FROM ${this.table('app_tokens')} WHERE id = ?`).bind(id).run()
    if ((result.meta?.changes ?? 0) === 0) {
      throw new InvalidInputError(`App token ${id} not found`, 'id')
    }
  }

  // ------------------------------------------------------------- flow state

  public async saveAuthFlowState(state: AuthFlowState): Promise<void> {
    SecurityValidator.validateDocumentId(state.id)
    await this.ready()
    await this.db
      .prepare(
        `INSERT INTO ${this.table('auth_flow_state')} (id, kind, data, expires_at, created_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind, data = excluded.data, expires_at = excluded.expires_at`
      )
      .bind(state.id, state.kind, JSON.stringify(state.data ?? {}), state.expiresAt, this.now())
      .run()
  }

  /**
   * One statement, so two concurrent callers cannot both win. Kind and expiry
   * are part of the WHERE clause: presenting another flow's id neither returns
   * it nor destroys it.
   */
  public async consumeAuthFlowState(id: string, kind: AuthFlowState['kind']): Promise<AuthFlowState | null> {
    await this.ready()
    const row = await this.db
      .prepare(
        `DELETE FROM ${this.table('auth_flow_state')}
         WHERE id = ? AND kind = ? AND expires_at > ?
         RETURNING id, kind, data, expires_at`
      )
      .bind(id, kind, this.now())
      .first<D1AuthFlowStateRow>()

    if (!row) return null
    return {
      id: row.id,
      kind: row.kind as AuthFlowState['kind'],
      data: parseJsonColumn<Record<string, unknown>>(row.data) ?? {},
      expiresAt: row.expires_at
    }
  }

  public async deleteExpiredAuthFlowStates(): Promise<number> {
    await this.ready()
    const result = await this.db
      .prepare(`DELETE FROM ${this.table('auth_flow_state')} WHERE expires_at <= ?`)
      .bind(this.now())
      .run()
    return result.meta?.changes ?? 0
  }

  // ---------------------------------------------------------------- settings

  public async getSettings(): Promise<SettingsConfig | null> {
    await this.ready()
    const row = await this.db
      .prepare(`SELECT data FROM ${this.table('settings')} WHERE id = 1`)
      .first<{ data: string }>()
    return row ? parseJsonColumn<SettingsConfig>(row.data) ?? null : null
  }

  public async saveSettings(settings: SettingsConfig): Promise<void> {
    await this.ready()
    await this.db
      .prepare(
        `INSERT INTO ${this.table('settings')} (id, data, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .bind(JSON.stringify(settings ?? {}), this.now())
      .run()
  }

  public async getStorageInfo(): Promise<{
    [key: string]: unknown
    collections: string[]
    documentCount: number
    userCount: number
    tokenCount: number
    storageSize?: number
  }> {
    await this.ready()
    const collections = await this.db
      .prepare(`SELECT DISTINCT collection FROM ${this.table('documents')}`)
      .all<{ collection: string }>()
    const counts = await this.db.batch<{ count: number }>([
      this.db.prepare(`SELECT COUNT(*) AS count FROM ${this.table('documents')}`),
      this.db.prepare(`SELECT COUNT(*) AS count FROM ${this.table('users')}`),
      this.db.prepare(`SELECT COUNT(*) AS count FROM ${this.table('app_tokens')}`)
    ])
    const at = (index: number): number => Number(counts[index]?.results?.[0]?.count ?? 0)

    return {
      type: 'cloudflare-d1',
      collections: (collections.results ?? []).map(row => row.collection),
      documentCount: at(0),
      userCount: at(1),
      tokenCount: at(2)
    }
  }

  /** Not implemented: D1 has no interactive transactions. */
  public readonly beginTransaction = undefined

  /** Escape hatch for callers that need raw SQL, e.g. migrations. */
  public async execute<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.ready()
    const statement: D1PreparedStatement = params.length
      ? this.db.prepare(sql).bind(...params)
      : this.db.prepare(sql)
    const result = await statement.all<T>()
    return result.results ?? []
  }
}
