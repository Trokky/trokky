/**
 * Image Field Type Implementation
 * Image field with asset management, validation, and metadata
 */

import type { FieldType, ValidationResult, FieldContext } from '@trokky/core'
import { FieldCategory } from '@trokky/core'
import { createValidationResult, createValidationError, getFieldPath } from '../utils/validation.js'

export interface ImageFieldConfig {
  // Allow empty/null image
  allowEmpty?: boolean
  
  // Accepted file types (MIME types)
  acceptedTypes?: string[]
  
  // Maximum file size in bytes
  maxFileSize?: number
  
  // Minimum file size in bytes
  minFileSize?: number
  
  // Maximum dimensions
  maxWidth?: number
  maxHeight?: number
  
  // Minimum dimensions
  minWidth?: number
  minHeight?: number
  
  // Required aspect ratios (width/height)
  aspectRatios?: number[]
  
  // Allow aspect ratio tolerance (percentage)
  aspectRatioTolerance?: number
  
  // Require alt text
  requireAlt?: boolean
  
  // Maximum alt text length
  maxAltLength?: number
  
  // Enable hotspot/crop functionality
  enableHotspot?: boolean
  
  // Enable crop functionality
  enableCrop?: boolean
  
  // Custom validation function
  customValidator?: (value: ImageValue) => boolean | string
  
  // Upload directory/path
  uploadPath?: string
  
  // Generate thumbnails
  generateThumbnails?: ThumbnailConfig[]
  
  // Allow external URLs
  allowExternalURLs?: boolean
  
  // Metadata to extract/store
  storeMetadata?: boolean
}

export interface ThumbnailConfig {
  name: string
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

export interface ImageValue {
  // Asset reference ID
  _ref?: string
  
  // Asset type
  _type: 'reference'
  
  // Alt text for accessibility
  alt?: string
  
  // Caption
  caption?: string
  
  // Hotspot for focal point
  hotspot?: {
    x: number
    y: number
    height: number
    width: number
  }
  
  // Crop area
  crop?: {
    top: number
    bottom: number
    left: number
    right: number
  }
  
  // Custom metadata
  metadata?: Record<string, any>
}

export interface ImageAsset {
  // Unique asset ID
  _id: string
  
  // Asset type
  _type: 'imageAsset'
  
  // Original filename
  originalFilename: string
  
  // File extension
  extension: string
  
  // MIME type
  mimeType: string
  
  // File size in bytes
  size: number
  
  // Image dimensions
  dimensions: {
    width: number
    height: number
    aspectRatio: number
  }
  
  // Upload metadata
  uploadedAt: string
  uploadedBy?: string
  
  // File paths/URLs
  url: string
  path: string
  
  // Generated thumbnails
  thumbnails?: Record<string, {
    url: string
    path: string
    width: number
    height: number
    size: number
  }>
  
  // Extracted metadata
  metadata?: {
    exif?: Record<string, any>
    iptc?: Record<string, any>
    format?: string
    colorSpace?: string
    hasAlpha?: boolean
    orientation?: number
  }
}

// Default image configuration
const DEFAULT_IMAGE_CONFIG: Required<Omit<ImageFieldConfig, 'acceptedTypes' | 'maxFileSize' | 'minFileSize' | 'maxWidth' | 'maxHeight' | 'minWidth' | 'minHeight' | 'aspectRatios' | 'aspectRatioTolerance' | 'maxAltLength' | 'customValidator' | 'uploadPath' | 'generateThumbnails'>> = {
  allowEmpty: false,
  requireAlt: false,
  enableHotspot: false,
  enableCrop: false,
  allowExternalURLs: false,
  storeMetadata: true
}

// Default accepted image types
const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]

// Maximum file size (10MB by default)
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

// Validate image asset
function validateImageAsset(asset: ImageAsset | null, config: ImageFieldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!asset) {
    return { valid: !config.allowEmpty, errors: config.allowEmpty ? [] : ['Image asset is required'] }
  }
  
  // Validate file type
  const acceptedTypes = config.acceptedTypes || DEFAULT_ACCEPTED_TYPES
  if (!acceptedTypes.includes(asset.mimeType)) {
    errors.push(`File type '${asset.mimeType}' is not allowed. Accepted types: ${acceptedTypes.join(', ')}`)
  }
  
  // Validate file size
  const maxSize = config.maxFileSize || DEFAULT_MAX_FILE_SIZE
  if (asset.size > maxSize) {
    errors.push(`File size ${formatFileSize(asset.size)} exceeds maximum of ${formatFileSize(maxSize)}`)
  }
  
  if (config.minFileSize && asset.size < config.minFileSize) {
    errors.push(`File size ${formatFileSize(asset.size)} is below minimum of ${formatFileSize(config.minFileSize)}`)
  }
  
  // Validate dimensions
  const { width, height } = asset.dimensions
  
  if (config.maxWidth && width > config.maxWidth) {
    errors.push(`Image width ${width}px exceeds maximum of ${config.maxWidth}px`)
  }
  
  if (config.maxHeight && height > config.maxHeight) {
    errors.push(`Image height ${height}px exceeds maximum of ${config.maxHeight}px`)
  }
  
  if (config.minWidth && width < config.minWidth) {
    errors.push(`Image width ${width}px is below minimum of ${config.minWidth}px`)
  }
  
  if (config.minHeight && height < config.minHeight) {
    errors.push(`Image height ${height}px is below minimum of ${config.minHeight}px`)
  }
  
  // Validate aspect ratios
  if (config.aspectRatios && config.aspectRatios.length > 0) {
    const tolerance = config.aspectRatioTolerance || 0.01
    const currentRatio = width / height
    
    const matchesAspectRatio = config.aspectRatios.some(ratio => 
      Math.abs(currentRatio - ratio) <= tolerance
    )
    
    if (!matchesAspectRatio) {
      const ratioStrings = config.aspectRatios.map(r => `${r.toFixed(2)}:1`).join(', ')
      errors.push(`Image aspect ratio ${currentRatio.toFixed(2)}:1 does not match required ratios: ${ratioStrings}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}

// Validate image value
function validateImageValue(value: ImageValue, config: ImageFieldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validate alt text
  if (config.requireAlt && (!value.alt || value.alt.trim() === '')) {
    errors.push('Alt text is required for accessibility')
  }
  
  if (value.alt && config.maxAltLength && value.alt.length > config.maxAltLength) {
    errors.push(`Alt text exceeds maximum length of ${config.maxAltLength} characters`)
  }
  
  // Validate hotspot
  if (value.hotspot) {
    const { x, y, width, height } = value.hotspot
    if (x < 0 || x > 1 || y < 0 || y > 1 || width < 0 || width > 1 || height < 0 || height > 1) {
      errors.push('Hotspot coordinates must be between 0 and 1')
    }
  }
  
  // Validate crop
  if (value.crop) {
    const { top, bottom, left, right } = value.crop
    if (top < 0 || top > 1 || bottom < 0 || bottom > 1 || left < 0 || left > 1 || right < 0 || right > 1) {
      errors.push('Crop coordinates must be between 0 and 1')
    }
    
    if (top >= bottom || left >= right) {
      errors.push('Invalid crop area: top must be less than bottom, left must be less than right')
    }
  }
  
  return { valid: errors.length === 0, errors }
}

// Format file size for display
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Calculate aspect ratio
function calculateAspectRatio(width: number, height: number): number {
  return width / height
}

export const ImageFieldType: FieldType<ImageFieldConfig, ImageValue | null> = {
  name: 'image',
  category: FieldCategory.MEDIA,
  description: 'Image field with asset management, validation, and metadata',

  validate(value: ImageValue | null, config: ImageFieldConfig, context: FieldContext): ValidationResult {
    const fieldConfig = { ...DEFAULT_IMAGE_CONFIG, ...config }
    const fieldPath = getFieldPath(context)
    const errors = []

    // Handle null/undefined values
    if (value == null) {
      if (!fieldConfig.allowEmpty) {
        errors.push(createValidationError(
          fieldPath,
          'Image is required',
          'REQUIRED'
        ))
      }
      return createValidationResult(errors)
    }

    // Validate value structure
    if (typeof value !== 'object' || value._type !== 'reference') {
      errors.push(createValidationError(
        fieldPath,
        'Image value must be a reference object',
        'INVALID_TYPE'
      ))
      return createValidationResult(errors)
    }

    // Validate image value properties
    const valueValidation = validateImageValue(value, fieldConfig)
    if (!valueValidation.valid) {
      valueValidation.errors.forEach(error => {
        errors.push(createValidationError(
          fieldPath,
          error,
          'INVALID_VALUE'
        ))
      })
    }

    // Custom validation
    if (fieldConfig.customValidator) {
      const customResult = fieldConfig.customValidator(value)
      if (customResult === false) {
        errors.push(createValidationError(
          fieldPath,
          'Image failed custom validation',
          'CUSTOM_VALIDATION'
        ))
      } else if (typeof customResult === 'string') {
        errors.push(createValidationError(
          fieldPath,
          customResult,
          'CUSTOM_VALIDATION'
        ))
      }
    }

    // Note: Asset validation would typically be done during upload/asset management
    // Here we assume the reference is valid if present

    return createValidationResult(errors)
  },

  serialize(value: ImageValue | null, config: ImageFieldConfig): ImageValue | null {
    if (!value) {
      return null
    }
    
    // Clean and validate the image value
    const serialized: ImageValue = {
      _type: 'reference',
      _ref: value._ref
    }
    
    // Include optional properties if present
    if (value.alt) {
      serialized.alt = value.alt.trim()
    }
    
    if (value.caption) {
      serialized.caption = value.caption.trim()
    }
    
    if (value.hotspot && config.enableHotspot) {
      serialized.hotspot = value.hotspot
    }
    
    if (value.crop && config.enableCrop) {
      serialized.crop = value.crop
    }
    
    if (value.metadata) {
      serialized.metadata = value.metadata
    }
    
    return serialized
  },

  deserialize(data: any, config: ImageFieldConfig): ImageValue | null {
    if (data == null) {
      return null
    }
    
    // Handle direct asset reference string
    if (typeof data === 'string') {
      return {
        _type: 'reference',
        _ref: data
      }
    }
    
    // Handle image value object
    if (typeof data === 'object') {
      const result: ImageValue = {
        _type: 'reference',
        _ref: data._ref || data.asset?._ref
      }
      
      // Include optional properties
      if (data.alt) {
        result.alt = String(data.alt).trim()
      }
      
      if (data.caption) {
        result.caption = String(data.caption).trim()
      }
      
      if (data.hotspot && config.enableHotspot) {
        result.hotspot = data.hotspot
      }
      
      if (data.crop && config.enableCrop) {
        result.crop = data.crop
      }
      
      if (data.metadata) {
        result.metadata = data.metadata
      }
      
      return result
    }
    
    return null
  },

  defaultValue: null
}

// Helper functions for working with image fields
export function createImageField(config: Partial<ImageFieldConfig> = {}) {
  return {
    type: 'image',
    config: { ...DEFAULT_IMAGE_CONFIG, ...config }
  }
}

export function createRequiredImageField(config: Partial<ImageFieldConfig> = {}) {
  return createImageField({
    allowEmpty: false,
    ...config
  })
}

export function createOptionalImageField(config: Partial<ImageFieldConfig> = {}) {
  return createImageField({
    allowEmpty: true,
    ...config
  })
}

export function createProfileImageField(config: Partial<ImageFieldConfig> = {}) {
  return createImageField({
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSize: 2 * 1024 * 1024, // 2MB
    maxWidth: 1000,
    maxHeight: 1000,
    aspectRatios: [1], // Square aspect ratio
    requireAlt: true,
    enableHotspot: true,
    enableCrop: true,
    ...config
  })
}

export function createBannerImageField(config: Partial<ImageFieldConfig> = {}) {
  return createImageField({
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    aspectRatios: [16/9, 21/9], // Wide aspect ratios
    requireAlt: true,
    enableHotspot: true,
    enableCrop: true,
    ...config
  })
}

// Utility functions
export function validateImageFile(file: File, config: Partial<ImageFieldConfig> = {}): Promise<{ valid: boolean; errors: string[] }> {
  return new Promise((resolve) => {
    const fieldConfig = { ...DEFAULT_IMAGE_CONFIG, ...config }
    const errors: string[] = []
    
    // Validate file type
    const acceptedTypes = config.acceptedTypes || DEFAULT_ACCEPTED_TYPES
    if (!acceptedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`)
      resolve({ valid: false, errors })
      return
    }
    
    // Validate file size
    const maxSize = config.maxFileSize || DEFAULT_MAX_FILE_SIZE
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum of ${formatFileSize(maxSize)}`)
    }
    
    if (config.minFileSize && file.size < config.minFileSize) {
      errors.push(`File size is below minimum of ${formatFileSize(config.minFileSize)}`)
    }
    
    // Validate dimensions (if it's an image and in browser environment)
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml' && typeof Image !== 'undefined') {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        
        const { naturalWidth: width, naturalHeight: height } = img
        
        if (config.maxWidth && width > config.maxWidth) {
          errors.push(`Image width ${width}px exceeds maximum of ${config.maxWidth}px`)
        }
        
        if (config.maxHeight && height > config.maxHeight) {
          errors.push(`Image height ${height}px exceeds maximum of ${config.maxHeight}px`)
        }
        
        if (config.minWidth && width < config.minWidth) {
          errors.push(`Image width ${width}px is below minimum of ${config.minWidth}px`)
        }
        
        if (config.minHeight && height < config.minHeight) {
          errors.push(`Image height ${height}px is below minimum of ${config.minHeight}px`)
        }
        
        // Validate aspect ratios
        if (config.aspectRatios && config.aspectRatios.length > 0) {
          const tolerance = config.aspectRatioTolerance || 0.01
          const currentRatio = width / height
          
          const matchesAspectRatio = config.aspectRatios.some(ratio => 
            Math.abs(currentRatio - ratio) <= tolerance
          )
          
          if (!matchesAspectRatio) {
            errors.push(`Image aspect ratio does not match required ratios`)
          }
        }
        
        resolve({ valid: errors.length === 0, errors })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        errors.push('Invalid image file')
        resolve({ valid: false, errors })
      }
      
      img.src = url
    } else {
      resolve({ valid: errors.length === 0, errors })
    }
  })
}

export function createImageValue(assetRef: string, options: Partial<Omit<ImageValue, '_type' | '_ref'>> = {}): ImageValue {
  return {
    _type: 'reference',
    _ref: assetRef,
    ...options
  }
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'))
      return
    }
    
    if (typeof Image === 'undefined') {
      reject(new Error('Image not available in this environment'))
      return
    }
    
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function getSupportedImageTypes(): string[] {
  return [...DEFAULT_ACCEPTED_TYPES]
}

export function formatImageDimensions(width: number, height: number): string {
  return `${width} × ${height}px`
}

export function calculateImageAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)
  const ratioWidth = width / divisor
  const ratioHeight = height / divisor
  
  return `${ratioWidth}:${ratioHeight}`
}

// Common aspect ratios
export const COMMON_ASPECT_RATIOS = {
  SQUARE: 1,
  PORTRAIT_4_3: 3/4,
  LANDSCAPE_4_3: 4/3,
  PORTRAIT_3_2: 2/3,
  LANDSCAPE_3_2: 3/2,
  PORTRAIT_16_9: 9/16,
  LANDSCAPE_16_9: 16/9,
  ULTRA_WIDE: 21/9,
  GOLDEN_RATIO: 1.618
}