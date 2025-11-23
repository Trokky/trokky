/**
 * @trokky/fields - Universal Field System
 *
 * Works in browser, Node.js, and edge environments.
 * Based on proven legacy architecture from Trokky v1.
 *
 * Usage:
 * ```typescript
 * // Integrated Studio (direct import)
 * import { FieldRenderer, fieldRegistry } from '@trokky/fields';
 *
 * // Custom field registration
 * import { fieldRegistry } from '@trokky/fields/registry';
 * fieldRegistry.register(myCustomField);
 * ```
 */

// Auto-register built-in fields
import './builtin.js'

// Core exports
export { FieldRenderer, FieldWrapper } from './components/index.js'
export { fieldRegistry, FieldRegistry } from './registry/index.js'

// Type exports
export type {
  BaseFieldDefinition,
  ValidationResult,
  BaseValidation,
  BaseFieldOptions,
  FieldCategory,
  BaseFieldValue,
  DocumentContext,
  FieldPlugin,
  RegisteredFieldPlugin,
  FieldPluginSource,
  FieldComponentProps,
  ValidationState,
  StudioContext,
} from './base/index.js'

// Built-in field exports
export {
  stringFieldPlugin,
  StringFieldComponent,
  StringFieldPreview,
  validateStringField,
} from './definitions/StringField/index.js'

export type {
  StringFieldDefinition,
  StringValidation,
  StringFieldOptions,
} from './definitions/StringField/index.js'

export { textareaFieldPlugin } from './definitions/TextareaField/index.js'

export type {
  TextareaFieldDefinition,
  TextareaValidation,
  TextareaFieldOptions,
} from './definitions/TextareaField/index.js'

export {
  urlFieldPlugin,
  URLFieldComponent,
  URLFieldPreview,
  validateURLField,
} from './definitions/URLField/index.js'

export type { URLFieldDefinition } from './definitions/URLField/index.js'

export {
  passwordFieldPlugin,
  PasswordFieldComponent,
  PasswordFieldPreview,
  validatePasswordField,
  calculatePasswordStrength,
  generatePassword,
} from './definitions/PasswordField/index.js'

export type {
  PasswordFieldDefinition,
  PasswordGeneratorOptions,
} from './definitions/PasswordField/index.js'

export {
  numberFieldPlugin,
  NumberFieldComponent,
  NumberFieldPreview,
  validateNumberField,
  formatNumber,
  parseFormattedNumber,
  cleanNumberString,
} from './definitions/NumberField/index.js'

export type {
  NumberFieldDefinition,
  NumberValidation,
  NumberFieldOptions,
} from './definitions/NumberField/index.js'

export {
  booleanFieldPlugin,
  BooleanFieldComponent,
  BooleanFieldPreview,
  validateBooleanField,
  convertToBoolean,
  getBooleanDisplayText,
} from './definitions/BooleanField/index.js'

export type {
  BooleanFieldDefinition,
  BooleanValidation,
  BooleanFieldOptions,
} from './definitions/BooleanField/index.js'

// Array and Object fields - now modernized with Record format
export {
  arrayFieldPlugin,
  ArrayFieldComponent,
  ArrayFieldPreview,
  validateArrayField,
  validateArrayAdd,
  validateArrayRemove,
  validateArrayMove,
  getDefaultItemValue,
  sanitizeArrayItem,
} from './definitions/ArrayField/index.js'

export type {
  ArrayFieldDefinition,
  ArrayValidation,
  ArrayFieldOptions,
  ArrayLayout,
  ArrayItemDefinition,
  ArrayOperations,
  ArrayFieldContext,
} from './definitions/ArrayField/index.js'

export {
  ObjectFieldPlugin,
  ObjectFieldComponent,
  ObjectFieldPreview,
  validateObjectField,
  validateObjectFieldItem,
  evaluateConditional,
  getObjectMetadata,
  getDefaultObjectValue,
  sanitizeObjectValue,
  renderTemplate,
  isFieldReadOnly,
} from './definitions/ObjectField/index.js'

export type {
  ObjectFieldDefinition,
  ObjectValidation,
  ObjectFieldOptions,
  ObjectLayout,
  NestedFieldDefinition,
  ObjectOperations,
  ObjectFieldContext,
  ObjectFieldMetadata,
} from './definitions/ObjectField/index.js'

export {
  mediaFieldPlugin,
  MediaFieldComponent,
  MediaFieldPreview,
  validateMediaField,
  MEDIA_FIELD_DEFAULTS,
  MEDIA_TYPE_PRESETS,
} from './definitions/MediaField/index.js'

export type {
  MediaFieldDefinition,
  MediaFieldValue,
  MediaValidation,
  MediaFieldOptions,
  MediaAssetReference,
  MediaType,
} from './definitions/MediaField/index.js'

// MediaField variants as separate field types
export { AudioFieldPlugin } from './definitions/AudioField/index.js'

export type {
  AudioFieldDefinition,
  AudioFieldValue,
} from './definitions/AudioField/index.js'

export { VideoFieldPlugin } from './definitions/VideoField/index.js'

export type {
  VideoFieldDefinition,
  VideoFieldValue,
} from './definitions/VideoField/index.js'

export { ImageFieldPlugin } from './definitions/ImageField/index.js'

export type {
  ImageFieldDefinition,
  ImageFieldValue,
} from './definitions/ImageField/index.js'

export { DocumentFieldPlugin } from './definitions/DocumentField/index.js'

export type {
  DocumentFieldDefinition,
  DocumentFieldValue,
} from './definitions/DocumentField/index.js'

export {
  SlugFieldPlugin,
  SlugFieldComponent,
  SlugFieldPreview,
  defaultSlugify,
  generateUniqueSlug,
  validateSlugFormat,
  getSourceValue,
} from './definitions/SlugField/index.js'

export type {
  SlugFieldDefinition,
  SlugFieldValue,
  SlugifyOptions,
} from './definitions/SlugField/index.js'

export {
  dateFieldPlugin,
  DateFieldComponent,
  DateFieldPreview,
  validateDateField,
  getDefaultDateValue,
  formatDateForDisplay,
  DATE_FIELD_DEFAULTS,
} from './definitions/DateField/index.js'

export type {
  DateFieldDefinition,
  DateFieldValue,
  DateValidation,
  DateFieldOptions,
} from './definitions/DateField/index.js'

export {
  richtextFieldPlugin,
  RichTextFieldComponent,
  RichTextFieldPreview,
  validateRichTextField,
  getDefaultRichTextValue,
  RICHTEXT_FIELD_DEFAULTS,
} from './definitions/RichTextField/index.js'

export type {
  RichTextFieldDefinition,
  RichTextContent,
  RichTextValidation,
  RichTextFieldOptions,
} from './definitions/RichTextField/index.js'

export {
  ColorFieldPlugin,
  ColorFieldComponent,
  ColorFieldPreview,
  COLOR_FIELD_DEFAULTS,
  DEFAULT_SWATCHES,
} from './definitions/ColorField/index.js'

export type {
  ColorFieldDefinition,
  ColorFieldOptions,
  ColorFieldValidation,
} from './definitions/ColorField/index.js'

export {
  geoCoordinateFieldPlugin,
  GeoCoordinateFieldComponent,
  GeoCoordinateFieldPreview,
  validateGeoCoordinate,
} from './definitions/GeoCoordinateField/index.js'

export type {
  GeoCoordinate,
  GeoCoordinateFieldDefinition,
  GeoCoordinateValidation,
  GeoCoordinateFieldOptions,
} from './definitions/GeoCoordinateField/index.js'

export {
  infoFieldPlugin,
  InfoFieldComponent,
  InfoFieldPreview,
  validateInfoField,
  INFO_FIELD_DEFAULTS,
  VARIANT_CONFIGS,
} from './definitions/InfoField/index.js'

export type {
  InfoFieldDefinition,
  InfoFieldOptions,
  InfoVariant,
  VariantConfig,
} from './definitions/InfoField/index.js'

// Re-export registration function for manual control
export { registerBuiltinFields } from './builtin.js'
