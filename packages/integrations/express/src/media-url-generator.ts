/**
 * Media URL Generator for Express Integration
 * 
 * Generates media URLs based on serving mode and auto-detected mount points.
 * Supports both API-based serving (with permissions) and static serving (direct).
 */

import type { MediaConfig } from './config'

export interface MediaUrlGeneratorOptions {
  /** Media serving configuration */
  mediaConfig: MediaConfig
  /** Auto-detected API mount path (e.g., '/api', '/cms-api') */
  apiBasePath: string
  /** Base URL for the server (e.g., 'http://localhost:3000') */
  baseUrl?: string
}

export class MediaUrlGenerator {
  private options: MediaUrlGeneratorOptions

  constructor(options: MediaUrlGeneratorOptions) {
    this.options = options
  }

  /**
   * Generate URL for media file
   */
  getMediaUrl(mediaId: string, variant?: string): string {
    const { mediaConfig, apiBasePath, baseUrl } = this.options
    const servingMode = mediaConfig.serving?.mode || 'api'

    if (servingMode === 'static') {
      return this.generateStaticUrl(mediaId, variant)
    } else {
      return this.generateApiUrl(mediaId, variant, apiBasePath)
    }
  }

  /**
   * Generate static serving URL: /media/{mediaId}/{variant}
   */
  private generateStaticUrl(mediaId: string, variant?: string): string {
    const staticBasePath = this.options.mediaConfig.serving?.staticBasePath || '/media'
    const customDomain = this.options.mediaConfig.serving?.customDomain

    let url: string
    if (variant) {
      url = `${staticBasePath}/${mediaId}/${variant}`
    } else {
      url = `${staticBasePath}/${mediaId}`
    }

    // If custom domain is specified, use it as the base
    if (customDomain) {
      return `${customDomain.replace(/\/$/, '')}${url}`
    }

    // If baseUrl is provided, prepend it
    if (this.options.baseUrl) {
      return `${this.options.baseUrl.replace(/\/$/, '')}${url}`
    }

    return url
  }

  /**
   * Generate API serving URL: {apiBasePath}/media/{mediaId}/file or {apiBasePath}/media/{mediaId}/variants/{variant}
   */
  private generateApiUrl(mediaId: string, variant: string | undefined, apiBasePath: string): string {
    const customDomain = this.options.mediaConfig.serving?.customDomain

    let url: string
    if (variant) {
      url = `${apiBasePath}/media/${mediaId}/variants/${variant}`
    } else {
      url = `${apiBasePath}/media/${mediaId}/file`
    }

    // If custom domain is specified, use it as the base
    if (customDomain) {
      return `${customDomain.replace(/\/$/, '')}${url}`
    }

    // If baseUrl is provided, prepend it
    if (this.options.baseUrl) {
      return `${this.options.baseUrl.replace(/\/$/, '')}${url}`
    }

    return url
  }

  /**
   * Get all available variant URLs for a media file
   */
  getVariantUrls(mediaId: string, availableVariants: string[]): Record<string, string> {
    const urls: Record<string, string> = {
      original: this.getMediaUrl(mediaId)
    }

    for (const variant of availableVariants) {
      urls[variant] = this.getMediaUrl(mediaId, variant)
    }

    return urls
  }

  /**
   * Update configuration (useful when mount path changes)
   */
  updateConfig(options: Partial<MediaUrlGeneratorOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Get current serving mode
   */
  getServingMode(): 'api' | 'static' {
    return this.options.mediaConfig.serving?.mode || 'api'
  }

  /**
   * Get current API base path
   */
  getApiBasePath(): string {
    return this.options.apiBasePath
  }
}

/**
 * Create MediaUrlGenerator with auto-detected configuration
 */
export function createMediaUrlGenerator(options: MediaUrlGeneratorOptions): MediaUrlGenerator {
  return new MediaUrlGenerator(options)
}