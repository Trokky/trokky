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
 * Configuration for date field type
 */
export interface DateFieldConfig {
  includeTime?: boolean
  format?: string
  min?: Date | string
  max?: Date | string
  timezone?: string
  placeholder?: string
  defaultToNow?: boolean
}

/**
 * Format date for display
 */
function formatDateForDisplay(date: Date, config: DateFieldConfig): string {
  if (config.format) {
    // Custom format implementation would go here
    // For now, use built-in formatting
  }

  if (config.includeTime) {
    return date.toLocaleString()
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Date field type implementation
 * Handles date and datetime values with validation
 */
export const DateFieldType: FieldType<DateFieldConfig, string> = {
  name: 'date',
  category: FieldCategory.DATE,
  description: 'Date and datetime input with validation and formatting',
  icon: 'calendar',

  /**
   * Validate date value against configuration rules
   */
  validate(value: string, config: DateFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Handle undefined/null values
    if (!value) {
      return createValidationResult(errors) // Dates can be optional
    }

    // Ensure value is a valid date string
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      errors.push(createValidationError(fieldPath, 'Invalid date format', 'INVALID_DATE'))
      return createValidationResult(errors)
    }

    // Check minimum date
    if (config.min) {
      const minDate = new Date(config.min)
      if (date < minDate) {
        errors.push(createValidationError(fieldPath, `Date must be after ${formatDateForDisplay(minDate, config)}`, 'MIN_DATE'))
      }
    }

    // Check maximum date
    if (config.max) {
      const maxDate = new Date(config.max)
      if (date > maxDate) {
        errors.push(createValidationError(fieldPath, `Date must be before ${formatDateForDisplay(maxDate, config)}`, 'MAX_DATE'))
      }
    }

    return createValidationResult(errors)
  },

  /**
   * Serialize date value to ISO string
   */
  serialize(value: string, config: DateFieldConfig): string | null {
    if (!value) return null
    
    const date = new Date(value)
    if (isNaN(date.getTime())) return null
    
    return date.toISOString()
  },

  /**
   * Deserialize date value from ISO string
   */
  deserialize(data: any, config: DateFieldConfig): string {
    if (!data) {
      if (config.defaultToNow) {
        return new Date().toISOString()
      }
      return ''
    }

    const date = new Date(data)
    if (isNaN(date.getTime())) return ''
    
    return date.toISOString()
  },

  /**
   * Default value function
   */
  defaultValue: (config: DateFieldConfig) => {
    return config?.defaultToNow ? new Date().toISOString() : ''
  },

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Basic date field',
      config: {
        placeholder: 'Select a date'
      },
      value: '2024-01-15T00:00:00.000Z'
    },
    {
      title: 'Date with time',
      config: {
        includeTime: true,
        placeholder: 'Select date and time'
      },
      value: '2024-01-15T14:30:00.000Z'
    },
    {
      title: 'Date range validation',
      config: {
        min: '2024-01-01',
        max: '2024-12-31',
        format: 'YYYY-MM-DD'
      },
      value: '2024-06-15T00:00:00.000Z'
    },
    {
      title: 'Publication date (defaults to now)',
      config: {
        includeTime: true,
        defaultToNow: true,
        min: new Date().toISOString() // Can't be in the past
      },
      value: new Date().toISOString()
    }
  ]
}

/**
 * React component for date field (Studio integration)
 */
export function DateFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<DateFieldConfig, string>) {
  const config = field.config || {}
  const {
    includeTime = false,
    placeholder,
    min,
    max
  } = config

  // Convert ISO string to local input format
  const inputValue = value ? new Date(value).toISOString().slice(0, includeTime ? 16 : 10) : ''
  
  const inputType = includeTime ? 'datetime-local' : 'date'
  
  // Convert min/max to input format
  const minValue = min ? new Date(min).toISOString().slice(0, includeTime ? 16 : 10) : undefined
  const maxValue = max ? new Date(max).toISOString().slice(0, includeTime ? 16 : 10) : undefined

  return {
    type: 'input',
    props: {
      type: inputType,
      value: inputValue,
      placeholder,
      min: minValue,
      max: maxValue,
      readOnly,
      disabled,
      onChange: (e: any) => {
        const newValue = e.target.value
        if (newValue) {
          // Convert back to ISO string
          const date = new Date(newValue)
          onChange(date.toISOString())
        } else {
          onChange('')
        }
      },
      className: error ? 'field-error' : undefined
    }
  }
}

/**
 * Preview component for date field
 */
export function DateFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: string
  config?: DateFieldConfig
  compact?: boolean 
}) {
  if (!value) return { type: 'span', props: { children: '(no date)' } }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { type: 'span', props: { children: '(invalid date)' } }
  }

  const displayValue = formatDateForDisplay(date, config || {})

  return {
    type: 'span',
    props: {
      children: displayValue,
      className: 'date-field-preview',
      title: compact ? date.toISOString() : undefined
    }
  }
}

// Attach component to field type
DateFieldType.component = DateFieldComponent as any
DateFieldType.preview = DateFieldPreview as any