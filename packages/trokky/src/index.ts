/**
 * Trokky - TypeScript-native CMS client and CLI with built-in HTTP client
 *
 * @example
 * import { TrokkyClient } from '@trokky/trokky'
 *
 * const client = new TrokkyClient({ baseUrl: 'https://api.example.com' })
 *
 * // Fluent API (recommended)
 * const posts = await client.from('posts').published().limit(10).fetch()
 * const post = await client.from('posts').id('post-123').fetchOne()
 * await client.from('posts').create({ title: 'Hello' })
 * await client.from('posts').id('post-123').update({ title: 'New' })
 * await client.from('posts').id('post-123').delete()
 */

// Client SDK exports
export { TrokkyClient } from './client.js'
export { HttpClient } from './http.js'
export { QueryBuilder } from './query-builder.js'

export type { ClientConfig, AuthTokens } from './http.js'
export type { FilterConditions, SortDirection, SortConfig } from './query-builder.js'

// Re-export types from @trokky/types
export type {
  BaseDocument,
  DocumentResult,
  CollectionResult,
  QueryOptions,
  MediaAsset
} from '@trokky/types'

// CLI commands are available via bin/trokky
