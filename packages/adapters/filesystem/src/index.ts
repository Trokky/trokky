// DEPRECATED: Legacy single-adapter architecture
// Use split storage with FilesystemDataAdapter + FilesystemMediaAdapter instead

/**
 * @deprecated Use split storage architecture instead. See migration guide.
 */
export { FilesystemAdapter } from './filesystem-adapter.js'

/**
 * @deprecated Use split storage configuration types instead.
 */
export type {
  FilesystemAdapterConfig,
  FileMetadata,
  DocumentFile
} from './types.js'

// Import types for utility function
import { FilesystemAdapter } from './filesystem-adapter.js'
import type { FilesystemAdapterConfig } from './types.js'

/**
 * @deprecated Use TrokkyExpress.create() with split storage configuration instead.
 * 
 * @example
 * ```ts
 * // Old way (deprecated)
 * const adapter = createFilesystemAdapter({ contentDir: './content' })
 * 
 * // New way (recommended)
 * const trokky = await TrokkyExpress.create({
 *   storage: {
 *     data: { adapter: 'filesystem-data', options: { contentDir: './data/content' } },
 *     media: { adapter: 'filesystem-media', options: { mediaDir: './data/media' } }
 *   }
 * })
 * ```
 */
export function createFilesystemAdapter(config?: Partial<FilesystemAdapterConfig>): FilesystemAdapter {
  return new FilesystemAdapter(config)
}

// Modern split storage adapters are available via the adapter registry
// Use 'filesystem-data' and 'filesystem-media' adapter keys in TrokkyExpress.create()