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
    name: string;
    width?: number;
    height?: number;
    format?: 'jpeg' | 'png' | 'webp' | 'avif';
    quality?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}
export interface ProcessedImageVariant {
    url: string;
    width: number;
    height: number;
    format: string;
    size: number;
    buffer?: Buffer;
}
export interface ProcessedImage {
    original: ProcessedImageVariant;
    variants: Record<string, ProcessedImageVariant>;
}
export interface ImageProcessorConfig {
    type: 'none' | 'sharp' | 'cloudflare-images' | 'imagekit' | 'imgix' | 'custom';
    variants?: ImageVariant[];
    options?: Record<string, unknown>;
}
/**
 * Base interface for all image processors
 */
export declare abstract class ImageProcessor {
    protected config: ImageProcessorConfig;
    constructor(config: ImageProcessorConfig);
    /**
     * Process an uploaded image file
     * @param file - The uploaded file
     * @param metadata - File metadata from storage
     * @returns Processed image with variants
     */
    abstract processImage(file: File, metadata: {
        id: string;
        filename: string;
        path: string;
    }): Promise<ProcessedImage>;
    /**
     * Generate URL for a specific variant
     * @param imageId - The image ID
     * @param variantName - The variant name (or 'original')
     * @returns URL to the image variant
     */
    abstract getImageUrl(imageId: string, variantName?: string): string;
    /**
     * Delete all variants of an image
     * @param imageId - The image ID
     */
    abstract deleteImage(imageId: string): Promise<void>;
    /**
     * Health check for the processor
     */
    abstract healthCheck(): Promise<boolean>;
}
/**
 * No-operation processor that stores only original images
 * Perfect for:
 * - Simple use cases
 * - Performance-critical applications
 * - Edge deployments with no processing needs
 * - Development/testing
 */
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
/**
 * Factory function to create image processors
 */
export declare function createImageProcessor(config: ImageProcessorConfig): ImageProcessor;
/**
 * Default image variants for common use cases
 */
export declare const DEFAULT_IMAGE_VARIANTS: ImageVariant[];
//# sourceMappingURL=image-processor.d.ts.map