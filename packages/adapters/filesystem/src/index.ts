// Main filesystem adapter
export { FilesystemAdapter } from './filesystem-adapter.js'

// Types and configuration
export type {
  FilesystemAdapterConfig,
  FileMetadata,
  DocumentFile
} from './types.js'

// Import types for utility function
import { FilesystemAdapter } from './filesystem-adapter.js'
import type { FilesystemAdapterConfig } from './types.js'

// Utility function to create adapter with default config
export function createFilesystemAdapter(config?: Partial<FilesystemAdapterConfig>): FilesystemAdapter {
  return new FilesystemAdapter(config)
}