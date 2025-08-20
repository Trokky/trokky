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
import type { ImageProcessorConfig } from './processors/index.js';
import type { ImageProcessor } from './processors/index.js';
export type { ImageVariant, ProcessedImageVariant, ProcessedImage, ImageProcessorConfig } from './processors/index.js';
export { ImageProcessor, DEFAULT_IMAGE_VARIANTS } from './processors/index.js';
export { NoOpImageProcessor } from './processors/index.js';
/**
 * Factory function to create image processors
 * Uses dynamic imports to avoid bundling issues in edge environments
 * Note: All processor imports now use consistent module resolution
 */
export declare function createImageProcessor(config: ImageProcessorConfig): Promise<ImageProcessor>;
//# sourceMappingURL=image-processor.d.ts.map