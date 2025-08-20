/**
 * Shared types for all image processors
 */
/**
 * Base interface for all image processors
 */
export class ImageProcessor {
    constructor(config) {
        this.config = config;
    }
}
/**
 * Default image variants for common use cases
 */
export const DEFAULT_IMAGE_VARIANTS = [
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
];
//# sourceMappingURL=types.js.map