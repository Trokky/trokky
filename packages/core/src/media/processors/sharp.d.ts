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
import { ImageProcessor, type ImageProcessorConfig, type ProcessedImage } from './types.js';
/**
 * Sharp processor for local image processing
 */
export declare class SharpImageProcessor extends ImageProcessor {
    private sharp;
    constructor(config: ImageProcessorConfig);
    private ensureSharpInitialized;
    processImage(file: File, metadata: {
        id: string;
        filename: string;
        path: string;
    }): Promise<ProcessedImage>;
    getImageUrl(imageId: string, variantName?: string): string;
    deleteImage(imageId: string): Promise<void>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=sharp.d.ts.map