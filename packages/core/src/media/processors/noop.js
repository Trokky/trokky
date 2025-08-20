/**
 * No-Operation Image Processor
 *
 * Stores only original images without any processing.
 * Perfect for:
 * - Edge deployments (Cloudflare Workers, Vercel Edge, etc.)
 * - Simple use cases where processing isn't needed
 * - Performance-critical applications
 * - Development/testing
 */
import { ImageProcessor } from './types.js';
export class NoOpImageProcessor extends ImageProcessor {
    async processImage(file, metadata) {
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
        };
    }
    getImageUrl(imageId, variantName) {
        // Simple URL pattern - actual implementation depends on storage adapter
        return `/media/${imageId}`;
    }
    async deleteImage(imageId) {
        // No variants to delete, original handled by storage adapter
        return;
    }
    async healthCheck() {
        return true; // No-op processor is always healthy
    }
}
//# sourceMappingURL=noop.js.map