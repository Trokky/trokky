/**
 * Collection utilities for CLI commands
 * Handles singleton detection and collection metadata
 */

import { TrokkyClient } from '../../client.js'

/**
 * Collection metadata from schema
 */
export interface CollectionInfo {
  name: string
  singleton: boolean
}

/**
 * Cache entry with TTL
 */
interface CacheEntry {
  data: CollectionInfo[]
  timestamp: number
}

/**
 * Cache for collection info to avoid repeated API calls
 * TTL of 5 minutes to handle schema changes during long sessions
 */
const collectionCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get collection info from the API
 * Results are cached per base URL with TTL
 */
export async function getCollectionInfo(client: TrokkyClient): Promise<CollectionInfo[]> {
  const baseUrl = client.getBaseUrl() || 'default'

  // Check cache first
  const cached = collectionCache.get(baseUrl)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const collections = await client.getCollections()
  const info: CollectionInfo[] = collections.map((c: any) => {
    if (!c.name || typeof c.name !== 'string') {
      throw new Error('Invalid collection data: missing or invalid name')
    }
    return {
      name: c.name,
      singleton: c.singleton === true
    }
  })

  collectionCache.set(baseUrl, { data: info, timestamp: Date.now() })
  return info
}

/**
 * Check if a collection is a singleton
 */
export async function isSingleton(client: TrokkyClient, collectionName: string): Promise<boolean> {
  const collections = await getCollectionInfo(client)
  const collection = collections.find(c => c.name === collectionName)
  return collection?.singleton ?? false
}

/**
 * Check if a collection exists
 */
export async function collectionExists(client: TrokkyClient, collectionName: string): Promise<boolean> {
  const collections = await getCollectionInfo(client)
  return collections.some(c => c.name === collectionName)
}

/**
 * Result of checking collection status
 */
export type CollectionCheckResult =
  | { exists: false }
  | { exists: true; singleton: boolean }

/**
 * Check if collection exists and whether it's a singleton
 * Use this when you need both checks to provide better error messages
 */
export async function checkCollection(client: TrokkyClient, collectionName: string): Promise<CollectionCheckResult> {
  const collections = await getCollectionInfo(client)
  const collection = collections.find(c => c.name === collectionName)

  if (!collection) {
    return { exists: false }
  }

  return { exists: true, singleton: collection.singleton }
}

/**
 * Clear the collection cache (useful for testing)
 */
export function clearCollectionCache(): void {
  collectionCache.clear()
}
