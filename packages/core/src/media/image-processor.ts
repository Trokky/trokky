/**
 * Image Processing Architecture
 * 
 * Vendor-agnostic image processing system that supports:
 * - No processing (store originals only)
 * - Local processing with Sharp
 * - Cloud services (Cloudflare Images, ImageKit, Imgix, etc.)
 * - Custom processors
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
}

export interface ProcessedImage {
  original: ProcessedImageVariant
  variants: Record<string, ProcessedImageVariant>
}

export interface ImageProcessorConfig {
  type: 'none' | 'sharp' | 'cloudflare-images' | 'imagekit' | 'imgix' | 'custom'
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
 * No-operation processor that stores only original images
 * Perfect for:
 * - Simple use cases
 * - Performance-critical applications
 * - Edge deployments with no processing needs
 * - Development/testing
 */
export class NoOpImageProcessor extends ImageProcessor {
  async processImage(
    file: File, 
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    // Return only the original file, no variants generated
    return {
      original: {
        url: this.getImageUrl(metadata.id, 'original'),
        width: 0, // Dimensions not analyzed to save processing time
        height: 0,
        format: file.type,
        size: file.size
      },
      variants: {} // No variants generated
    }
  }

  getImageUrl(imageId: string, variantName?: string): string {
    // Simple URL pattern - actual implementation depends on storage adapter
    return `/media/${imageId}`
  }

  async deleteImage(imageId: string): Promise<void> {
    // No variants to delete, original handled by storage adapter
    return
  }

  async healthCheck(): Promise<boolean> {
    return true // No-op processor is always healthy
  }
}

/**
 * Factory function to create image processors
 */
export function createImageProcessor(config: ImageProcessorConfig): ImageProcessor {
  switch (config.type) {
    case 'none':
      return new NoOpImageProcessor(config)
    
    case 'sharp':
      // Dynamic import to avoid Node.js dependency in edge environments
      return createSharpProcessor(config)
    
    case 'cloudflare-images':
      return createCloudflareImagesProcessor(config)
    
    case 'imagekit':
      return createImageKitProcessor(config)
    
    case 'imgix':
      return createImgixProcessor(config)
    
    default:
      throw new Error(`Unknown image processor type: ${config.type}`)
  }
}

// Placeholder functions for other processors - will be implemented separately
function createSharpProcessor(config: ImageProcessorConfig): ImageProcessor {
  throw new Error('Sharp processor not yet implemented. Use type: "none" for now.')
}

function createCloudflareImagesProcessor(config: ImageProcessorConfig): ImageProcessor {
  throw new Error('Cloudflare Images processor not yet implemented. Use type: "none" for now.')
}

function createImageKitProcessor(config: ImageProcessorConfig): ImageProcessor {
  throw new Error('ImageKit processor not yet implemented. Use type: "none" for now.')
}

function createImgixProcessor(config: ImageProcessorConfig): ImageProcessor {
  throw new Error('Imgix processor not yet implemented. Use type: "none" for now.')
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