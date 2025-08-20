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
import { ImageProcessor, type ProcessedImage } from './types.js';
export declare class NoOpImageProcessor extends ImageProcessor {
    processImage(file: File, metadata: {
        id: string;
        filename: string;
        path: string;
    }): Promise<ProcessedImage>;
    getImageUrl(imageId: string, variantName?: string): string;
    deleteImage(imageId: string): Promise<void>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=noop.d.ts.map