/**
 * Shared types for all image processors
 */

export interface ImageVariant {
  name: string
  width?: number
  height?: number
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

export interface ProcessedImageVariant {
  url: string
  width: number
  height: number
  format: string
  size: number
  buffer?: Buffer | null // Optional buffer for variant file data (null for URL-only variants)
}

export interface ProcessedImage {
  original: ProcessedImageVariant
  variants: Record<string, ProcessedImageVariant>
}

export interface ImageProcessorConfig {
  type: 'none' | 'sharp' | 'cloudflare-images' | 'cloudflare-transformations' | 'cloudflare-transform-store' | 'workers-images' | 'imagekit' | 'imgix' | 'custom'
  variants?: ImageVariant[]
  options?: Record<string, unknown>
}

/**
 * Base interface for all image processors
 */
export abstract class ImageProcessor {
  protected config: ImageProcessorConfig

  constructor(config: ImageProcessorConfig) {
    this.config = config
  }

  /**
   * Process an uploaded image file
   * @param file - The uploaded file
   * @param metadata - File metadata from storage
   * @returns Processed image with variants
   */
  abstract processImage(
    file: File, 
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage>

  /**
   * Generate URL for a specific variant
   * @param imageId - The image ID
   * @param variantName - The variant name (or 'original')
   * @returns URL to the image variant
   */
  abstract getImageUrl(imageId: string, variantName?: string): string

  /**
   * Delete all variants of an image
   * @param imageId - The image ID
   */
  abstract deleteImage(imageId: string): Promise<void>

  /**
   * Health check for the processor
   */
  abstract healthCheck(): Promise<boolean>
}

/**
 * Default image variants for common use cases
 */
export const DEFAULT_IMAGE_VARIANTS: ImageVariant[] = [
  {
    name: 'thumbnail',
    width: 200,
    height: 200,
    format: 'webp',
    quality: 80,
    fit: 'cover'
  },
  {
    name: 'preview',
    width: 800,
    height: 600,
    format: 'webp',
    quality: 85,
    fit: 'inside'
  },
  {
    name: 'large',
    width: 1200,
    height: 1200,
    format: 'webp',
    quality: 90,
    fit: 'inside'
  }
]