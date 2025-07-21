// Export all field type implementations
export * from './simple-string'
export * from './string-field'
export * from './number-field'
export * from './boolean-field'
export * from './date-field'
export * from './array-field'
export * from './object-field'
export * from './reference-field'
export * from './portable-text'
export * from './slug-field'

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
} from './email-field'
export { extractDomain as extractEmailDomain } from './email-field'

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
} from './url-field'
export { extractDomain as extractURLDomain } from './url-field'

export * from './image-field'

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
} from './file-field'
export { isImageFile as isImageFileType } from './file-field'

// Import field types for registry
import { SimpleStringFieldType } from './simple-string'
import { StringFieldType } from './string-field'
import { NumberFieldType } from './number-field'
import { BooleanFieldType } from './boolean-field'
import { DateFieldType } from './date-field'
import { ArrayFieldType } from './array-field'
import { ObjectFieldType } from './object-field'
import { ReferenceFieldType } from './reference-field'
import { SlugFieldType } from './slug-field'
import { EmailFieldType } from './email-field'
import { URLFieldType } from './url-field'
import { ImageFieldType } from './image-field'
import { FileFieldType } from './file-field'
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