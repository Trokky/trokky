export interface FilesystemAdapterConfig {
  /**
   * Base directory for content storage
   * @default './content'
   */
  contentDir?: string

  /**
   * Base directory for media storage  
   * @default './media'
   */
  mediaDir?: string

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

export interface FileMetadata {
  id: string
  filename: string
  contentType: string
  size: number
  extension: string
  originalPath?: string
  createdAt: Date
  updatedAt: Date
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
  }
}