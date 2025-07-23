/**
 * File Field Type Implementation
 * Generic file field with upload, validation, and metadata
 */

import type { FieldType, ValidationResult, FieldContext } from '@trokky/core'
import { FieldCategory } from '@trokky/core'
import { createValidationResult, createValidationError, getFieldPath } from '../utils/validation.js'

export interface FileFieldConfig {
  // Allow empty/null file
  allowEmpty?: boolean
  
  // Accepted file types (MIME types or extensions)
  acceptedTypes?: string[]
  
  // Maximum file size in bytes
  maxFileSize?: number
  
  // Minimum file size in bytes
  minFileSize?: number
  
  // Allowed file extensions
  allowedExtensions?: string[]
  
  // Blocked file extensions
  blockedExtensions?: string[]
  
  // Require specific filename patterns
  filenamePattern?: string
  
  // Custom validation function
  customValidator?: (value: FileValue) => boolean | string
  
  // Upload directory/path
  uploadPath?: string
  
  // Store file metadata
  storeMetadata?: boolean
  
  // Allow multiple files
  multiple?: boolean
  
  // Maximum number of files (when multiple is true)
  maxFiles?: number
  
  // Generate file previews/thumbnails
  generatePreviews?: boolean
  
  // Allow external URLs
  allowExternalURLs?: boolean
  
  // Scan for viruses/malware
  virusScan?: boolean
}

export interface FileValue {
  // Asset reference ID
  _ref?: string
  
  // Asset type
  _type: 'reference'
  
  // Original filename
  filename?: string
  
  // File title/display name
  title?: string
  
  // File description
  description?: string
  
  // Custom metadata
  metadata?: Record<string, any>
}

export interface FileAsset {
  // Unique asset ID
  _id: string
  
  // Asset type
  _type: 'fileAsset'
  
  // Original filename
  originalFilename: string
  
  // Sanitized filename
  filename: string
  
  // File extension
  extension: string
  
  // MIME type
  mimeType: string
  
  // File size in bytes
  size: number
  
  // Upload metadata
  uploadedAt: string
  uploadedBy?: string
  
  // File paths/URLs
  url: string
  path: string
  
  // File hash for deduplication
  hash?: string
  
  // Virus scan results
  virusScanResult?: {
    scanned: boolean
    clean: boolean
    threats?: string[]
    scannedAt: string
  }
  
  // File metadata
  metadata?: {
    // Document metadata (for PDFs, Office docs, etc.)
    document?: {
      title?: string
      author?: string
      subject?: string
      creator?: string
      producer?: string
      creationDate?: string
      modificationDate?: string
      pageCount?: number
    }
    
    // Archive metadata (for ZIP, RAR, etc.)
    archive?: {
      fileCount: number
      extractedSize: number
      compression: string
    }
    
    // Text metadata (for text files)
    text?: {
      encoding: string
      lineCount: number
      wordCount: number
      charCount: number
    }
    
    // Generic metadata
    [key: string]: any
  }
}

// Default file configuration
const DEFAULT_FILE_CONFIG: Required<Omit<FileFieldConfig, 'acceptedTypes' | 'maxFileSize' | 'minFileSize' | 'allowedExtensions' | 'blockedExtensions' | 'filenamePattern' | 'customValidator' | 'uploadPath' | 'maxFiles'>> = {
  allowEmpty: false,
  storeMetadata: true,
  multiple: false,
  generatePreviews: false,
  allowExternalURLs: false,
  virusScan: false
}

// Default maximum file size (100MB)
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024

// Common file type categories
export const FILE_TYPE_CATEGORIES = {
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/rtf',
    'application/rtf'
  ],
  
  IMAGE: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ],
  
  VIDEO: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv'
  ],
  
  AUDIO: [
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/m4a'
  ],
  
  ARCHIVE: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar'
  ],
  
  CODE: [
    'text/javascript',
    'text/css',
    'text/html',
    'application/json',
    'text/xml',
    'application/xml'
  ]
}

// Dangerous file extensions that should typically be blocked
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 
  'ws', 'wsf', 'wsc', 'wsh', 'ps1', 'ps1xml', 'ps2', 'ps2xml',
  'psc1', 'psc2', 'msh', 'msh1', 'msh2', 'mshxml', 'msh1xml', 'msh2xml'
]

// Validate file asset
function validateFileAsset(asset: FileAsset | null, config: FileFieldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!asset) {
    return { valid: config.allowEmpty !== false, errors: config.allowEmpty ? [] : ['File is required'] }
  }
  
  // Validate file type
  if (config.acceptedTypes && config.acceptedTypes.length > 0) {
    const isAccepted = config.acceptedTypes.some(type => {
      // Check MIME type
      if (type.includes('/')) {
        return asset.mimeType === type || asset.mimeType.match(new RegExp(type.replace('*', '.*')))
      }
      // Check extension
      return asset.extension.toLowerCase() === type.toLowerCase().replace('.', '')
    })
    
    if (!isAccepted) {
      errors.push(`File type '${asset.mimeType}' is not allowed`)
    }
  }
  
  // Validate file extensions
  if (config.allowedExtensions && config.allowedExtensions.length > 0) {
    const extension = asset.extension.toLowerCase()
    const allowedExts = config.allowedExtensions.map(ext => ext.toLowerCase().replace('.', ''))
    
    if (!allowedExts.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed`)
    }
  }
  
  if (config.blockedExtensions && config.blockedExtensions.length > 0) {
    const extension = asset.extension.toLowerCase()
    const blockedExts = config.blockedExtensions.map(ext => ext.toLowerCase().replace('.', ''))
    
    if (blockedExts.includes(extension)) {
      errors.push(`File extension '${extension}' is blocked`)
    }
  }
  
  // Validate file size
  const maxSize = config.maxFileSize || DEFAULT_MAX_FILE_SIZE
  if (asset.size > maxSize) {
    errors.push(`File size ${formatFileSize(asset.size)} exceeds maximum of ${formatFileSize(maxSize)}`)
  }
  
  if (config.minFileSize && asset.size < config.minFileSize) {
    errors.push(`File size ${formatFileSize(asset.size)} is below minimum of ${formatFileSize(config.minFileSize)}`)
  }
  
  // Validate filename pattern
  if (config.filenamePattern) {
    const regex = new RegExp(config.filenamePattern)
    if (!regex.test(asset.originalFilename)) {
      errors.push('Filename does not match required pattern')
    }
  }
  
  // Check virus scan results
  if (config.virusScan && asset.virusScanResult) {
    if (!asset.virusScanResult.clean) {
      errors.push('File failed virus scan')
    }
  }
  
  return { valid: errors.length === 0, errors }
}

// Validate file value
function validateFileValue(value: FileValue | FileValue[], config: FileFieldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Handle multiple files
  if (config.multiple) {
    if (!Array.isArray(value)) {
      errors.push('Multiple files must be provided as an array')
      return { valid: false, errors }
    }
    
    if (config.maxFiles && value.length > config.maxFiles) {
      errors.push(`Too many files. Maximum allowed: ${config.maxFiles}`)
    }
    
    // Validate each file in the array
    value.forEach((file, index) => {
      const fileValidation = validateSingleFileValue(file, config)
      if (!fileValidation.valid) {
        fileValidation.errors.forEach(error => {
          errors.push(`File ${index + 1}: ${error}`)
        })
      }
    })
  } else {
    if (Array.isArray(value)) {
      errors.push('Single file expected, but array provided')
      return { valid: false, errors }
    }
    
    const fileValidation = validateSingleFileValue(value as FileValue, config)
    errors.push(...fileValidation.errors)
  }
  
  return { valid: errors.length === 0, errors }
}

// Validate single file value
function validateSingleFileValue(value: FileValue, config: FileFieldConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validate required fields
  if (!value._ref) {
    errors.push('File reference is required')
  }
  
  if (value._type !== 'reference') {
    errors.push('File value must be a reference type')
  }
  
  return { valid: errors.length === 0, errors }
}

// Format file size for display
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Get file extension from filename
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1).toLowerCase() : ''
}

// Check if file extension is dangerous
function isDangerousExtension(extension: string): boolean {
  return DANGEROUS_EXTENSIONS.includes(extension.toLowerCase())
}

export const FileFieldType: FieldType<FileFieldConfig, FileValue | FileValue[] | null> = {
  name: 'file',
  category: FieldCategory.MEDIA,
  description: 'Generic file field with upload, validation, and metadata',

  validate(value: FileValue | FileValue[] | null, config: FileFieldConfig, context: FieldContext): ValidationResult {
    const fieldConfig = { ...DEFAULT_FILE_CONFIG, ...config }
    const fieldPath = getFieldPath(context)
    const errors: any[] = []

    // Handle null/undefined values
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      if (!fieldConfig.allowEmpty) {
        errors.push(createValidationError(
          fieldPath,
          'File is required',
          'REQUIRED'
        ))
      }
      return createValidationResult(errors)
    }

    // Validate file value structure
    const valueValidation = validateFileValue(value, fieldConfig)
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
    if (fieldConfig.customValidator && valueValidation.valid) {
      const files = Array.isArray(value) ? value : [value]
      files.forEach((file, index) => {
        const customResult = fieldConfig.customValidator!(file)
        if (customResult === false) {
          const message = fieldConfig.multiple ? `File ${index + 1} failed custom validation` : 'File failed custom validation'
          errors.push(createValidationError(
            fieldPath,
            message,
            'CUSTOM_VALIDATION'
          ))
        } else if (typeof customResult === 'string') {
          const message = fieldConfig.multiple ? `File ${index + 1}: ${customResult}` : customResult
          errors.push(createValidationError(
            fieldPath,
            message,
            'CUSTOM_VALIDATION'
          ))
        }
      })
    }

    return createValidationResult(errors)
  },

  serialize(value: FileValue | FileValue[] | null, config: FileFieldConfig): FileValue | FileValue[] | null {
    if (!value) {
      return null
    }
    
    const serializeFile = (file: FileValue): FileValue => {
      const serialized: FileValue = {
        _type: 'reference',
        _ref: file._ref
      }
      
      if (file.filename) {
        serialized.filename = file.filename.trim()
      }
      
      if (file.title) {
        serialized.title = file.title.trim()
      }
      
      if (file.description) {
        serialized.description = file.description.trim()
      }
      
      if (file.metadata) {
        serialized.metadata = file.metadata
      }
      
      return serialized
    }
    
    if (Array.isArray(value)) {
      return value.map(serializeFile)
    }
    
    return serializeFile(value)
  },

  deserialize(data: any, config: FileFieldConfig): FileValue | FileValue[] | null {
    if (data == null) {
      return null
    }
    
    const deserializeFile = (fileData: any): FileValue | null => {
      if (typeof fileData === 'string') {
        return {
          _type: 'reference',
          _ref: fileData
        }
      }
      
      if (typeof fileData === 'object' && fileData._ref) {
        const result: FileValue = {
          _type: 'reference',
          _ref: fileData._ref
        }
        
        if (fileData.filename) {
          result.filename = String(fileData.filename).trim()
        }
        
        if (fileData.title) {
          result.title = String(fileData.title).trim()
        }
        
        if (fileData.description) {
          result.description = String(fileData.description).trim()
        }
        
        if (fileData.metadata) {
          result.metadata = fileData.metadata
        }
        
        return result
      }
      
      return null
    }
    
    if (Array.isArray(data)) {
      const files = data.map(deserializeFile).filter(Boolean) as FileValue[]
      return files.length > 0 ? files : null
    }
    
    return deserializeFile(data)
  },

  defaultValue: null
}

// Helper functions for working with file fields
export function createFileField(config: Partial<FileFieldConfig> = {}) {
  return {
    type: 'file',
    config: { ...DEFAULT_FILE_CONFIG, ...config }
  }
}

export function createDocumentField(config: Partial<FileFieldConfig> = {}) {
  return createFileField({
    acceptedTypes: FILE_TYPE_CATEGORIES.DOCUMENT,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    storeMetadata: true,
    ...config
  })
}

export function createImageFileField(config: Partial<FileFieldConfig> = {}) {
  return createFileField({
    acceptedTypes: FILE_TYPE_CATEGORIES.IMAGE,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    generatePreviews: true,
    ...config
  })
}

export function createVideoField(config: Partial<FileFieldConfig> = {}) {
  return createFileField({
    acceptedTypes: FILE_TYPE_CATEGORIES.VIDEO,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    storeMetadata: true,
    ...config
  })
}

export function createAudioField(config: Partial<FileFieldConfig> = {}) {
  return createFileField({
    acceptedTypes: FILE_TYPE_CATEGORIES.AUDIO,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    storeMetadata: true,
    ...config
  })
}

export function createArchiveField(config: Partial<FileFieldConfig> = {}) {
  return createFileField({
    acceptedTypes: FILE_TYPE_CATEGORIES.ARCHIVE,
    maxFileSize: 200 * 1024 * 1024, // 200MB
    virusScan: true,
    ...config
  })
}

export function createMultipleFileField(config: Partial<FileFieldConfig> = {}) {
  return createFileField({
    multiple: true,
    maxFiles: 10,
    ...config
  })
}

// Utility functions
export function validateFileType(file: File, acceptedTypes: string[]): boolean {
  return acceptedTypes.some(type => {
    if (type.includes('/')) {
      return file.type === type || file.type.match(new RegExp(type.replace('*', '.*')))
    }
    const extension = getFileExtension(file.name)
    return extension === type.toLowerCase().replace('.', '')
  })
}

export function createFileValue(assetRef: string, options: Partial<Omit<FileValue, '_type' | '_ref'>> = {}): FileValue {
  return {
    _type: 'reference',
    _ref: assetRef,
    ...options
  }
}

export function getFileTypeCategory(mimeType: string): string | null {
  for (const [category, types] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if (types.includes(mimeType)) {
      return category.toLowerCase()
    }
  }
  return null
}

export function isImageFile(file: File): boolean {
  return FILE_TYPE_CATEGORIES.IMAGE.includes(file.type)
}

export function isDocumentFile(file: File): boolean {
  return FILE_TYPE_CATEGORIES.DOCUMENT.includes(file.type)
}

export function isVideoFile(file: File): boolean {
  return FILE_TYPE_CATEGORIES.VIDEO.includes(file.type)
}

export function isAudioFile(file: File): boolean {
  return FILE_TYPE_CATEGORIES.AUDIO.includes(file.type)
}

export function isArchiveFile(file: File): boolean {
  return FILE_TYPE_CATEGORIES.ARCHIVE.includes(file.type)
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace invalid characters with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase()
}

export function generateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader not available'))
      return
    }
    
    const reader = new FileReader()
    
    reader.onload = async (event: ProgressEvent<FileReader>) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        resolve(hashHex)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export { formatFileSize, getFileExtension, isDangerousExtension, DANGEROUS_EXTENSIONS }