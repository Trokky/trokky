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
import './builtin.js';

// Core exports
export { FieldRenderer, FieldWrapper } from './components/index.js';
export { fieldRegistry, FieldRegistry } from './registry/index.js';

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
  ValidationState
} from './base/index.js';

// Built-in field exports
export {
  stringFieldPlugin,
  StringFieldComponent,
  StringFieldPreview,
  validateStringField
} from './definitions/StringField/index.js';

export type {
  StringFieldDefinition,
  StringValidation,
  StringFieldOptions
} from './definitions/StringField/index.js';

export {
  textareaFieldPlugin
} from './definitions/TextareaField/index.js';

export type {
  TextareaFieldDefinition,
  TextareaValidation,
  TextareaFieldOptions
} from './definitions/TextareaField/index.js';

export {
  urlFieldPlugin,
  URLFieldComponent,
  URLFieldPreview,
  validateURLField
} from './definitions/URLField/index.js';

export type {
  URLFieldDefinition
} from './definitions/URLField/index.js';

export {
  passwordFieldPlugin,
  PasswordFieldComponent,
  PasswordFieldPreview,
  validatePasswordField,
  calculatePasswordStrength,
  generatePassword
} from './definitions/PasswordField/index.js';

export type {
  PasswordFieldDefinition,
  PasswordGeneratorOptions
} from './definitions/PasswordField/index.js';

export {
  numberFieldPlugin,
  NumberFieldComponent,
  NumberFieldPreview,
  validateNumberField,
  formatNumber,
  parseFormattedNumber,
  cleanNumberString
} from './definitions/NumberField/index.js';

export type {
  NumberFieldDefinition,
  NumberValidation,
  NumberFieldOptions
} from './definitions/NumberField/index.js';

// Re-export registration function for manual control
export { registerBuiltinFields } from './builtin.js';