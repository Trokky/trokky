export { CloudflareD1Adapter } from './cloudflare-d1-adapter.js'
export type {
  CloudflareD1AdapterConfig,
  D1DocumentRow,
  D1UserRow,
  D1AppTokenRow,
  D1AuthFlowStateRow
} from './types.js'

// Auto-register in the adapter registry when imported, like the other adapters.
import { registerAdapter } from '../../core/index.js'
import { CloudflareD1Adapter } from './cloudflare-d1-adapter.js'
import type { CloudflareD1AdapterConfig } from './types.js'

registerAdapter({
  name: 'cloudflare-d1',
  type: 'data',
  environments: ['edge', 'cloudflare'],
  factory: (config: CloudflareD1AdapterConfig) => new CloudflareD1Adapter(config)
})
