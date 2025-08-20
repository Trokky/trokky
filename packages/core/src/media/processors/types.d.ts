/**
 * Shared types for all image processors
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
    buffer?: Buffer | null;
}
export interface ProcessedImage {
    original: ProcessedImageVariant;
    variants: Record<string, ProcessedImageVariant>;
}
export interface ImageProcessorConfig {
    type: 'none' | 'sharp' | 'cloudflare-images' | 'cloudflare-transformations' | 'cloudflare-transform-store' | 'workers-images' | 'imagekit' | 'imgix' | 'custom';
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
 * Default image variants for common use cases
 */
export declare const DEFAULT_IMAGE_VARIANTS: ImageVariant[];
//# sourceMappingURL=types.d.ts.map