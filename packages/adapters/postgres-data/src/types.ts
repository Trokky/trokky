import type { PoolConfig } from 'pg'

export interface PostgresDataAdapterConfig {
  /**
   * PostgreSQL connection configuration
   * Can be a connection string or pg.PoolConfig object
   */
  connection?: string | PoolConfig

  /**
   * Database connection pool settings
   * @default { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 }
   */
  pool?: {
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
  }

  /**
   * Database schema name to use
   * @default 'public'
   */
  schema?: string

  /**
   * Table name prefix for all Trokky tables
   * @default 'trokky_'
   */
  tablePrefix?: string

  /**
   * Whether to automatically create tables and indexes
   * @default true
   */
  autoMigrate?: boolean

  /**
   * Enable query logging for debugging
   * @default false
   */
  enableQueryLogging?: boolean

  /**
   * SSL configuration for the connection
   * @default undefined (uses database default)
   */
  ssl?: boolean | object

  /**
   * Connection timeout in milliseconds
   * @default 5000
   */
  connectionTimeout?: number
}

/**
 * Internal database row types for PostgreSQL storage
 */

export interface DocumentRow {
  collection: string
  id: string
  data: any // JSONB data
  created_at: Date
  updated_at: Date
  created_by?: string
  updated_by?: string
}

export interface UserRow {
  id: string
  username: string
  email: string
  password_hash: string
  first_name: string
  last_name: string
  role: string
  permissions: any // JSONB array
  is_active: boolean
  profile_image?: string
  last_login_at?: string // ISO string
  preferences: any // JSONB data
  created_at: string // ISO string
  updated_at: string // ISO string
}

export interface AppTokenRow {
  id: string
  name: string
  hash: string
  permissions: any // JSONB array
  created_by: string
  is_active: boolean
  last_used_at?: Date // TIMESTAMP from database
  expires_at?: Date // TIMESTAMP from database
  created_at: Date // TIMESTAMP from database
  updated_at: Date // TIMESTAMP from database
}

export interface AuditLogRow {
  id: string
  operation: string
  resource_type: string
  resource_id: string
  actor_type: string
  actor_id: string
  changes: any // JSONB data
  metadata: any // JSONB data
  timestamp: Date
}

export interface WebhookRow {
  id: string
  name: string
  url: string
  events: string[] // JSONB array
  headers: any // JSONB object
  is_active: boolean
  secret?: string
  timeout_ms: number
  retry_attempts: number
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface SettingsRow {
  id: string
  public_url: string
  studio_title: string
  default_theme: string
  config: any // JSONB data for additional settings
  created_at: Date
  updated_at: Date
  updated_by?: string
}

/**
 * Migration information stored in the database
 */
export interface MigrationRow {
  id: string
  name: string
  applied_at: Date
  checksum: string
}