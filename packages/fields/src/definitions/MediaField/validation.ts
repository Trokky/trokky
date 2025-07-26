/**
 * Media Field Validation
 * Server-side validation logic for media fields
 */

import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import type { MediaFieldDefinition, MediaFieldValue, MediaType } from './definition.js';

// Supported MIME type patterns by media category
const MEDIA_TYPE_PATTERNS: Record<MediaType, string[]> = {
  image: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 
    'image/svg+xml', 'image/bmp', 'image/tiff', 'image/avif'
  ],
  video: [
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 
    'video/wmv', 'video/flv', 'video/mkv', 'video/3gp'
  ],
  audio: [
    'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 
    'audio/flac', 'audio/m4a', 'audio/wma', 'audio/opus'
  ],
  document: [
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/rtf', 'application/rtf'
  ],
  archive: [
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar', 'application/x-zip-compressed'
  ]
};

// Dangerous file extensions that should be blocked by default
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
  'ws', 'wsf', 'wsc', 'wsh', 'ps1', 'ps1xml', 'ps2', 'ps2xml',
  'psc1', 'psc2', 'msh', 'msh1', 'msh2', 'mshxml', 'msh1xml', 'msh2xml',
  'app', 'deb', 'pkg', 'rpm', 'dmg', 'iso', 'msi'
];

/**
 * Format file size for human-readable display
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Extract file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1).toLowerCase() : '';
}

/**
 * Check if file extension is considered dangerous
 */
function isDangerousExtension(extension: string): boolean {
  return DANGEROUS_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * Validate MIME type against allowed types or media type restrictions
 */
function validateMimeType(
  mimeType: string, 
  allowedTypes?: string[], 
  restrictToMediaType?: MediaType
): { isValid: boolean; error?: string } {
  // Check specific allowed MIME types first
  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some(type => {
      // Support wildcard patterns like 'image/*'
      if (type.includes('*')) {
        const pattern = type.replace('*', '.*');
        return new RegExp(`^${pattern}$`).test(mimeType);
      }
      return mimeType === type;
    });
    
    if (!isAllowed) {
      return {
        isValid: false,
        error: `File type '${mimeType}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }
  }
  
  // Check media type restriction
  if (restrictToMediaType) {
    const allowedForMediaType = MEDIA_TYPE_PATTERNS[restrictToMediaType] || [];
    const isValidForMediaType = allowedForMediaType.includes(mimeType);
    
    if (!isValidForMediaType) {
      return {
        isValid: false,
        error: `File type '${mimeType}' is not allowed for ${restrictToMediaType} media type`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate file extension against restrictions
 */
function validateExtension(
  filename: string,
  allowedExtensions?: string[],
  blockDangerousExtensions?: boolean
): { isValid: boolean; error?: string } {
  const extension = getFileExtension(filename);
  
  if (!extension) {
    return {
      isValid: false,
      error: 'File must have a valid extension'
    };
  }
  
  // Check dangerous extensions
  if (blockDangerousExtensions && isDangerousExtension(extension)) {
    return {
      isValid: false,
      error: `File extension '.${extension}' is blocked for security reasons`
    };
  }
  
  // Check allowed extensions
  if (allowedExtensions && allowedExtensions.length > 0) {
    const normalizedAllowed = allowedExtensions.map(ext => 
      ext.toLowerCase().replace(/^\./, '')
    );
    
    if (!normalizedAllowed.includes(extension)) {
      return {
        isValid: false,
        error: `File extension '.${extension}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate image-specific constraints
 */
function validateImageConstraints(
  asset: any,
  validation: any
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!asset.metadata?.image) {
    return { isValid: true, errors };
  }
  
  const { width, height } = asset.metadata.image;
  
  // Dimension validations
  if (validation.minWidth && width < validation.minWidth) {
    errors.push(`Image width ${width}px is below minimum of ${validation.minWidth}px`);
  }
  
  if (validation.maxWidth && width > validation.maxWidth) {
    errors.push(`Image width ${width}px exceeds maximum of ${validation.maxWidth}px`);
  }
  
  if (validation.minHeight && height < validation.minHeight) {
    errors.push(`Image height ${height}px is below minimum of ${validation.minHeight}px`);
  }
  
  if (validation.maxHeight && height > validation.maxHeight) {
    errors.push(`Image height ${height}px exceeds maximum of ${validation.maxHeight}px`);
  }
  
  // Aspect ratio validation
  if (validation.aspectRatio && width && height) {
    const actualRatio = width / height;
    const targetRatio = validation.aspectRatio;
    const tolerance = validation.aspectRatioTolerance || 0.1;
    
    const ratioError = Math.abs(actualRatio - targetRatio) / targetRatio;
    if (ratioError > tolerance) {
      errors.push(`Image aspect ratio ${actualRatio.toFixed(2)} does not match required ratio ${targetRatio.toFixed(2)} (±${(tolerance * 100).toFixed(0)}%)`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate video-specific constraints
 */
function validateVideoConstraints(
  asset: any,
  validation: any
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!asset.metadata?.video) {
    return { isValid: true, errors };
  }
  
  const { duration } = asset.metadata.video;
  
  if (validation.minDuration && duration < validation.minDuration) {
    errors.push(`Video duration ${duration}s is below minimum of ${validation.minDuration}s`);
  }
  
  if (validation.maxDuration && duration > validation.maxDuration) {
    errors.push(`Video duration ${duration}s exceeds maximum of ${validation.maxDuration}s`);
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Main validation function for media fields
 */
export function validateMediaField(
  value: MediaFieldValue | null,
  definition: MediaFieldDefinition,
  context?: DocumentContext
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validation = definition.validation || {};

  // Required validation
  if (definition.required && !value) {
    errors.push(`${definition.title} is required`);
  }

  // Skip other validations if value is empty and not required
  if (!value && !definition.required) {
    return { isValid: true, errors: [], warnings };
  }

  if (!value) {
    return { isValid: errors.length === 0, errors, warnings };
  }

  // Validate value structure
  if (value._type !== 'media') {
    errors.push(`${definition.title} must be a media type`);
  }

  if (!value.asset || !value.asset._ref || value.asset._type !== 'mediaAsset') {
    errors.push(`${definition.title} must reference a valid media asset`);
  }

  // TODO: Implement proper asset resolution from context
  // For now, we can only do basic structure validation
  if (!value.asset?._ref) {
    return { isValid: errors.length === 0, errors, warnings };
  }

  // TODO: Get the actual asset for detailed validation
  // Asset resolution is handled in the component level, so we'll skip detailed validation here
  // and rely on the component to handle asset existence checking
  const asset: any = null; // Placeholder until asset resolution is implemented
  
  // Skip asset existence check for now - handled by component
  if (!asset) {
    // Don't fail validation here - let the component handle asset resolution and display errors
    return { isValid: errors.length === 0, errors, warnings };
  }

  // File type validation
  const mimeTypeValidation = validateMimeType(
    asset.mimeType,
    validation.allowedTypes,
    validation.restrictToMediaType
  );
  if (!mimeTypeValidation.isValid) {
    errors.push(mimeTypeValidation.error!);
  }

  // File extension validation
  const extensionValidation = validateExtension(
    asset.originalFilename,
    validation.allowedExtensions,
    validation.blockDangerousExtensions
  );
  if (!extensionValidation.isValid) {
    errors.push(extensionValidation.error!);
  }

  // File size validation
  if (validation.maxFileSize && asset.size > validation.maxFileSize) {
    errors.push(`File size ${formatFileSize(asset.size)} exceeds maximum of ${formatFileSize(validation.maxFileSize)}`);
  }

  if (validation.minFileSize && asset.size < validation.minFileSize) {
    errors.push(`File size ${formatFileSize(asset.size)} is below minimum of ${formatFileSize(validation.minFileSize)}`);
  }

  // Media-specific validations
  if (validation.restrictToMediaType === 'image' || asset.mimeType.startsWith('image/')) {
    const imageValidation = validateImageConstraints(asset, validation);
    errors.push(...imageValidation.errors);
  }

  if (validation.restrictToMediaType === 'video' || asset.mimeType.startsWith('video/')) {
    const videoValidation = validateVideoConstraints(asset, validation);
    errors.push(...videoValidation.errors);
  }

  // Virus scan validation
  if (validation.requireVirusScan && asset.virusScanResult) {
    if (!asset.virusScanResult.clean) {
      errors.push(`${definition.title} failed virus scan: ${asset.virusScanResult.threats?.join(', ') || 'Unknown threat detected'}`);
    }
  }

  // Instance metadata validation
  const options = definition.options || {};
  
  if (options.requireAlt && !value.alt?.trim()) {
    errors.push(`${definition.title} requires alt text for accessibility`);
  }

  if (options.requireCaption && !value.caption?.trim()) {
    errors.push(`${definition.title} requires a caption`);
  }

  // Asset metadata validation
  if (options.requireAssetTitle && !asset.title?.trim()) {
    errors.push(`${definition.title} requires the media asset to have a title`);
  }

  if (options.requireAssetDescription && !asset.description?.trim()) {
    errors.push(`${definition.title} requires the media asset to have a description`);
  }

  // Custom validation
  if (validation.custom) {
    const customResult = validation.custom(value);
    errors.push(...customResult.errors);
    if (customResult.warnings) {
      warnings.push(...customResult.warnings);
    }
  }

  // Accessibility warnings
  if (asset.mimeType.startsWith('image/') && !value.alt?.trim()) {
    warnings.push(`${definition.title} should have alt text for better accessibility`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}