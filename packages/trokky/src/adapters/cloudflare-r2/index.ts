export { CloudflareR2Adapter } from './cloudflare-r2-adapter.js'
export type { CloudflareR2AdapterConfig, R2MediaRecord } from './types.js'

// Auto-register in the adapter registry when imported, like the other adapters.
import { registerAdapter } from '../../core/index.js'
import { CloudflareR2Adapter } from './cloudflare-r2-adapter.js'
import type { CloudflareR2AdapterConfig } from './types.js'

registerAdapter({
  name: 'cloudflare-r2',
  type: 'media',
  environments: ['edge', 'cloudflare'],
  factory: (config: CloudflareR2AdapterConfig) => new CloudflareR2Adapter(config)
})
