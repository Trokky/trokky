/**
 * Express middleware for rewriting clean media URLs to API endpoints
 * 
 * DYNAMIC VARIANT DISCOVERY:
 * - 'thumbnail' is always supported (automatic variant)
 * - Other variants are discovered from actual media files or configuration
 * 
 * Rewrites:
 * /media/media-id/thumbnail → /api/media/media-id/variants/thumbnail (always available)
 * /media/media-id/preview → /api/media/media-id/variants/preview (if exists)
 * /media/media-id/hero → /api/media/media-id/variants/hero (if exists)
 * /media/media-id/custom → /api/media/media-id/variants/custom (if exists)
 * /media/media-id → /api/media/media-id/file (original)
 */

import type { Request, Response, NextFunction } from 'express'
import type { TrokkyCore } from '@trokky/core'
import { createLogger } from '@trokky/core'

const logger = createLogger('express', 'MediaRewrite')

export interface MediaRewriteOptions {
  /**
   * Base path for clean media URLs (default: '/media')
   */
  basePath?: string
  
  /**
   * API base path to rewrite to (default: '/api')
   */
  apiBasePath?: string
  
  /**
   * TrokkyCore instance for dynamic variant discovery
   */
  core?: TrokkyCore
  
  /**
   * Fallback variants if core is not available (default: ['thumbnail'])
   */
  fallbackVariants?: string[]
  
  /**
   * Cache variant names for performance (default: true)
   */
  cacheVariants?: boolean
  
  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTtl?: number
  
  /**
   * Enable debug logging
   */
  debug?: boolean
}

const DEFAULT_OPTIONS: Required<Omit<MediaRewriteOptions, 'core'>> = {
  basePath: '/media',
  apiBasePath: '/api',
  fallbackVariants: ['thumbnail'], // thumbnail is always available
  cacheVariants: true,
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  debug: false
}

interface VariantCache {
  variants: Set<string>
  timestamp: number
}

/**
 * Create dynamic media URL rewrite middleware
 */
export function createMediaRewriteMiddleware(options: MediaRewriteOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  // Cache for discovered variants
  const variantCache = new Map<string, VariantCache>()
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalUrl = req.url
    const originalPath = req.path
    
    // Only process requests that start with our media base path
    if (!originalPath.startsWith(config.basePath)) {
      return next()
    }
    
    // Parse the clean URL format: /media/{id}/{variant?}
    const mediaPathRegex = new RegExp(`^${config.basePath}/([^/]+)(?:/([^/]+))?$`)
    const match = originalPath.match(mediaPathRegex)
    
    if (!match) {
      logger.debug('No match for path', { path: originalPath })
      return next()
    }
    
    const [, mediaId, variant] = match
    
    // Validate media ID format (basic security check)
    if (!isValidMediaId(mediaId)) {
      logger.debug('Invalid media ID', { mediaId })
      return next()
    }
    
    let newPath: string
    
    if (variant) {
      // Check if variant is supported
      const isValidVariant = await isVariantSupported(mediaId, variant, config, variantCache)
      
      if (!isValidVariant) {
        logger.debug('Unsupported variant', { variant, mediaId })
        return next()
      }
      
      // Rewrite to variant endpoint: /api/media/{id}/variants/{variant}
      newPath = `${config.apiBasePath}/media/${mediaId}/variants/${variant}`
    } else {
      // Rewrite to original file endpoint: /api/media/{id}/file
      newPath = `${config.apiBasePath}/media/${mediaId}/file`
    }
    
    // Update request URL (path is automatically updated)
    req.url = req.url.replace(originalPath, newPath)

    logger.debug('Rewriting media URL', { from: originalPath, to: newPath })

    next()
  }
}

/**
 * Check if a variant is supported for a specific media file
 */
async function isVariantSupported(
  mediaId: string, 
  variant: string, 
  config: Required<Omit<MediaRewriteOptions, 'core'>> & { core?: TrokkyCore },
  variantCache: Map<string, VariantCache>
): Promise<boolean> {
  // Thumbnail is always supported (automatic variant)
  if (variant === 'thumbnail') {
    return true
  }
  
  // Check cache first
  if (config.cacheVariants) {
    const cached = variantCache.get(mediaId)
    if (cached && (Date.now() - cached.timestamp) < config.cacheTtl) {
      return cached.variants.has(variant)
    }
  }
  
  // If no core instance, use fallback variants
  if (!config.core) {
    return config.fallbackVariants.includes(variant)
  }
  
  try {
    // Get media file metadata to discover available variants
    const mediaFile = await config.core.getMedia(mediaId)
    
    if (!mediaFile) {
      logger.debug('Media file not found', { mediaId })
      return false
    }
    
    // Extract available variants from metadata
    const availableVariants = new Set<string>(['thumbnail']) // thumbnail always available
    
    if (mediaFile.metadata?.imageVariants) {
      const variants = mediaFile.metadata.imageVariants as Record<string, any>
      for (const variantName of Object.keys(variants)) {
        availableVariants.add(variantName)
      }
    }
    
    // Cache the result
    if (config.cacheVariants) {
      variantCache.set(mediaId, {
        variants: availableVariants,
        timestamp: Date.now()
      })
    }

    logger.debug('Available variants for media', { mediaId, variants: Array.from(availableVariants) })

    return availableVariants.has(variant)
    
  } catch (error) {
    logger.debug('Error checking variants for media', { mediaId, error })

    // Fallback to configured variants on error
    return config.fallbackVariants.includes(variant)
  }
}

/**
 * Validate media ID format
 * Expects format like: media-{random}-{hash}-{timestamp}
 */
function isValidMediaId(id: string): boolean {
  // Basic validation - adjust pattern based on your ID format
  const mediaIdPattern = /^media-[a-z0-9]+-[a-f0-9]+-[a-f0-9]+$/i
  return mediaIdPattern.test(id)
}

/**
 * Helper to generate clean media URLs with dynamic variant discovery
 */
export class MediaUrlGenerator {
  private variantCache = new Map<string, string[]>()
  
  constructor(
    private options: Required<Omit<MediaRewriteOptions, 'core'>> & { core?: TrokkyCore }
  ) {}
  
  /**
   * Generate clean URL for media file
   */
  getUrl(mediaId: string, variant?: string): string {
    const base = this.options.basePath
    
    if (variant) {
      return `${base}/${mediaId}/${variant}`
    }
    
    return `${base}/${mediaId}`
  }
  
  /**
   * Generate all available variant URLs for a media file
   * This requires async discovery of variants
   */
  async getAllUrls(mediaId: string): Promise<Record<string, string>> {
    const urls: Record<string, string> = {
      original: this.getUrl(mediaId)
    }
    
    // Always include thumbnail
    urls.thumbnail = this.getUrl(mediaId, 'thumbnail')
    
    // Discover other variants if core is available
    if (this.options.core) {
      try {
        const mediaFile = await this.options.core.getMedia(mediaId)
        
        if (mediaFile?.metadata?.imageVariants) {
          const variants = mediaFile.metadata.imageVariants as Record<string, any>
          for (const variantName of Object.keys(variants)) {
            if (variantName !== 'thumbnail') { // avoid duplicate
              urls[variantName] = this.getUrl(mediaId, variantName)
            }
          }
        }
      } catch (error) {
        logger.debug('Error discovering variants for media', { mediaId, error })
      }
    }
    
    return urls
  }
  
  /**
   * Get available variant names for a media file
   */
  async getAvailableVariants(mediaId: string): Promise<string[]> {
    const variants = ['thumbnail'] // Always available
    
    if (this.options.core) {
      try {
        const mediaFile = await this.options.core.getMedia(mediaId)
        
        if (mediaFile?.metadata?.imageVariants) {
          const imageVariants = mediaFile.metadata.imageVariants as Record<string, any>
          for (const variantName of Object.keys(imageVariants)) {
            if (!variants.includes(variantName)) {
              variants.push(variantName)
            }
          }
        }
      } catch (error) {
        logger.debug('Error getting variants for media', { mediaId, error })
      }
    }
    
    return variants
  }
}

/**
 * Create URL generator with same options as middleware
 */
export function createMediaUrlGenerator(options: MediaRewriteOptions = {}): MediaUrlGenerator {
  const config = { ...DEFAULT_OPTIONS, ...options }
  return new MediaUrlGenerator(config)
}
