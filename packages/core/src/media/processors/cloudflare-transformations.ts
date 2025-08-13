/**
 * Cloudflare Image Transformations Processor
 * 
 * Uses Cloudflare's Image Transformations feature to transform images on-the-fly
 * via URL parameters. Works with images stored in R2 and served through Cloudflare.
 * 
 * Unlike Cloudflare Images, this doesn't require a separate service or storage.
 * Images are stored in R2 and transformed when requested via URL parameters.
 * 
 * Example URLs:
 * - Original: https://example.com/media/image.jpg
 * - Thumbnail: https://example.com/media/image.jpg?width=300&height=300&fit=crop&format=webp
 * - Medium: https://example.com/media/image.jpg?width=800&height=600&fit=crop&format=webp
 * 
 * Documentation: https://developers.cloudflare.com/images/image-resizing/
 */

import { ImageProcessor } from './types'
import type { ImageProcessorConfig, ImageVariant, ProcessedImage, ProcessedImageVariant } from './types'

export interface CloudflareTransformationsConfig extends ImageProcessorConfig {
  type: 'cloudflare-transformations'
  options: {
    /**
     * Base URL for serving images (your domain with Cloudflare proxy)
     * Example: 'https://trokky.dev' or 'https://cdn.example.com'
     */
    baseUrl: string
    
    /**
     * Media path prefix (should match your R2 public URL structure)
     * Example: '/media' if images are served at https://trokky.dev/media/filename.jpg
     */
    mediaPath?: string
    
    /**
     * Default format for transformations
     */
    defaultFormat?: 'webp' | 'avif' | 'jpeg' | 'png'
    
    /**
     * Default quality (1-100)
     */
    defaultQuality?: number
    
    /**
     * Whether to enable automatic format optimization based on browser support
     */
    autoFormat?: boolean
  }
}

/**
 * Cloudflare Image Transformations processor
 * 
 * This processor doesn't actually transform images - it generates URLs
 * that will be transformed by Cloudflare when requested.
 */
export class CloudflareTransformationsProcessor extends ImageProcessor {
  private baseUrl: string
  private mediaPath: string
  private defaultFormat: string
  private defaultQuality: number
  private autoFormat: boolean

  constructor(config: CloudflareTransformationsConfig) {
    super(config)
    
    const { baseUrl, mediaPath, defaultFormat, defaultQuality, autoFormat } = config.options
    
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.mediaPath = mediaPath || '/media'
    this.defaultFormat = defaultFormat || 'webp'
    this.defaultQuality = defaultQuality || 85
    this.autoFormat = autoFormat !== false // Default to true
  }

  async processImage(
    file: File, 
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    // For transformations, we don't process the image physically
    // We just generate URLs that will be transformed on-the-fly
    
    const buffer = await file.arrayBuffer()
    const baseImageUrl = `${this.baseUrl}${this.mediaPath}/${metadata.id}`
    
    // Original variant (no transformations)
    const original: ProcessedImageVariant = {
      url: baseImageUrl,
      width: 0, // Unknown until first request
      height: 0,
      format: file.type.split('/')[1] || 'jpeg',
      size: file.size,
      buffer: Buffer.from(buffer)
    }

    // Generate transformation URLs for each variant
    const variants: Record<string, ProcessedImageVariant> = {}
    
    for (const variant of this.config.variants || []) {
      const transformationUrl = this.buildTransformationUrl(baseImageUrl, variant)
      
      variants[variant.name] = {
        url: transformationUrl,
        width: variant.width || 0,
        height: variant.height || 0,
        format: variant.format || this.defaultFormat,
        size: 0, // Unknown until transformation
        buffer: null // Transformations don't have buffers
      }
    }

    return { original, variants }
  }

  /**
   * Build a Cloudflare Image Transformations URL
   */
  private buildTransformationUrl(baseUrl: string, variant: ImageVariant): string {
    const params = new URLSearchParams()
    
    // Dimensions
    if (variant.width) {
      params.set('width', variant.width.toString())
    }
    if (variant.height) {
      params.set('height', variant.height.toString())
    }
    
    // Fit mode
    if (variant.fit) {
      // Map Trokky fit modes to Cloudflare fit modes
      const fitMap: Record<string, string> = {
        'cover': 'crop',
        'contain': 'scale-down',
        'fill': 'crop',
        'inside': 'scale-down',
        'outside': 'crop'
      }
      params.set('fit', fitMap[variant.fit] || variant.fit)
    }
    
    // Format
    const format = variant.format || this.defaultFormat
    if (format !== 'jpeg') { // JPEG is default, no need to specify
      params.set('format', format)
    }
    
    // Quality
    const quality = variant.quality || this.defaultQuality
    if (quality !== 85) { // 85 is Cloudflare's default
      params.set('quality', quality.toString())
    }
    
    // Auto format optimization
    if (this.autoFormat) {
      params.set('anim', 'false') // Disable animation for better compression
    }
    
    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }

  /**
   * Get the URL for a specific variant
   */
  public getImageUrl(imageId: string, variantName?: string): string {
    const baseImageUrl = `${this.baseUrl}${this.mediaPath}/${imageId}`
    
    if (!variantName || variantName === 'original') {
      return baseImageUrl
    }
    
    // Find the variant configuration
    const variant = this.config.variants?.find(v => v.name === variantName)
    if (!variant) {
      return baseImageUrl
    }
    
    return this.buildTransformationUrl(baseImageUrl, variant)
  }

  /**
   * Delete image - no-op since transformations don't store anything
   */
  public async deleteImage(imageId: string): Promise<void> {
    // No-op - transformations don't store images
    // The original will be deleted from R2 by the media adapter
  }

  /**
   * Health check - verify base URL is accessible
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }
}