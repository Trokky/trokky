/**
 * @trokky/adapter-cloudflare-r2
 * 
 * Cloudflare R2 media storage adapter for Trokky CMS.
 * Provides object storage for media files with variant support
 * optimized for edge runtime on Cloudflare Workers.
 */

export { CloudflareR2Adapter } from './cloudflare-r2-adapter.js'
export type {
  CloudflareR2AdapterConfig,
  R2UploadOptions,
  R2FileMetadata
} from './types.js'

// Auto-register adapter in global registry when imported
import { registerAdapter } from '@trokky/core'
import { CloudflareR2Adapter } from './cloudflare-r2-adapter.js'
import type { CloudflareR2AdapterConfig } from './types.js'

registerAdapter({
  name: 'cloudflare-r2',
  type: 'media',
  environments: ['edge', 'cloudflare'],
  factory: (config: CloudflareR2AdapterConfig) => {
    return new CloudflareR2Adapter(config)
  }
})