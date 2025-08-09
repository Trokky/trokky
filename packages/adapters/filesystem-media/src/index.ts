export { FilesystemMediaAdapter } from './filesystem-media-adapter.js'
export type { 
  FilesystemMediaAdapterConfig, 
  FileMetadata 
} from './types.js'

// Auto-register adapter in global registry when imported
import { registerAdapter } from '@trokky/core'
import { FilesystemMediaAdapter } from './filesystem-media-adapter.js'
import type { FilesystemMediaAdapterConfig } from './types.js'

registerAdapter({
  name: 'filesystem-media',
  type: 'media',
  environments: ['node'],
  factory: (config: FilesystemMediaAdapterConfig) => {
    return new FilesystemMediaAdapter(config)
  }
})