// Export all field type implementations
export * from './simple-string'
export * from './string-field'
export * from './number-field'
export * from './boolean-field'
export * from './date-field'
export * from './array-field'
export * from './object-field'
export * from './reference-field'

// Import field types for registry
import { SimpleStringFieldType } from './simple-string'
import { StringFieldType } from './string-field'
import { NumberFieldType } from './number-field'
import { BooleanFieldType } from './boolean-field'
import { DateFieldType } from './date-field'
import { ArrayFieldType } from './array-field'
import { ObjectFieldType } from './object-field'
import { ReferenceFieldType } from './reference-field'

// Array of all built-in field types
export const BuiltInFieldTypes = [
  SimpleStringFieldType,
  StringFieldType,
  NumberFieldType,
  BooleanFieldType,
  DateFieldType,
  ArrayFieldType,
  ObjectFieldType,
  ReferenceFieldType
]