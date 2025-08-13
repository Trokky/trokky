/**
 * Sharp Image Processor - Completely Isolated Module
 * 
 * This file is NEVER imported statically. Only loaded dynamically 
 * when 'sharp' processor is explicitly requested.
 * 
 * Perfect for:
 * - Node.js server environments
 * - Self-hosted deployments
 * - Development with immediate processing
 */

import { 
  ImageProcessor, 
  type ImageProcessorConfig, 
  type ProcessedImage, 
  type ProcessedImageVariant 
} from './types.js'

// Type for dynamically imported Sharp
type SharpInstance = any

/**
 * Sharp processor for local image processing
 */
export class SharpImageProcessor extends ImageProcessor {
  private sharp: SharpInstance

  constructor(config: ImageProcessorConfig) {
    super(config)
    // Sharp will be initialized lazily when first used
  }

  private async ensureSharpInitialized() {
    if (!this.sharp) {
      try {
        // Dynamic import to avoid issues in edge environments
        const sharpModule = await import('sharp')
        this.sharp = sharpModule.default || sharpModule
      } catch (error) {
        throw new Error(
          'Sharp is not installed. Run: npm install sharp\n' +
          'Note: Sharp is only supported in Node.js environments, not in edge runtimes like Cloudflare Workers.'
        )
      }
    }
  }

  async processImage(
    file: File, 
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    await this.ensureSharpInitialized()

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Get original image metadata
    const originalSharp = this.sharp(buffer)
    const originalMetadata = await originalSharp.metadata()

    const original: ProcessedImageVariant = {
      url: this.getImageUrl(metadata.id, 'original'),
      width: originalMetadata.width || 0,
      height: originalMetadata.height || 0,
      format: originalMetadata.format || 'unknown',
      size: file.size
      // No buffer for original - it's already saved by the storage adapter
    }

    const variants: Record<string, ProcessedImageVariant> = {}

    // Process each variant
    for (const variant of this.config.variants || []) {
      try {
        let sharpInstance = this.sharp(buffer)

        // Apply transformations
        if (variant.width || variant.height) {
          const resizeOptions: any = {}
          
          if (variant.fit) {
            resizeOptions.fit = variant.fit
          }
          
          sharpInstance = sharpInstance.resize(variant.width, variant.height, resizeOptions)
        }

        // Set output format and quality
        if (variant.format) {
          switch (variant.format) {
            case 'jpeg':
              sharpInstance = sharpInstance.jpeg({ quality: variant.quality || 80 })
              break
            case 'png':
              sharpInstance = sharpInstance.png({ quality: variant.quality || 80 })
              break
            case 'webp':
              sharpInstance = sharpInstance.webp({ quality: variant.quality || 80 })
              break
            case 'avif':
              sharpInstance = sharpInstance.avif({ quality: variant.quality || 80 })
              break
          }
        }

        // Get processed image info
        const processedBuffer = await sharpInstance.toBuffer({ resolveWithObject: true })
        
        variants[variant.name] = {
          url: this.getImageUrl(metadata.id, variant.name),
          width: processedBuffer.info.width,
          height: processedBuffer.info.height,
          format: processedBuffer.info.format,
          size: processedBuffer.data.length,
          buffer: processedBuffer.data // Store buffer for saving
        }
        
      } catch (error) {
        console.warn(`Failed to process variant ${variant.name}:`, error)
      }
    }

    return { original, variants }
  }

  getImageUrl(imageId: string, variantName?: string): string {
    if (!variantName || variantName === 'original') {
      return `/media/${imageId}`
    }
    return `/media/${imageId}/${variantName}`
  }

  async deleteImage(imageId: string): Promise<void> {
    // TODO: Delete all variant files from storage
    // This would integrate with the storage adapter to delete variant files
    return
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureSharpInitialized()
      // Test Sharp by creating a simple 1x1 image
      await this.sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).png().toBuffer()
      return true
    } catch (error) {
      console.error('Sharp health check failed:', error)
      return false
    }
  }
}