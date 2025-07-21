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
 * Configuration for number field type
 */
export interface NumberFieldConfig {
  min?: number
  max?: number
  step?: number
  format?: 'integer' | 'float' | 'currency' | 'percentage'
  currency?: string
  precision?: number
  allowNegative?: boolean
  placeholder?: string
}

/**
 * Number field type implementation
 * Handles numeric input with validation and formatting
 */
export const NumberFieldType: FieldType<NumberFieldConfig, number> = {
  name: 'number',
  category: FieldCategory.NUMBER,
  description: 'Numeric input with validation and formatting options',
  icon: 'hash',

  /**
   * Validate number value against configuration rules
   */
  validate(value: number, config: NumberFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Handle undefined/null values
    if (value == null) {
      return { valid: true, errors } // Numbers can be optional
    }

    // Ensure value is a number
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(createValidationError(fieldPath, 'Value must be a valid number', 'INVALID_TYPE'))
      return { valid: false, errors }
    }

    // Check if negative numbers are allowed
    if (config.allowNegative === false && value < 0) {
      errors.push(createValidationError(fieldPath, 'Negative numbers are not allowed', 'NEGATIVE_NOT_ALLOWED'))
    }

    // Check minimum value
    if (config.min !== undefined && value < config.min) {
      errors.push(createValidationError(fieldPath, `Minimum value is ${config.min}`, 'MIN_VALUE'))
    }

    // Check maximum value
    if (config.max !== undefined && value > config.max) {
      errors.push(createValidationError(fieldPath, `Maximum value is ${config.max}`, 'MAX_VALUE'))
    }

    // Check integer format
    if (config.format === 'integer' && !Number.isInteger(value)) {
      errors.push(createValidationError(fieldPath, 'Value must be an integer', 'MUST_BE_INTEGER'))
    }

    // Check step validation
    if (config.step !== undefined && config.min !== undefined) {
      const remainder = (value - config.min) % config.step
      if (Math.abs(remainder) > 1e-10) { // Account for floating point precision
        errors.push(createValidationError(fieldPath, `Value must be in increments of ${config.step}`, 'INVALID_STEP'))
      }
    }

    return createValidationResult(errors)
  },

  /**
   * Serialize number value
   */
  serialize(value: number, config: NumberFieldConfig): number | null {
    if (typeof value !== 'number' || isNaN(value)) return null
    
    // Apply precision if specified
    if (config.precision !== undefined) {
      return parseFloat(value.toFixed(config.precision))
    }
    
    return value
  },

  /**
   * Deserialize number value
   */
  deserialize(data: any, config: NumberFieldConfig): number {
    if (data == null) return 0
    
    const num = typeof data === 'string' ? parseFloat(data) : Number(data)
    
    if (isNaN(num)) return 0
    
    // Apply precision if specified
    if (config.precision !== undefined) {
      return parseFloat(num.toFixed(config.precision))
    }
    
    return num
  },

  /**
   * Default value
   */
  defaultValue: 0,

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Basic number field',
      config: {
        placeholder: 'Enter a number'
      },
      value: 42
    },
    {
      title: 'Integer field with range',
      config: {
        format: 'integer',
        min: 0,
        max: 100,
        step: 1
      },
      value: 75
    },
    {
      title: 'Currency field',
      config: {
        format: 'currency',
        currency: 'USD',
        precision: 2,
        min: 0
      },
      value: 99.99
    },
    {
      title: 'Percentage field',
      config: {
        format: 'percentage',
        min: 0,
        max: 100,
        step: 0.1,
        precision: 1
      },
      value: 85.5
    },
    {
      title: 'Decimal field with precision',
      config: {
        format: 'float',
        precision: 3,
        step: 0.001
      },
      value: 3.14159
    }
  ]
}

/**
 * Format number for display
 */
function formatNumber(value: number, config: NumberFieldConfig): string {
  if (value == null || isNaN(value)) return ''

  const { format, currency = 'USD', precision } = config

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      }).format(value)

    case 'percentage':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      }).format(value / 100)

    case 'integer':
      return Math.round(value).toString()

    case 'float':
    default:
      if (precision !== undefined) {
        return value.toFixed(precision)
      }
      return value.toString()
  }
}

/**
 * React component for number field (Studio integration)
 */
export function NumberFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<NumberFieldConfig, number>) {
  const config = field.config || {}
  const {
    min,
    max,
    step,
    placeholder,
    format
  } = config

  const inputType = format === 'currency' || format === 'percentage' ? 'number' : 'number'
  
  return {
    type: 'input',
    props: {
      type: inputType,
      value: value ?? '',
      placeholder,
      min,
      max,
      step: step ?? (format === 'integer' ? 1 : 'any'),
      readOnly,
      disabled,
      onChange: (e: any) => {
        const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value)
        onChange(isNaN(newValue) ? 0 : newValue)
      },
      className: error ? 'field-error' : undefined
    }
  }
}

/**
 * Preview component for number field
 */
export function NumberFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: number
  config?: NumberFieldConfig
  compact?: boolean 
}) {
  if (value == null) return { type: 'span', props: { children: '(empty)' } }

  const displayValue = formatNumber(value, config || {})

  return {
    type: 'span',
    props: {
      children: displayValue,
      className: 'number-field-preview'
    }
  }
}

// Attach component to field type
NumberFieldType.component = NumberFieldComponent as any
NumberFieldType.preview = NumberFieldPreview as any