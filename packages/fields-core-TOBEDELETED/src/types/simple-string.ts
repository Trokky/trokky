import {
  FieldType,
  FieldCategory,
  ValidationResult,
  FieldContext,
  FieldProps,
  ValidationErrorDetail
} from '@trokky/core'
import { createValidationError } from '../utils/validation.js'

/**
 * Configuration for simple string field
 */
export interface SimpleStringConfig {
  maxLength?: number
  placeholder?: string
}

/**
 * Simple string field implementation for testing
 */
export const SimpleStringFieldType: FieldType<SimpleStringConfig, string> = {
  name: 'simple-string',
  category: FieldCategory.TEXT,
  description: 'Simple string field for testing',

  validate(value: string, config: SimpleStringConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = context.fieldPath.join('.')

    if (value != null && typeof value !== 'string') {
      errors.push(createValidationError(fieldPath, 'Value must be a string', 'INVALID_TYPE'))
    }

    if (config.maxLength && value && value.length > config.maxLength) {
      errors.push(createValidationError(fieldPath, `Maximum length is ${config.maxLength}`, 'MAX_LENGTH'))
    }

    return { valid: errors.length === 0, errors }
  },

  serialize(value: string, config: SimpleStringConfig): any {
    return value || ''
  },

  deserialize(data: any, config: SimpleStringConfig): string {
    return data ? String(data) : ''
  },

  defaultValue: ''
}