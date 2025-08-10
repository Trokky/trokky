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

  /**
   * Base URL for serving media files via HTTP
   * When provided, media URLs will be HTTP URLs instead of file:// URLs
   * Example: 'http://localhost:3000/studio/api/media'
   * @default null (uses file:// URLs)
   */
  mediaBaseUrl?: string
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
  // User-editable metadata fields
  title?: string
  alt?: string
  author?: string
  credit?: string
  tags?: string[]
  // Image processing metadata (added by Sharp processor)
  imageVariants?: Record<string, {
    url: string
    width: number
    height: number
    format: string
    size: number
  }>
  originalDimensions?: {
    width: number
    height: number
  }
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