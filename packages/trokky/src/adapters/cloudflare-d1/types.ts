import type { D1Database } from '@cloudflare/workers-types'

export interface CloudflareD1AdapterConfig {
  /**
   * The D1 binding from the platform, e.g. `env.DB`. Required: unlike a
   * connection string there is nothing an edge runtime can dial on its own.
   */
  database: D1Database
  /** Table name prefix for all Trokky tables. @default 'trokky_' */
  tablePrefix?: string
  /** Create tables and indexes on first use. @default true */
  autoMigrate?: boolean
}

/** A row of the documents table, before mapping. */
export interface D1DocumentRow {
  collection: string
  id: string
  data: string
  status: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  created_by_type: string | null
  updated_by_type: string | null
  revision: number
}

/** A row of the users table, before mapping. */
export interface D1UserRow {
  id: string
  username: string
  email: string
  password_hash: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  permissions: string | null
  is_active: number | null
  profile_image: string | null
  preferences: string | null
  oauth_providers: string | null
  mfa: string | null
  passkeys: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

/** A row of the app_tokens table, before mapping. */
export interface D1AppTokenRow {
  id: string
  name: string
  description: string | null
  hash: string
  permissions: string | null
  created_by: string | null
  is_active: number | null
  usage_count: number | null
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

/** A row of the auth_flow_state table, before mapping. */
export interface D1AuthFlowStateRow {
  id: string
  kind: string
  data: string
  expires_at: string
}
