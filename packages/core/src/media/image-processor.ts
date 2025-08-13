/**
 * Image Processing Architecture - Modular & Bundle-Safe
 * 
 * Vendor-agnostic image processing system with completely isolated processors.
 * Each processor is loaded dynamically to prevent bundling issues in edge environments.
 * 
 * Supports:
 * - No processing (store originals only) - Safe for all environments
 * - Local processing with Sharp - Node.js only, dynamically loaded
 * - Cloud services (Cloudflare Images, ImageKit, Imgix, etc.) - Future implementations
 * - Custom processors
 */

// Import types and base classes from processors module
import type { ImageProcessorConfig } from './processors/index'
import type { ImageProcessor } from './processors/index'

export type {
  ImageVariant,
  ProcessedImageVariant, 
  ProcessedImage,
  ImageProcessorConfig
} from './processors/index'

export { 
  ImageProcessor,
  DEFAULT_IMAGE_VARIANTS 
} from './processors/index'

export { 
  NoOpImageProcessor 
} from './processors/index'

/**
 * Factory function to create image processors
 * Uses dynamic imports to avoid bundling issues in edge environments
 */
export async function createImageProcessor(config: ImageProcessorConfig): Promise<ImageProcessor> {
  switch (config.type) {
    case 'none': {
      // NoOp processor is safe to import statically (no external dependencies)
      const { NoOpImageProcessor } = await import('./processors/noop.js')
      return new NoOpImageProcessor(config)
    }
    
    case 'sharp': {
      // Sharp processor is dynamically imported to avoid bundling issues
      try {
        const { SharpImageProcessor } = await import('./processors/sharp.js')
        return new SharpImageProcessor(config)
      } catch (error) {
        throw new Error(
          `Failed to load Sharp processor: ${error instanceof Error ? error.message : String(error)}\n\n` +
          `Sharp processor is only available in Node.js environments.\n` +
          `For edge environments (Cloudflare Workers, Vercel Edge), use processor: "none" instead.`
        )
      }
    }
    
    case 'cloudflare-images': {
      // Cloudflare Images processor - future implementation
      try {
        const { CloudflareImagesProcessor } = await import('./processors/cloudflare-images.js')
        return new CloudflareImagesProcessor(config as any)
      } catch (error) {
        throw new Error(
          `Failed to load Cloudflare Images processor: ${error instanceof Error ? error.message : String(error)}\n\n` +
          `This processor is not yet implemented. Use processor: "none" for now.`
        )
      }
    }
    
    case 'imagekit': {
      throw new Error(
        'ImageKit processor is not yet implemented.\n' +
        'Use processor: "none" for edge environments or "sharp" for Node.js environments.'
      )
    }
    
    case 'imgix': {
      throw new Error(
        'Imgix processor is not yet implemented.\n' +
        'Use processor: "none" for edge environments or "sharp" for Node.js environments.'
      )
    }
    
    default:
      throw new Error(
        `Unknown image processor type: ${config.type}\n\n` +
        `Available processors:\n` +
        `- "none": Store originals only (recommended for edge environments)\n` +
        `- "sharp": Local processing with Sharp (Node.js only)\n` +
        `- "cloudflare-images": Cloudflare Images API (coming soon)\n` +
        `- "imagekit": ImageKit API (coming soon)\n` +
        `- "imgix": Imgix API (coming soon)`
      )
  }
}