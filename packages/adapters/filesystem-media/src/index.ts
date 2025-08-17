export { FilesystemMediaAdapter } from './filesystem-media-adapter'
export type { 
  FilesystemMediaAdapterConfig, 
  FileMetadata 
} from './types'

// Auto-register adapter in global registry when imported
import { registerAdapter } from '@trokky/core'
import { FilesystemMediaAdapter } from './filesystem-media-adapter'
import type { FilesystemMediaAdapterConfig } from './types'

registerAdapter({
  name: 'filesystem-media',
  type: 'media',
  environments: ['node'],
  factory: (config: FilesystemMediaAdapterConfig) => {
    return new FilesystemMediaAdapter(config)
  }
})