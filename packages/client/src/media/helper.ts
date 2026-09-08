/**
 * Media Helper Module
 * Utilities for working with Trokky media assets with dynamic variant discovery
 */

import type { HttpClient } from '../http/client.js'
import type { MediaFieldValue } from '@trokky/trokky/types'

export interface MediaVariant {
  url: string
  width: number
  height: number
  format: string
  size: number
}

export interface MediaFile {
  id: string
  url: string
  filename: string
  contentType: string
  size: number
  metadata?: {
    path?: string
    extension?: string
    originalFilename?: string
    imageVariants?: Record<string, MediaVariant>
    originalDimensions?: {
      width: number
      height: number
    }
  }
  _createdAt: string
}

export interface MediaResponse {
  success: boolean
  data: {
    file: MediaFile
  }
}

/**
 * Media helper class for working with media assets
 */
export class MediaHelper {
  private metadataCache = new Map<string, Promise<MediaFile | null>>()
  
  constructor(private http: HttpClient) {}

  /**
   * Fetch media metadata to check available variants
   */
  async fetchMetadata(mediaId: string): Promise<MediaFile | null> {
    const cacheKey = mediaId
    
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!
    }
    
    const promise = this.http.get<MediaResponse>(`/media/${mediaId}`)
      .then(response => response?.data?.file || null)
      .catch(error => {
        console.warn(`Failed to fetch media metadata for ${mediaId}:`, error)
        return null
      })
    
    this.metadataCache.set(cacheKey, promise)
    return promise
  }

  /**
   * Get the URL for a media asset
   * @param mediaAsset The media asset reference
   * @param variant The desired variant name (e.g., 'thumbnail', 'preview', or any custom variant)
   * @returns The media URL or null if not available
   */
  getUrl(
    mediaAsset: MediaFieldValue | null | undefined,
    variant?: string
  ): string | null {
    if (!mediaAsset?.asset?._ref) {
      return null
    }

    const mediaId = mediaAsset.asset._ref
    const baseUrl = this.http.getBaseUrl()
    
    if (!variant || variant === 'original') {
      return `${baseUrl}/media/${mediaId}/file`
    }
    
    // Return optimistic URL for SSR/SSG
    return `${baseUrl}/media/${mediaId}/variants/${variant}`
  }

  /**
   * Validate and get the best available media URL
   * Checks if variant exists and falls back to original if not
   */
  async getValidatedUrl(
    mediaAsset: MediaFieldValue | null | undefined,
    variant?: string
  ): Promise<string | null> {
    if (!mediaAsset?.asset?._ref) {
      return null
    }

    const mediaId = mediaAsset.asset._ref
    const baseUrl = this.http.getBaseUrl()
    
    // Always have original as fallback
    const originalUrl = `${baseUrl}/media/${mediaId}/file`
    
    if (!variant || variant === 'original') {
      return originalUrl
    }
    
    // Fetch metadata to check if variant exists
    const metadata = await this.fetchMetadata(mediaId)
    
    if (!metadata) {
      // If we can't fetch metadata, return original as safe fallback
      return originalUrl
    }
    
    // Check if the specific variant exists
    const variantExists = metadata.metadata?.imageVariants?.[variant]
    
    if (variantExists) {
      return `${baseUrl}/media/${mediaId}/variants/${variant}`
    }
    
    // Try thumbnail as a fallback (it's always generated)
    if (variant !== 'thumbnail' && metadata.metadata?.imageVariants?.['thumbnail']) {
      console.warn(`Variant '${variant}' not found for media ${mediaId}, using thumbnail`)
      return `${baseUrl}/media/${mediaId}/variants/thumbnail`
    }
    
    // Final fallback to original
    console.warn(`No variants found for media ${mediaId}, using original`)
    return originalUrl
  }

  /**
   * Get the best image URL for a given max width
   * This method dynamically discovers available variants and chooses the best one
   */
  async getBestUrlForWidth(
    mediaAsset: MediaFieldValue | null | undefined,
    maxWidth: number
  ): Promise<string | null> {
    if (!mediaAsset?.asset?._ref) {
      return null
    }

    const mediaId = mediaAsset.asset._ref
    const baseUrl = this.http.getBaseUrl()
    const originalUrl = `${baseUrl}/media/${mediaId}/file`
    
    // Fetch metadata to discover available variants
    const metadata = await this.fetchMetadata(mediaId)
    
    if (!metadata?.metadata?.imageVariants) {
      // No variants available, return original
      return originalUrl
    }
    
    // Find the best variant based on width
    const variants = metadata.metadata.imageVariants
    let bestVariant: { name: string; variant: MediaVariant } | null = null
    let closestLarger: { name: string; variant: MediaVariant } | null = null
    let closestSmaller: { name: string; variant: MediaVariant } | null = null
    
    for (const [name, variant] of Object.entries(variants)) {
      if (!variant) continue
      
      if (variant.width === maxWidth) {
        // Exact match
        bestVariant = { name, variant }
        break
      } else if (variant.width > maxWidth) {
        // Larger than needed
        if (!closestLarger || variant.width < closestLarger.variant.width) {
          closestLarger = { name, variant }
        }
      } else {
        // Smaller than needed
        if (!closestSmaller || variant.width > closestSmaller.variant.width) {
          closestSmaller = { name, variant }
        }
      }
    }
    
    // Choose the best variant: exact match > closest larger > closest smaller > original
    const chosen = bestVariant || closestLarger || closestSmaller
    
    if (chosen) {
      return `${baseUrl}/media/${mediaId}/variants/${chosen.name}`
    }
    
    return originalUrl
  }

  /**
   * Get available variants for a media asset
   * Returns an array of variant names that are available
   */
  async getAvailableVariants(
    mediaAsset: MediaFieldValue | null | undefined
  ): Promise<string[]> {
    if (!mediaAsset?.asset?._ref) {
      return []
    }

    const mediaId = mediaAsset.asset._ref
    const metadata = await this.fetchMetadata(mediaId)
    
    const variants: string[] = ['original'] // Always have original
    
    if (metadata?.metadata?.imageVariants) {
      variants.push(...Object.keys(metadata.metadata.imageVariants))
    }
    
    return variants
  }

  /**
   * Check if a media asset has a specific variant
   */
  async hasVariant(
    mediaAsset: MediaFieldValue | null | undefined,
    variant: string
  ): Promise<boolean> {
    if (!mediaAsset?.asset?._ref) {
      return false
    }
    
    if (!variant || variant === 'original') {
      return true
    }

    const mediaId = mediaAsset.asset._ref
    const metadata = await this.fetchMetadata(mediaId)
    
    return !!metadata?.metadata?.imageVariants?.[variant]
  }

  /**
   * Get all variant URLs for a media asset
   * Returns an object with variant names as keys and URLs as values
   */
  async getAllVariantUrls(
    mediaAsset: MediaFieldValue | null | undefined
  ): Promise<Record<string, string>> {
    if (!mediaAsset?.asset?._ref) {
      return {}
    }

    const mediaId = mediaAsset.asset._ref
    const baseUrl = this.http.getBaseUrl()
    const metadata = await this.fetchMetadata(mediaId)
    
    const urls: Record<string, string> = {
      original: `${baseUrl}/media/${mediaId}/file`
    }
    
    if (metadata?.metadata?.imageVariants) {
      for (const variantName of Object.keys(metadata.metadata.imageVariants)) {
        urls[variantName] = `${baseUrl}/media/${mediaId}/variants/${variantName}`
      }
    }
    
    return urls
  }

  /**
   * Clear the metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear()
  }

  /**
   * Clear cache for a specific media ID
   */
  clearCacheFor(mediaId: string): void {
    this.metadataCache.delete(mediaId)
  }
}