/**
 * Cloudflare Images Processor
 * 
 * Integrates with Cloudflare Images for:
 * - Automatic image optimization
 * - Global CDN delivery
 * - Real-time transformations
 * - WebP/AVIF conversion
 * 
 * Supports two modes:
 * 1. Images API Binding (Workers) - Direct image manipulation in Workers
 * 2. Upload API - Traditional HTTP API for external usage
 */

import { 
  ImageProcessor, 
  type ImageProcessorConfig, 
  type ProcessedImage,
  type ProcessedImageVariant,
  type ImageVariant
} from './types'

export interface CloudflareImagesConfig extends ImageProcessorConfig {
  type: 'cloudflare-images'
  options: {
    accountId: string
    apiToken?: string // For Upload API
    deliveryUrl?: string // Custom delivery URL or default to imagedelivery.net
    defaultVariant?: string // Default variant name (default: 'public')
    // For Workers binding mode
    binding?: {
      enabled: boolean
      bindingName?: string // Default: 'IMAGES'
    }
  }
}

interface CloudflareImagesEnv {
  IMAGES?: {
    input(buffer: ArrayBuffer): CloudflareImageTransform
  }
}

interface CloudflareImageTransform {
  transform(options: CloudflareTransformOptions): CloudflareImageTransform
  output(): Promise<ArrayBuffer>
}

interface CloudflareTransformOptions {
  width?: number
  height?: number
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
}

interface CloudflareImagesUploadResponse {
  result: {
    id: string
    filename: string
    uploaded: string
    variants: string[]
  }
  success: boolean
  errors: any[]
  messages: any[]
}

export class CloudflareImagesProcessor extends ImageProcessor {
  private accountId: string
  private apiToken?: string
  private deliveryUrl: string
  private defaultVariant: string
  private bindingEnabled: boolean
  private bindingName: string
  private env?: CloudflareImagesEnv

  constructor(config: CloudflareImagesConfig) {
    super(config)
    
    const { accountId, apiToken, deliveryUrl, defaultVariant, binding } = config.options
    
    this.accountId = accountId
    this.apiToken = apiToken
    this.deliveryUrl = deliveryUrl || `https://imagedelivery.net/${accountId}`
    this.defaultVariant = defaultVariant || 'public'
    this.bindingEnabled = binding?.enabled || false
    this.bindingName = binding?.bindingName || 'IMAGES'
  }

  /**
   * Set the Workers environment for binding mode
   */
  setEnv(env: CloudflareImagesEnv): void {
    this.env = env
  }

  async processImage(
    file: File, 
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    // Try binding mode first if enabled
    if (this.bindingEnabled && this.env?.IMAGES) {
      try {
        return await this.processWithBinding(file, metadata)
      } catch (error: any) {
        // In development, binding might not work - fall back to Upload API
        if (error.message?.includes('wrangler dev') || error.message?.includes('proxy to')) {
          console.warn('Cloudflare Images binding failed in development, falling back to Upload API:', error.message)
          if (!this.apiToken) {
            throw new Error('Cloudflare Images API token is required as fallback when binding fails in development')
          }
          return this.processWithUploadAPI(file, metadata)
        }
        throw error // Re-throw other errors
      }
    }
    
    // Use Upload API mode
    if (!this.apiToken) {
      throw new Error('Cloudflare Images API token is required when not using binding mode')
    }
    
    return this.processWithUploadAPI(file, metadata)
  }

  /**
   * Process image using Workers binding (edge-native)
   */
  private async processWithBinding(
    file: File,
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    if (!this.env?.IMAGES) {
      throw new Error('Cloudflare Images binding not available in environment')
    }

    const buffer = await file.arrayBuffer()
    const variants: Record<string, ProcessedImageVariant> = {}
    
    // Process original
    const original: ProcessedImageVariant = {
      url: this.getImageUrl(metadata.id, 'original'),
      width: 0, // Will be set by Cloudflare
      height: 0,
      format: file.type.split('/')[1] || 'jpeg',
      size: file.size,
      buffer: Buffer.from(buffer)
    }

    // Process each variant using the binding
    for (const variant of this.config.variants || []) {
      const transformedBuffer = await this.env.IMAGES
        .input(buffer)
        .transform(this.mapVariantToCloudflareOptions(variant))
        .output()

      variants[variant.name] = {
        url: this.getImageUrl(metadata.id, variant.name),
        width: variant.width || 0,
        height: variant.height || 0,
        format: variant.format || 'webp',
        size: transformedBuffer.byteLength,
        buffer: Buffer.from(transformedBuffer)
      }
    }

    return { original, variants }
  }

  /**
   * Process image using Upload API (traditional HTTP)
   */
  private async processWithUploadAPI(
    file: File,
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('id', metadata.id)
    
    // Add metadata
    const customMetadata = {
      filename: metadata.filename,
      path: metadata.path,
      uploadedAt: new Date().toISOString()
    }
    formData.append('metadata', JSON.stringify(customMetadata))
    
    // Configure variants if specified
    if (this.config.variants && this.config.variants.length > 0) {
      const variantConfig = this.createVariantConfig(this.config.variants)
      formData.append('requireSignedURLs', 'false')
      formData.append('variants', JSON.stringify(variantConfig))
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to upload image to Cloudflare: ${error}`)
    }

    const result = await response.json() as CloudflareImagesUploadResponse
    
    if (!result.success) {
      throw new Error(`Cloudflare Images API error: ${result.errors.join(', ')}`)
    }

    // Build processed image response
    const variants: Record<string, ProcessedImageVariant> = {}
    
    for (const variant of this.config.variants || []) {
      variants[variant.name] = {
        url: this.getImageUrl(result.result.id, variant.name),
        width: variant.width || 0,
        height: variant.height || 0,
        format: variant.format || 'webp',
        size: 0 // Size not available from Upload API
      }
    }

    return {
      original: {
        url: this.getImageUrl(result.result.id, 'original'),
        width: 0, // Dimensions not available from Upload API
        height: 0,
        format: file.type.split('/')[1] || 'jpeg',
        size: file.size
      },
      variants
    }
  }

  /**
   * Map Trokky variant config to Cloudflare transform options
   */
  private mapVariantToCloudflareOptions(variant: ImageVariant): CloudflareTransformOptions {
    const options: CloudflareTransformOptions = {}
    
    if (variant.width) options.width = variant.width
    if (variant.height) options.height = variant.height
    if (variant.quality) options.quality = variant.quality
    if (variant.format) options.format = variant.format as CloudflareTransformOptions['format']
    
    // Map fit modes
    if (variant.fit) {
      const fitMap: Record<string, CloudflareTransformOptions['fit']> = {
        'cover': 'cover',
        'contain': 'contain',
        'fill': 'crop',
        'inside': 'scale-down',
        'outside': 'pad'
      }
      options.fit = fitMap[variant.fit] || 'scale-down'
    }
    
    return options
  }

  /**
   * Create variant configuration for Upload API
   */
  private createVariantConfig(variants: ImageVariant[]): Record<string, any> {
    const config: Record<string, any> = {}
    
    for (const variant of variants) {
      config[variant.name] = {
        width: variant.width,
        height: variant.height,
        fit: variant.fit || 'scale-down',
        metadata: {
          quality: variant.quality,
          format: variant.format
        }
      }
    }
    
    return config
  }

  getImageUrl(imageId: string, variantName?: string): string {
    const variant = variantName || this.defaultVariant
    return `${this.deliveryUrl}/${imageId}/${variant}`
  }

  async deleteImage(imageId: string): Promise<void> {
    if (!this.apiToken) {
      throw new Error('Cloudflare Images API token is required for delete operations')
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      }
    )

    if (!response.ok && response.status !== 404) {
      const error = await response.text()
      throw new Error(`Failed to delete image from Cloudflare: ${error}`)
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check binding availability
    if (this.bindingEnabled && this.env?.IMAGES) {
      return true
    }
    
    // Check Upload API connectivity
    if (this.apiToken) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1/stats`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            }
          }
        )
        return response.ok
      } catch {
        return false
      }
    }
    
    return false
  }
}