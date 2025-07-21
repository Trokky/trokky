import {
  FieldType,
  FieldCategory,
  ValidationResult,
  FieldContext,
  FieldProps,
  ValidationErrorDetail
} from '@trokky/core'
import { createValidationError, getFieldPath, createValidationResult } from '../utils/validation'

/**
 * Configuration for string field type
 */
export interface StringFieldConfig {
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  format?: 'text' | 'email' | 'url' | 'tel' | 'password'
  placeholder?: string
  multiline?: boolean
  rows?: number
  allowEmpty?: boolean
}

/**
 * String field type implementation
 * Handles single-line and multi-line text input with validation
 */
export const StringFieldType: FieldType<StringFieldConfig, string> = {
  name: 'string',
  category: FieldCategory.TEXT,
  description: 'Single-line or multi-line text input with validation options',
  icon: 'text',

  /**
   * Validate string value against configuration rules
   */
  validate(value: string, config: StringFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Handle undefined/null values
    if (value == null) {
      if (!config.allowEmpty) {
        errors.push(createValidationError(fieldPath, 'Value is required', 'REQUIRED'))
      }
      return createValidationResult(errors)
    }

    // Ensure value is a string
    if (typeof value !== 'string') {
      errors.push(createValidationError(fieldPath, 'Value must be a string', 'INVALID_TYPE'))
      return { valid: false, errors }
    }

    // Check minimum length
    if (config.minLength !== undefined && value.length < config.minLength) {
      errors.push(createValidationError(
        fieldPath, 
        `Minimum length is ${config.minLength} characters`, 
        'MIN_LENGTH'
      ))
    }

    // Check maximum length  
    if (config.maxLength !== undefined && value.length > config.maxLength) {
      errors.push(createValidationError(
        fieldPath,
        `Maximum length is ${config.maxLength} characters`,
        'MAX_LENGTH'
      ))
    }

    // Check pattern
    if (config.pattern && !config.pattern.test(value)) {
      errors.push(createValidationError(
        fieldPath,
        'Value does not match required pattern',
        'PATTERN_MISMATCH'
      ))
    }

    // Format validation
    if (config.format) {
      const formatErrors = validateStringFormat(value, config.format, fieldPath)
      errors.push(...formatErrors)
    }

    return createValidationResult(errors)
  },

  /**
   * Serialize string value
   */
  serialize(value: string, config: StringFieldConfig): string | null {
    if (typeof value !== 'string') return null
    return value.trim()
  },

  /**
   * Deserialize string value
   */
  deserialize(data: any, config: StringFieldConfig): string {
    if (data == null) return ''
    return String(data)
  },

  /**
   * Default value
   */
  defaultValue: '',

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Basic text field',
      config: {
        placeholder: 'Enter text...'
      },
      value: 'Hello World'
    },
    {
      title: 'Email field',
      config: {
        format: 'email',
        placeholder: 'Enter email address'
      },
      value: 'user@example.com'
    },
    {
      title: 'Multi-line text',
      config: {
        multiline: true,
        rows: 4,
        maxLength: 500
      },
      value: 'This is a longer text\nthat spans multiple lines.'
    },
    {
      title: 'Password field',
      config: {
        format: 'password',
        minLength: 8
      },
      value: 'secretpassword'
    }
  ]
}

/**
 * Validate string format
 */
function validateStringFormat(
  value: string, 
  format: StringFieldConfig['format'], 
  fieldPath: string
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = []

  switch (format) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        errors.push(createValidationError(fieldPath, 'Invalid email address format', 'INVALID_EMAIL'))
      }
      break

    case 'url':
      try {
        new URL(value)
      } catch {
        errors.push(createValidationError(fieldPath, 'Invalid URL format', 'INVALID_URL'))
      }
      break

    case 'tel':
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
      if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
        errors.push(createValidationError(fieldPath, 'Invalid phone number format', 'INVALID_PHONE'))
      }
      break
  }

  return errors
}

/**
 * React component for string field (Studio integration)
 */
export function StringFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<StringFieldConfig, string>) {
  const config = field.config || {}
  const {
    multiline = false,
    rows = 3,
    placeholder,
    format,
    maxLength
  } = config

  const inputValue = value || ''
  const inputType = format === 'password' ? 'password' 
                  : format === 'email' ? 'email'
                  : format === 'url' ? 'url'
                  : format === 'tel' ? 'tel'
                  : 'text'

  if (multiline) {
    return {
      type: 'textarea',
      props: {
        value: inputValue,
        placeholder,
        rows,
        maxLength,
        readOnly,
        disabled,
        onChange: (e: any) => onChange(e.target.value),
        className: error ? 'field-error' : undefined
      }
    }
  }

  return {
    type: 'input',
    props: {
      type: inputType,
      value: inputValue,
      placeholder,
      maxLength,
      readOnly,
      disabled,
      onChange: (e: any) => onChange(e.target.value),
      className: error ? 'field-error' : undefined
    }
  }
}

/**
 * Preview component for string field
 */
export function StringFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: string
  config?: StringFieldConfig
  compact?: boolean 
}) {
  if (!value) return { type: 'span', props: { children: '(empty)' } }

  const displayValue = compact && value.length > 50 
    ? `${value.slice(0, 47)}...`
    : value

  return {
    type: 'span',
    props: {
      children: displayValue,
      className: 'string-field-preview',
      title: compact && value.length > 50 ? value : undefined
    }
  }
}

// Attach component to field type
StringFieldType.component = StringFieldComponent as any
StringFieldType.preview = StringFieldPreview as any