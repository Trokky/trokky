export { FilesystemDataAdapter } from './filesystem-data-adapter'
export type { 
  FilesystemDataAdapterConfig, 
  DocumentFile, 
  UserFile, 
  AppTokenFile 
} from './types'

// Auto-register adapter in global registry when imported
import { registerAdapter } from '@trokky/core'
import { FilesystemDataAdapter } from './filesystem-data-adapter'
import type { FilesystemDataAdapterConfig } from './types'

registerAdapter({
  name: 'filesystem-data',
  type: 'data',
  environments: ['node'],
  factory: (config: FilesystemDataAdapterConfig) => {
    return new FilesystemDataAdapter(config)
  }
})