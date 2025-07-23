// Export all field type implementations
export * from './simple-string.js'
export * from './string-field.js'
export * from './number-field.js'
export * from './boolean-field.js'
export * from './date-field.js'
export * from './array-field.js'
export * from './object-field.js'
export * from './reference-field.js'
export * from './portable-text/index.js'
export * from './slug-field.js'

// Export email field types with explicit re-exports to avoid conflicts
export {
  EmailFieldType,
  type EmailFieldConfig,
  validateEmail,
  normalizeEmail,
  extractLocalPart,
  isDisposableEmail,
  isCommonProvider,
  suggestEmailCorrection,
  createEmailField,
  createRequiredEmailField,
  createOptionalEmailField,
  createCorporateEmailField
} from './email-field.js'
export { extractDomain as extractEmailDomain } from './email-field.js'

// Export URL field types with explicit re-exports to avoid conflicts  
export {
  URLFieldType,
  type URLFieldConfig,
  validateURL,
  parseURL,
  extractProtocol,
  isSecureURL,
  isRelativeURL,
  joinURL,
  addProtocol,
  removeProtocol,
  getURLPath,
  getURLQuery,
  addQueryParam,
  removeQueryParam,
  isShortURL,
  isSocialMediaURL,
  isImageURL,
  createURLField,
  createHTTPSURLField,
  createWebsiteURLField,
  createInternalURLField
} from './url-field.js'
export { extractDomain as extractURLDomain } from './url-field.js'

export * from './image-field.js'

// Export file field types with explicit re-exports to avoid conflicts
export {
  FileFieldType,
  type FileFieldConfig,
  type FileValue,
  type FileAsset,
  FILE_TYPE_CATEGORIES,
  validateFileType,
  createFileValue,
  getFileTypeCategory,
  isDocumentFile,
  isVideoFile,
  isAudioFile,
  isArchiveFile,
  sanitizeFilename,
  generateFileHash,
  formatFileSize,
  getFileExtension,
  isDangerousExtension,
  DANGEROUS_EXTENSIONS,
  createFileField,
  createDocumentField,
  createImageFileField,
  createVideoField,
  createAudioField,
  createArchiveField,
  createMultipleFileField
} from './file-field.js'
export { isImageFile as isImageFileType } from './file-field.js'

// Import field types for registry
import { SimpleStringFieldType } from './simple-string.js'
import { StringFieldType } from './string-field.js'
import { NumberFieldType } from './number-field.js'
import { BooleanFieldType } from './boolean-field.js'
import { DateFieldType } from './date-field.js'
import { ArrayFieldType } from './array-field.js'
import { ObjectFieldType } from './object-field.js'
import { ReferenceFieldType } from './reference-field.js'
import { SlugFieldType } from './slug-field.js'
import { EmailFieldType } from './email-field.js'
import { URLFieldType } from './url-field.js'
import { ImageFieldType } from './image-field.js'
import { FileFieldType } from './file-field.js'
// Note: PortableTextFieldType is not included due to circular dependency with @trokky/core
// It will be added to the registry when the dependency is resolved

// Array of all built-in field types
export const BuiltInFieldTypes = [
  SimpleStringFieldType,
  StringFieldType,
  NumberFieldType,
  BooleanFieldType,
  DateFieldType,
  ArrayFieldType,
  ObjectFieldType,
  ReferenceFieldType,
  SlugFieldType,
  EmailFieldType,
  URLFieldType,
  ImageFieldType,
  FileFieldType
  // PortableTextFieldType - will be added separately when core dependency is resolved
]