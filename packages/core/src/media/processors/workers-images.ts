/**
 * Cloudflare Workers Images Processor
 * 
 * Uses Cloudflare Workers' built-in image resizing to transform and store images.
 * This is the recommended approach for Cloudflare Workers as it works seamlessly
 * with R2 storage and doesn't require external API calls.
 * 
 * How it works:
 * 1. Fetch original image from R2
 * 2. Use Workers fetch() with image resizing options
 * 3. Store transformed variants back in R2
 * 4. Return R2 URLs for all variants
 * 
 * Requirements:
 * - Cloudflare Workers with image resizing enabled
 * - R2 bucket for storage
 * - Your worker must serve images from a route
 * 
 * Documentation: https://developers.cloudflare.com/images/image-resizing/resize-with-workers/
 */

import { ImageProcessor } from './types.js'
import type { ImageProcessorConfig, ImageVariant, ProcessedImage, ProcessedImageVariant } from './types.js'

export interface WorkersImagesConfig extends ImageProcessorConfig {
  type: 'workers-images'
  options: {
    /**
     * Base URL where your worker serves images
     * Example: 'https://your-worker.workers.dev' or 'https://yourdomain.com'
     */
    baseUrl: string
    
    /**
     * Path prefix for media files
     * Example: '/media'
     */
    mediaPath?: string
    
    /**
     * Whether to store variants with a flat structure
     * true: /media/[id]-thumbnail.webp
     * false: /media/[id]/thumbnail.webp
     */
    flatStructure?: boolean
    
    /**
     * Default format for variants
     */
    defaultFormat?: 'webp' | 'avif' | 'jpeg' | 'png'
    
    /**
     * Default quality (1-100)
     */
    defaultQuality?: number
    
    /**
     * Whether to process variants immediately or on-demand
     * immediate: Process and store all variants during upload
     * on-demand: Generate variants when first requested
     */
    processingMode?: 'immediate' | 'on-demand'
  }
}

/**
 * Workers Images processor using built-in Cloudflare Workers image resizing
 */
export class WorkersImagesProcessor extends ImageProcessor {
  private baseUrl: string
  private mediaPath: string
  private flatStructure: boolean
  private defaultFormat: string
  private defaultQuality: number
  private processingMode: 'immediate' | 'on-demand'
  private env?: any

  constructor(config: WorkersImagesConfig) {
    super(config)
    
    const { 
      baseUrl,
      mediaPath, 
      flatStructure,
      defaultFormat, 
      defaultQuality,
      processingMode
    } = config.options
    
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.mediaPath = mediaPath || '/media'
    this.flatStructure = flatStructure !== false // Default to true
    this.defaultFormat = defaultFormat || 'webp'
    this.defaultQuality = defaultQuality || 85
    this.processingMode = processingMode || 'immediate'
  }

  /**
   * Set the Worker environment (includes R2 binding)
   */
  setEnv(env: any): void {
    this.env = env
  }

  async processImage(
    file: File, 
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    const buffer = await file.arrayBuffer()
    const variants: Record<string, ProcessedImageVariant> = {}
    
    // Original image info - use the /file endpoint
    const original: ProcessedImageVariant = {
      url: `${this.baseUrl}${this.mediaPath}/${metadata.id}/file`,
      width: 0,
      height: 0,
      format: file.type.split('/')[1] || 'jpeg',
      size: file.size,
      buffer: Buffer.from(buffer)
    }

    if (this.processingMode === 'immediate') {
      // Process all variants immediately
      for (const variant of this.config.variants || []) {
        try {
          const transformedData = await this.transformImage(
            metadata.id,
            buffer,
            variant
          )
          
          variants[variant.name] = transformedData
        } catch (error) {
          console.error(`Failed to process variant ${variant.name}:`, error)
          // Create a URL-only variant as fallback
          variants[variant.name] = this.createOnDemandVariant(metadata.id, variant)
        }
      }
    } else {
      // Create on-demand URLs for all variants
      for (const variant of this.config.variants || []) {
        variants[variant.name] = this.createOnDemandVariant(metadata.id, variant)
      }
    }

    return { original, variants }
  }

  /**
   * Transform an image using Workers fetch with resizing options
   */
  private async transformImage(
    imageId: string,
    imageBuffer: ArrayBuffer,
    variant: ImageVariant
  ): Promise<ProcessedImageVariant> {
    // Build the resize options for Cloudflare Workers
    const resizeOptions = this.buildResizeOptions(variant)
    
    // Construct the URL with transformation parameters
    // Use the /file endpoint to get the actual file content
    const originalUrl = `${this.baseUrl}${this.mediaPath}/${imageId}/file`
    const variantUrl = `${originalUrl}?${new URLSearchParams(resizeOptions).toString()}`
    
    try {
      // Use Workers fetch with cf.image options
      // @ts-ignore - cf property is Cloudflare-specific
      const response = await fetch(originalUrl, {
        cf: {
          image: resizeOptions
        }
      } as any)
      
      if (!response.ok) {
        throw new Error(`Image transformation failed: ${response.status}`)
      }
      
      const transformedBuffer = await response.arrayBuffer()
      
      // Store the variant if we have R2 access
      if (this.env?.R2) {
        const variantKey = this.getVariantKey(imageId, variant.name)
        await this.storeVariant(variantKey, Buffer.from(transformedBuffer), variant)
      }
      
      return {
        url: variantUrl,
        width: variant.width || 0,
        height: variant.height || 0,
        format: variant.format || this.defaultFormat,
        size: transformedBuffer.byteLength,
        buffer: Buffer.from(transformedBuffer)
      }
    } catch (error) {
      console.error('Transformation failed, using on-demand URL:', error)
      return this.createOnDemandVariant(imageId, variant)
    }
  }

  /**
   * Build resize options for Cloudflare Workers
   */
  private buildResizeOptions(variant: ImageVariant): Record<string, any> {
    const options: Record<string, any> = {}
    
    // Dimensions
    if (variant.width) {
      options.width = variant.width
    }
    if (variant.height) {
      options.height = variant.height
    }
    
    // Fit mode
    if (variant.fit) {
      const fitMap: Record<string, string> = {
        'cover': 'cover',
        'contain': 'contain',
        'fill': 'scale-down',
        'inside': 'pad',
        'outside': 'crop'
      }
      options.fit = fitMap[variant.fit] || variant.fit
    }
    
    // Format
    options.format = variant.format || this.defaultFormat
    
    // Quality
    options.quality = variant.quality || this.defaultQuality
    
    return options
  }

  /**
   * Create an on-demand variant URL (transformation happens when accessed)
   */
  private createOnDemandVariant(imageId: string, variant: ImageVariant): ProcessedImageVariant {
    const params = new URLSearchParams()
    
    if (variant.width) params.set('width', variant.width.toString())
    if (variant.height) params.set('height', variant.height.toString())
    if (variant.fit) params.set('fit', variant.fit)
    params.set('format', variant.format || this.defaultFormat)
    params.set('quality', (variant.quality || this.defaultQuality).toString())
    
    const variantUrl = `${this.baseUrl}${this.mediaPath}/${imageId}?${params.toString()}`
    
    return {
      url: variantUrl,
      width: variant.width || 0,
      height: variant.height || 0,
      format: variant.format || this.defaultFormat,
      size: 0, // Unknown until transformed
      buffer: null // No buffer for on-demand variants
    }
  }

  /**
   * Get the storage key for a variant
   */
  private getVariantKey(imageId: string, variantName: string): string {
    const format = this.defaultFormat
    if (this.flatStructure) {
      return `${imageId}-${variantName}.${format}`
    } else {
      return `${imageId}/${variantName}.${format}`
    }
  }

  /**
   * Store a variant in R2
   */
  private async storeVariant(
    key: string, 
    buffer: Buffer,
    variant: ImageVariant
  ): Promise<void> {
    if (!this.env?.R2) {
      return
    }
    
    const fullKey = `${this.mediaPath}/${key}`.replace(/^\//, '')
    const contentType = `image/${variant.format || this.defaultFormat}`
    
    try {
      await this.env.R2.put(fullKey, buffer, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000' // 1 year cache
        }
      })
    } catch (error) {
      console.error(`Failed to store variant ${key}:`, error)
    }
  }

  /**
   * Get the URL for a specific variant
   */
  public getImageUrl(imageId: string, variantName?: string): string {
    if (!variantName || variantName === 'original') {
      return `${this.baseUrl}${this.mediaPath}/${imageId}/file`
    }
    
    // Find the variant configuration
    const variant = this.config.variants?.find(v => v.name === variantName)
    if (!variant) {
      return `${this.baseUrl}${this.mediaPath}/${imageId}`
    }
    
    // For immediate processing, return the stored variant URL
    if (this.processingMode === 'immediate') {
      const variantKey = this.getVariantKey(imageId, variantName)
      return `${this.baseUrl}${this.mediaPath}/${variantKey}`
    }
    
    // For on-demand, return URL with transformation parameters
    return this.createOnDemandVariant(imageId, variant).url
  }

  /**
   * Delete image and all variants
   */
  public async deleteImage(imageId: string): Promise<void> {
    if (!this.env?.R2) {
      return
    }
    
    // Delete original
    const originalKey = `${this.mediaPath}/${imageId}`.replace(/^\//, '')
    await this.env.R2.delete(originalKey)
    
    // Delete all stored variants
    if (this.processingMode === 'immediate') {
      for (const variant of this.config.variants || []) {
        const variantKey = this.getVariantKey(imageId, variant.name)
        const fullKey = `${this.mediaPath}/${variantKey}`.replace(/^\//, '')
        await this.env.R2.delete(fullKey)
      }
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    return true
  }
}