export { FilesystemDataAdapter } from './filesystem-data-adapter.js'
export type { 
  FilesystemDataAdapterConfig, 
  DocumentFile, 
  UserFile, 
  AppTokenFile 
} from './types.js'

// Auto-register adapter in global registry when imported
import { registerAdapter } from '@trokky/core'
import { FilesystemDataAdapter } from './filesystem-data-adapter.js'
import type { FilesystemDataAdapterConfig } from './types.js'

registerAdapter({
  name: 'filesystem-data',
  type: 'data',
  environments: ['node'],
  factory: (config: FilesystemDataAdapterConfig) => {
    return new FilesystemDataAdapter(config)
  }
})