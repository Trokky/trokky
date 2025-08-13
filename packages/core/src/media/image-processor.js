/**
 * Image Processing Architecture
 *
 * Vendor-agnostic image processing system that supports:
 * - No processing (store originals only)
 * - Local processing with Sharp
 * - Cloud services (Cloudflare Images, ImageKit, Imgix, etc.)
 * - Custom processors
 */
/**
 * Base interface for all image processors
 */
export class ImageProcessor {
    config;
    constructor(config) {
        this.config = config;
    }
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
/**
 * Factory function to create image processors
 */
export function createImageProcessor(config) {
    switch (config.type) {
        case 'none':
            return new NoOpImageProcessor(config);
        case 'sharp':
            // Dynamic import to avoid Node.js dependency in edge environments
            return createSharpProcessor(config);
        case 'cloudflare-images':
            return createCloudflareImagesProcessor(config);
        case 'imagekit':
            return createImageKitProcessor(config);
        case 'imgix':
            return createImgixProcessor(config);
        default:
            throw new Error(`Unknown image processor type: ${config.type}`);
    }
}
/**
 * Sharp processor for local image processing
 * Perfect for:
 * - Node.js server environments
 * - Self-hosted deployments
 * - Development with immediate processing
 */
class SharpImageProcessor extends ImageProcessor {
    sharp;
    constructor(config) {
        super(config);
        // Sharp will be initialized lazily when first used
    }
    async ensureSharpInitialized() {
        if (!this.sharp) {
            try {
                // Dynamic import to avoid issues in edge environments
                const sharpModule = await import('sharp');
                this.sharp = sharpModule.default || sharpModule;
            }
            catch (error) {
                throw new Error('Sharp is not installed. Run: npm install sharp');
            }
        }
    }
    async processImage(file, metadata) {
        await this.ensureSharpInitialized();
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Get original image metadata
        const originalSharp = this.sharp(buffer);
        const originalMetadata = await originalSharp.metadata();
        const original = {
            url: this.getImageUrl(metadata.id, 'original'),
            width: originalMetadata.width || 0,
            height: originalMetadata.height || 0,
            format: originalMetadata.format || 'unknown',
            size: file.size
            // No buffer for original - it's already saved by the storage adapter
        };
        const variants = {};
        // Process each variant
        for (const variant of this.config.variants || []) {
            try {
                let sharpInstance = this.sharp(buffer);
                // Apply transformations
                if (variant.width || variant.height) {
                    const resizeOptions = {};
                    if (variant.fit) {
                        resizeOptions.fit = variant.fit;
                    }
                    sharpInstance = sharpInstance.resize(variant.width, variant.height, resizeOptions);
                }
                // Set output format and quality
                if (variant.format) {
                    switch (variant.format) {
                        case 'jpeg':
                            sharpInstance = sharpInstance.jpeg({ quality: variant.quality || 80 });
                            break;
                        case 'png':
                            sharpInstance = sharpInstance.png({ quality: variant.quality || 80 });
                            break;
                        case 'webp':
                            sharpInstance = sharpInstance.webp({ quality: variant.quality || 80 });
                            break;
                        case 'avif':
                            sharpInstance = sharpInstance.avif({ quality: variant.quality || 80 });
                            break;
                    }
                }
                // Get processed image info
                const processedBuffer = await sharpInstance.toBuffer({ resolveWithObject: true });
                variants[variant.name] = {
                    url: this.getImageUrl(metadata.id, variant.name),
                    width: processedBuffer.info.width,
                    height: processedBuffer.info.height,
                    format: processedBuffer.info.format,
                    size: processedBuffer.data.length,
                    buffer: processedBuffer.data // Store buffer for saving
                };
            }
            catch (error) {
                console.warn(`Failed to process variant ${variant.name}:`, error);
            }
        }
        return { original, variants };
    }
    getImageUrl(imageId, variantName) {
        if (!variantName || variantName === 'original') {
            return `/media/${imageId}`;
        }
        return `/media/${imageId}/${variantName}`;
    }
    async deleteImage(imageId) {
        // TODO: Delete all variant files from storage
        // This would integrate with the storage adapter to delete variant files
        return;
    }
    async healthCheck() {
        try {
            await this.ensureSharpInitialized();
            // Test Sharp by creating a simple 1x1 image
            await this.sharp({
                create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } }
            }).png().toBuffer();
            return true;
        }
        catch (error) {
            console.error('Sharp health check failed:', error);
            return false;
        }
    }
}
// Sharp processor factory
function createSharpProcessor(config) {
    return new SharpImageProcessor(config);
}
function createCloudflareImagesProcessor(config) {
    throw new Error('Cloudflare Images processor not yet implemented. Use type: "none" for now.');
}
function createImageKitProcessor(config) {
    throw new Error('ImageKit processor not yet implemented. Use type: "none" for now.');
}
function createImgixProcessor(config) {
    throw new Error('Imgix processor not yet implemented. Use type: "none" for now.');
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
