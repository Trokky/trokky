/**
 * Base field definition interfaces
 * Based on proven legacy architecture from Trokky v1
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

// Re-export all field definition types from @trokky/types
export type {
  ConditionalOperator,
  ConditionalConfig,
  BaseFieldDefinition,
  ValidationResult,
  BaseValidation,
  BaseFieldOptions,
  FieldCategory,
  BaseFieldValue,
  ValidationState,
  DocumentContext
} from 'trokky/types';