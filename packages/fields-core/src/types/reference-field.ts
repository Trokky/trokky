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
 * Reference field configuration
 */
export interface ReferenceFieldConfig {
  to: string[]  // Array of document types this can reference
  weak?: boolean  // Allow weak references (don't prevent deletion)
  filter?: string  // GROQ filter for available references
  options?: {
    disableNew?: boolean  // Disable creating new documents
    filter?: (document: any) => boolean  // Client-side filter function
  }
}

/**
 * Reference value structure
 */
export interface ReferenceValue {
  _type: 'reference'
  _ref: string  // Document ID being referenced
  _weak?: boolean  // Whether this is a weak reference
}

/**
 * Reference field type implementation
 * Handles references to other documents with type safety and validation
 */
export const ReferenceFieldType: FieldType<ReferenceFieldConfig, ReferenceValue> = {
  name: 'reference',
  category: FieldCategory.REFERENCE,
  description: 'Reference to another document with type validation',
  icon: 'link',

  /**
   * Validate reference value
   */
  validate(value: ReferenceValue, config: ReferenceFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Handle undefined/null values
    if (!value) {
      return createValidationResult(errors) // References can be optional
    }

    // Ensure value has correct structure
    if (typeof value !== 'object' || value._type !== 'reference') {
      errors.push(createValidationError(fieldPath, 'Value must be a valid reference object', 'INVALID_REFERENCE'))
      return createValidationResult(errors)
    }

    // Check that _ref is provided
    if (!value._ref || typeof value._ref !== 'string') {
      errors.push(createValidationError(fieldPath, 'Reference must have a valid document ID', 'INVALID_REF_ID'))
      return createValidationResult(errors)
    }

    // Validate reference ID format (basic validation)
    if (!/^[a-zA-Z0-9_-]+$/.test(value._ref)) {
      errors.push(createValidationError(fieldPath, 'Reference ID contains invalid characters', 'INVALID_REF_FORMAT'))
    }

    // In a full implementation, we would:
    // 1. Check if the referenced document exists
    // 2. Validate that the referenced document type is in config.to
    // 3. Apply any filters specified in config.filter

    return createValidationResult(errors)
  },

  /**
   * Serialize reference value
   */
  serialize(value: ReferenceValue, config: ReferenceFieldConfig): ReferenceValue | null {
    if (!value || typeof value !== 'object') return null
    
    return {
      _type: 'reference',
      _ref: value._ref,
      ...(value._weak && { _weak: true })
    }
  },

  /**
   * Deserialize reference value
   */
  deserialize(data: any, config: ReferenceFieldConfig): ReferenceValue {
    if (!data) return { _type: 'reference', _ref: '' }
    
    // Handle string reference (just ID)
    if (typeof data === 'string') {
      return {
        _type: 'reference',
        _ref: data,
        ...(config?.weak && { _weak: true })
      }
    }
    
    // Handle object reference
    if (typeof data === 'object' && data._ref) {
      return {
        _type: 'reference',
        _ref: data._ref,
        ...(data._weak && { _weak: true })
      }
    }
    
    return { _type: 'reference', _ref: '' }
  },

  /**
   * Default value
   */
  defaultValue: { _type: 'reference', _ref: '' },

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Author reference',
      config: {
        to: ['author'],
        options: {
          disableNew: false
        }
      },
      value: {
        _type: 'reference',
        _ref: 'author-123'
      }
    },
    {
      title: 'Category reference with filter',
      config: {
        to: ['category'],
        filter: '*[_type == "category" && published == true]'
      },
      value: {
        _type: 'reference',
        _ref: 'category-456'
      }
    },
    {
      title: 'Weak reference to related post',
      config: {
        to: ['post'],
        weak: true
      },
      value: {
        _type: 'reference',
        _ref: 'post-789',
        _weak: true
      }
    },
    {
      title: 'Multi-type reference',
      config: {
        to: ['page', 'post', 'product'],
        options: {
          filter: (doc) => doc.published === true
        }
      },
      value: {
        _type: 'reference',
        _ref: 'page-abc'
      }
    }
  ]
}

/**
 * React component for reference field (Studio integration)
 */
export function ReferenceFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<ReferenceFieldConfig, ReferenceValue>) {
  const config = field.config as ReferenceFieldConfig || {}
  const { to = [], options = {} } = config

  const referenceValue = value?._ref || ''
  
  const handleChange = (newRef: string) => {
    if (readOnly || disabled) return
    
    if (!newRef) {
      onChange({ _type: 'reference', _ref: '' })
      return
    }
    
    onChange({
      _type: 'reference',
      _ref: newRef,
      ...(config.weak && { _weak: true })
    })
  }

  return {
    type: 'div',
    props: {
      className: 'reference-field',
      children: [
        // Reference selector (simplified for demo)
        {
          type: 'div',
          props: {
            className: 'reference-selector',
            children: [
              {
                type: 'input',
                props: {
                  type: 'text',
                  value: referenceValue,
                  placeholder: `Select ${to.join(' or ')}...`,
                  readOnly,
                  disabled,
                  onChange: (e: any) => handleChange(e.target.value),
                  className: error ? 'field-error' : undefined
                }
              },
              // Browse button
              !readOnly && !disabled && {
                type: 'button',
                props: {
                  type: 'button',
                  onClick: () => {
                    // In real implementation, this would open a document browser
                    console.log('Browse references for types:', to)
                  },
                  className: 'browse-references',
                  children: 'Browse...'
                }
              }
            ].filter(Boolean)
          }
        },
        // Reference preview
        value && {
          type: 'div',
          props: {
            className: 'reference-preview',
            children: [
              {
                type: 'span',
                props: {
                  className: 'reference-id',
                  children: `→ ${value._ref}`
                }
              },
              value._weak && {
                type: 'span',
                props: {
                  className: 'weak-indicator',
                  children: '(weak)'
                }
              }
            ].filter(Boolean)
          }
        }
      ].filter(Boolean)
    }
  }
}

/**
 * Preview component for reference field
 */
export function ReferenceFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: ReferenceValue
  config?: ReferenceFieldConfig
  compact?: boolean 
}) {
  if (!value || !value._ref) {
    return { type: 'span', props: { children: '(no reference)' } }
  }

  const displayText = compact 
    ? `→ ${value._ref.slice(0, 8)}...`
    : `→ ${value._ref}`

  return {
    type: 'span',
    props: {
      children: displayText,
      className: `reference-field-preview ${value._weak ? 'weak-reference' : ''}`,
      title: compact ? `Reference: ${value._ref}` : undefined
    }
  }
}

// Attach component to field type
ReferenceFieldType.component = ReferenceFieldComponent as any
ReferenceFieldType.preview = ReferenceFieldPreview as any