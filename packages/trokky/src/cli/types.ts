/**
 * Types for Trokky CLI backup/restore system
 * Version 2.0 - Schema-driven architecture
 */

/**
 * Backup manifest - contains all metadata needed for restore
 */
export interface BackupManifest {
  version: '2.0'
  timestamp: string
  source: {
    url?: string
    description?: string
  }
  schemas: SchemaDefinition[]
  dependencyGraph: DependencyGraph
  restoreOrder: string[]
  mediaIndex: MediaIndex
  statistics: BackupStatistics
}

/**
 * Schema definition from API
 */
export interface SchemaDefinition {
  name: string
  title?: string
  description?: string
  type?: 'document' | 'singleton'
  singleton?: boolean
  fields: FieldDefinition[]
}

/**
 * Field definition with reference information
 */
export interface FieldDefinition {
  name: string
  type: string
  title?: string
  description?: string
  required?: boolean
  validation?: Record<string, any>
  options?: Record<string, any>

  // Reference field properties
  to?: string | string[]

  // Array field properties
  of?: FieldDefinition

  // Object field properties
  fields?: FieldDefinition[] | Record<string, FieldDefinition>

  // Additional properties
  default?: any
  hidden?: boolean
  readOnly?: boolean
}

/**
 * Dependency graph: collection -> set of dependencies
 */
export type DependencyGraph = Record<string, string[]>

/**
 * Media index: old media ID -> file info
 */
export interface MediaIndex {
  [oldMediaId: string]: MediaFileInfo
}

export interface MediaFileInfo {
  filename: string
  mimeType: string
  size: number
  metadata?: Record<string, any>
}

/**
 * Backup statistics
 */
export interface BackupStatistics {
  totalDocuments: number
  totalMedia: number
  collections: Record<string, number>
  backupSizeBytes: number
}

/**
 * Reference found in a document
 */
export interface DocumentReference {
  path: string[] // Field path (e.g., ['author', '_ref'])
  oldId: string
  targetCollection?: string // Known from schema if available
}

/**
 * ID mapping for restore
 */
export interface IdMapping {
  [oldId: string]: string // old ID -> new ID
}

/**
 * Restore options
 */
export interface RestoreOptions {
  collections?: string[] // Specific collections to restore
  overwrite?: boolean
  clean?: boolean
  dryRun?: boolean
  preserveIds?: boolean // Preserve IDs for singletons
}

/**
 * Restore result
 */
export interface RestoreResult {
  documentsRestored: number
  mediaRestored: number
  referencesUpdated: number
  errors: RestoreError[]
  idMappings: IdMapping
}

export interface RestoreError {
  collection: string
  documentId?: string
  error: string
  recoverable: boolean
}
