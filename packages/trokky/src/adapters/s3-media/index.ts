export { S3MediaAdapter } from './s3-media-adapter.js'
export type { S3MediaAdapterConfig, S3MediaRecord } from './types.js'

// Auto-register in the adapter registry when imported, like the other adapters.
import { registerAdapter } from '../../core/index.js'
import { S3MediaAdapter } from './s3-media-adapter.js'
import type { S3MediaAdapterConfig } from './types.js'

registerAdapter({
  name: 's3-media',
  type: 'media',
  // Signing is WebCrypto and the transport is fetch, so this runs wherever Trokky does.
  environments: ['node', 'edge', 'cloudflare'],
  factory: (config: S3MediaAdapterConfig) => new S3MediaAdapter(config)
})
