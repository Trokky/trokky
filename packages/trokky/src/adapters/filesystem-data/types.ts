import type { UpdateUserData } from '../../core/index.js'
import type { PasskeyCredential } from '../../types/index.js'

export interface FilesystemDataAdapterConfig {
  /**
   * Base directory for content storage (documents)
   * @default './content'
   */
  contentDir?: string

  /**
   * Base directory for user storage (system entities)
   * @default './users'
   */
  usersDir?: string

  /**
   * Base directory for app token storage (system entities)
   * @default './tokens'
   */
  tokensDir?: string

  /**
   * Base directory for webhook storage (system entities)
   * @default './webhooks'
   */
  webhooksDir?: string

  /**
   * Base directory for settings storage (system entities)
   * @default './settings'
   */
  settingsDir?: string

  /**
   * Base directory for audit log storage (system entities)
   * @default './audit-logs'
   */
  auditLogsDir?: string

  /**
   * Whether to create directories if they don't exist
   * @default true
   */
  createDirs?: boolean

  /**
   * Whether to pretty-print JSON files
   * @default true
   */
  prettyJson?: boolean

  /**
   * Number of spaces for JSON indentation
   * @default 2
   */
  jsonSpaces?: number

  /**
   * Whether to sync operations to disk immediately
   * @default false
   */
  syncWrites?: boolean

  /**
   * File permissions for created files (octal)
   * @default 0o644
   */
  fileMode?: number

  /**
   * Directory permissions for created directories (octal)
   * @default 0o755
   */
  dirMode?: number

  /**
   * Whether to suppress warning logs
   * @default false
   */
  silent?: boolean
}

export interface DocumentFile {
  id: string
  collection: string
  data: Record<string, unknown>
  metadata: {
    createdAt: Date
    updatedAt: Date
    revision: number
    status?: 'draft' | 'published'
    createdBy?: string
    updatedBy?: string
    createdByType?: import('../../core/index.js').AuditActorType
    updatedByType?: import('../../core/index.js').AuditActorType
  }
}

export interface OAuthProviderFile {
  provider: 'google' | 'github' | 'microsoft'
  providerId: string
  email: string
  linkedAt: string
  lastUsedAt?: string
}

export interface UserFile {
  id: string
  username: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  role: string
  permissions: string[]
  isActive: boolean
  profileImage?: string
  preferences?: Record<string, unknown>
  oauthProviders?: OAuthProviderFile[]
  /** MFA enrolment state; written and read back verbatim. */
  mfa?: UpdateUserData['mfa']
  /** Registered WebAuthn credentials; written and read back verbatim. */
  passkeys?: PasskeyCredential[]
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface AppTokenFile {
  id: string
  name: string
  description?: string
  tokenHash: string
  permissions: string[]
  createdBy: string
  isActive: boolean
  lastUsedAt?: string
  usageCount?: number
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface AuditLogFile {
  id: string
  documentId: string
  collection: string
  operation: import('../../core/index.js').AuditOperation
  
  // Actor information
  actorId: string
  actorType: import('../../core/index.js').AuditActorType
  actorUsername?: string
  
  // Change details
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
    fields?: string[]
  }
  
  // Metadata
  timestamp: string // ISO string for JSON storage
  revision: number
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  
  // Additional context
  metadata?: Record<string, unknown>
}