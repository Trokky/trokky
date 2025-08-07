import type { D1Database, D1Result } from '@cloudflare/workers-types'

/**
 * Cloudflare D1 Adapter Configuration
 */
export interface CloudflareD1AdapterConfig {
  /** D1 database binding from Cloudflare Workers environment */
  database?: D1Database
  
  /** Database name (for Wrangler local development) */
  databaseName?: string
  
  /** Table prefix for multi-tenant setups */
  tablePrefix?: string
  
  /** Enable debug logging */
  debug?: boolean
  
  /** Enable full-text search */
  enableFTS?: boolean
  
  /** Enable audit logging */
  enableAuditLog?: boolean
  
  /** Custom SQL migration queries to run on init */
  migrations?: string[]
}

/**
 * D1 Row Types
 */
export interface D1DocumentRow {
  id: string
  collection: string
  data: string // JSON string
  slug?: string | null
  published: number // 0 or 1
  status?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
  revision: number
}

export interface D1UserRow {
  id: string
  username: string
  email: string
  password_hash: string
  first_name?: string | null
  last_name?: string | null
  role: string
  permissions?: string | null // JSON string
  is_active: number // 0 or 1
  preferences?: string | null // JSON string
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

export interface D1AppTokenRow {
  id: string
  name: string
  token_hash: string
  permissions: string // JSON string
  description?: string | null
  is_active: number // 0 or 1
  last_used_at?: string | null
  expires_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface D1AuditLogRow {
  id?: number
  event_type: string
  entity_type?: string | null
  entity_id?: string | null
  user_id?: string | null
  username?: string | null
  action: string
  details?: string | null // JSON string
  ip_address?: string | null
  user_agent?: string | null
  timestamp: string
  success: number // 0 or 1
}

/**
 * Query builder helpers
 */
export interface QueryParams {
  table: string
  where?: Record<string, any>
  orderBy?: string
  limit?: number
  offset?: number
  select?: string[]
}

export interface InsertParams {
  table: string
  data: Record<string, any>
  returning?: string[]
}

export interface UpdateParams {
  table: string
  data: Record<string, any>
  where: Record<string, any>
  returning?: string[]
}

export interface DeleteParams {
  table: string
  where: Record<string, any>
}