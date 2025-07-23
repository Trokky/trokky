import {
  FieldType,
  FieldCategory,
  ValidationResult,
  FieldContext,
  FieldProps,
  ValidationErrorDetail
} from '@trokky/core'
import { createValidationError, getFieldPath, createValidationResult } from '../utils/validation.js'

/**
 * Configuration for boolean field type
 */
export interface BooleanFieldConfig {
  layout?: 'checkbox' | 'switch' | 'radio'
  trueLabel?: string
  falseLabel?: string
  defaultValue?: boolean
}

/**
 * Boolean field type implementation
 * Handles true/false values with different UI layouts
 */
export const BooleanFieldType: FieldType<BooleanFieldConfig, boolean> = {
  name: 'boolean',
  category: FieldCategory.BOOLEAN,
  description: 'True/false toggle with customizable UI layouts',
  icon: 'toggle',

  /**
   * Validate boolean value
   */
  validate(value: boolean, config: BooleanFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Boolean validation is straightforward - just check type
    if (value != null && typeof value !== 'boolean') {
      errors.push(createValidationError(fieldPath, 'Value must be true or false', 'INVALID_TYPE'))
    }

    return createValidationResult(errors)
  },

  /**
   * Serialize boolean value
   */
  serialize(value: boolean, config: BooleanFieldConfig): boolean {
    return Boolean(value)
  },

  /**
   * Deserialize boolean value
   */
  deserialize(data: any, config: BooleanFieldConfig): boolean {
    if (data == null) {
      return config.defaultValue ?? false
    }

    // Handle various truthy/falsy representations
    if (typeof data === 'boolean') return data
    if (typeof data === 'string') {
      const str = data.toLowerCase().trim()
      return str === 'true' || str === 'yes' || str === '1'
    }
    if (typeof data === 'number') return data !== 0

    return Boolean(data)
  },

  /**
   * Default value function
   */
  defaultValue: (config: BooleanFieldConfig) => config.defaultValue ?? false,

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Basic checkbox',
      config: {
        layout: 'checkbox'
      },
      value: true
    },
    {
      title: 'Switch with custom labels',
      config: {
        layout: 'switch',
        trueLabel: 'Enabled',
        falseLabel: 'Disabled'
      },
      value: false
    },
    {
      title: 'Radio buttons',
      config: {
        layout: 'radio',
        trueLabel: 'Yes',
        falseLabel: 'No'
      },
      value: true
    },
    {
      title: 'Published status',
      config: {
        layout: 'switch',
        trueLabel: 'Published',
        falseLabel: 'Draft',
        defaultValue: false
      },
      value: true
    }
  ]
}

/**
 * React component for boolean field (Studio integration)
 */
export function BooleanFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<BooleanFieldConfig, boolean>) {
  const config = field.config || {}
  const {
    layout = 'checkbox',
    trueLabel = 'True',
    falseLabel = 'False'
  } = config

  const isChecked = Boolean(value)

  switch (layout) {
    case 'switch':
      return {
        type: 'div',
        props: {
          className: 'boolean-switch-field',
          children: [
            {
              type: 'label',
              props: {
                className: 'switch',
                children: [
                  {
                    type: 'input',
                    props: {
                      type: 'checkbox',
                      checked: isChecked,
                      readOnly,
                      disabled,
                      onChange: (e: any) => onChange(e.target.checked)
                    }
                  },
                  {
                    type: 'span',
                    props: {
                      className: 'slider',
                      children: isChecked ? trueLabel : falseLabel
                    }
                  }
                ]
              }
            }
          ]
        }
      }

    case 'radio':
      return {
        type: 'div',
        props: {
          className: 'boolean-radio-field',
          children: [
            {
              type: 'label',
              props: {
                children: [
                  {
                    type: 'input',
                    props: {
                      type: 'radio',
                      name: field.name,
                      checked: isChecked,
                      readOnly,
                      disabled,
                      onChange: () => onChange(true)
                    }
                  },
                  { type: 'span', props: { children: trueLabel } }
                ]
              }
            },
            {
              type: 'label',
              props: {
                children: [
                  {
                    type: 'input',
                    props: {
                      type: 'radio',
                      name: field.name,
                      checked: !isChecked,
                      readOnly,
                      disabled,
                      onChange: () => onChange(false)
                    }
                  },
                  { type: 'span', props: { children: falseLabel } }
                ]
              }
            }
          ]
        }
      }

    case 'checkbox':
    default:
      return {
        type: 'label',
        props: {
          className: 'boolean-checkbox-field',
          children: [
            {
              type: 'input',
              props: {
                type: 'checkbox',
                checked: isChecked,
                readOnly,
                disabled,
                onChange: (e: any) => onChange(e.target.checked),
                className: error ? 'field-error' : undefined
              }
            },
            {
              type: 'span',
              props: {
                children: field.title || field.name
              }
            }
          ]
        }
      }
  }
}

/**
 * Preview component for boolean field
 */
export function BooleanFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: boolean
  config?: BooleanFieldConfig
  compact?: boolean 
}) {
  const { trueLabel = 'Yes', falseLabel = 'No' } = config || {}
  const displayValue = value ? trueLabel : falseLabel
  const className = value ? 'boolean-true' : 'boolean-false'

  return {
    type: 'span',
    props: {
      children: displayValue,
      className: `boolean-field-preview ${className}`
    }
  }
}

// Attach component to field type
BooleanFieldType.component = BooleanFieldComponent as any
BooleanFieldType.preview = BooleanFieldPreview as any