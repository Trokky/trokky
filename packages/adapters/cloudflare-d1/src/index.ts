/**
 * @trokky/adapter-cloudflare-d1
 * 
 * Cloudflare D1 data storage adapter for Trokky CMS.
 * Provides SQL-based storage for documents, users, and app tokens
 * optimized for edge runtime on Cloudflare Workers.
 */

export { CloudflareD1Adapter } from './cloudflare-d1-adapter.js'
export type {
  CloudflareD1AdapterConfig,
  D1DocumentRow,
  D1UserRow,
  D1AppTokenRow,
  D1AuditLogRow
} from './types.js'