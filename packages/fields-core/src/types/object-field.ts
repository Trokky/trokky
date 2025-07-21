import {
  FieldType,
  FieldCategory,
  ValidationResult,
  FieldContext,
  FieldProps,
  FieldDefinition,
  ValidationErrorDetail
} from '@trokky/core'
import { createValidationError, getFieldPath, createValidationResult } from '../utils/validation'

/**
 * Configuration for object field type
 */
export interface ObjectFieldConfig {
  fields: Record<string, FieldDefinition>  // Field definitions for object properties
  layout?: 'sections' | 'tabs' | 'accordion' | 'inline'
  collapsible?: boolean    // Allow collapsing the object
  collapsed?: boolean      // Start collapsed
  title?: string          // Custom title for the object
  description?: string    // Description for the object
}

/**
 * Object field type implementation
 * Handles nested objects with defined field structure
 */
export const ObjectFieldType: FieldType<ObjectFieldConfig, Record<string, any>> = {
  name: 'object',
  category: FieldCategory.STRUCTURE,
  description: 'Nested object with defined field structure',
  icon: 'object',

  /**
   * Validate object value against field definitions
   */
  validate(value: Record<string, any>, config: ObjectFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Handle undefined/null values
    if (!value) {
      // Check if any fields are required
      if (config.fields) {
        for (const [fieldName, fieldDef] of Object.entries(config.fields)) {
          if (fieldDef.required) {
            errors.push(createValidationError(`${fieldPath}.${fieldName}`, `Field '${fieldName}' is required`, 'REQUIRED'))
          }
        }
      }
      return createValidationResult(errors)
    }

    // Ensure value is an object
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push(createValidationError(fieldPath, 'Value must be an object', 'INVALID_TYPE'))
      return createValidationResult(errors)
    }

    // Validate each field definition
    if (config.fields) {
      for (const [fieldName, fieldDef] of Object.entries(config.fields)) {
        const fieldValue = value[fieldName]
        const itemPath = `${fieldPath}.${fieldName}`
        const itemErrors = validateObjectField(fieldValue, fieldDef, itemPath)
        errors.push(...itemErrors)
      }
    }

    return createValidationResult(errors)
  },

  /**
   * Serialize object value
   */
  serialize(value: Record<string, any>, config: ObjectFieldConfig): Record<string, any> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    
    const serialized: Record<string, any> = {}
    
    // Only include fields that are defined in the config
    if (config.fields) {
      for (const [fieldName, fieldDef] of Object.entries(config.fields)) {
        if (fieldName in value) {
          serialized[fieldName] = value[fieldName]
        }
      }
    } else {
      // If no field definitions, include all properties except internal ones
      for (const [key, val] of Object.entries(value)) {
        if (!key.startsWith('_')) {
          serialized[key] = val
        }
      }
    }
    
    return serialized
  },

  /**
   * Deserialize object value
   */
  deserialize(data: any, config: ObjectFieldConfig): Record<string, any> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    
    const deserialized: Record<string, any> = { ...data }
    
    // Add default values for missing fields
    if (config.fields) {
      for (const [fieldName, fieldDef] of Object.entries(config.fields)) {
        if (!(fieldName in deserialized)) {
          deserialized[fieldName] = getDefaultValueForField(fieldDef)
        }
      }
    }
    
    return deserialized
  },

  /**
   * Default value
   */
  defaultValue: {},

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Address object',
      config: {
        fields: {
          street: { type: 'string', name: 'street', required: true },
          city: { type: 'string', name: 'city', required: true },
          state: { type: 'string', name: 'state' },
          zipCode: { type: 'string', name: 'zipCode' },
          country: { type: 'string', name: 'country', defaultValue: 'US' }
        },
        layout: 'sections'
      },
      value: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'US'
      }
    },
    {
      title: 'SEO metadata',
      config: {
        fields: {
          title: { type: 'string', name: 'title', required: true },
          description: { type: 'string', name: 'description' },
          keywords: { type: 'array', name: 'keywords' },
          noIndex: { type: 'boolean', name: 'noIndex', defaultValue: false }
        },
        collapsible: true,
        title: 'SEO Settings'
      },
      value: {
        title: 'My Page Title',
        description: 'This is my page description',
        keywords: ['cms', 'javascript'],
        noIndex: false
      }
    },
    {
      title: 'Contact information',
      config: {
        fields: {
          email: { type: 'string', name: 'email', required: true },
          phone: { type: 'string', name: 'phone' },
          website: { type: 'string', name: 'website' },
          social: {
            type: 'object',
            name: 'social',
            config: {
              fields: {
                twitter: { type: 'string', name: 'twitter' },
                linkedin: { type: 'string', name: 'linkedin' },
                github: { type: 'string', name: 'github' }
              }
            }
          }
        },
        layout: 'tabs'
      },
      value: {
        email: 'contact@example.com',
        phone: '+1-555-0123',
        website: 'https://example.com',
        social: {
          twitter: '@example',
          linkedin: 'company-example',
          github: 'example'
        }
      }
    }
  ]
}

/**
 * Validate individual object field
 */
function validateObjectField(
  value: any, 
  fieldDef: FieldDefinition, 
  fieldPath: string
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = []

  // Check required
  if (fieldDef.required && (value == null || value === '')) {
    errors.push(createValidationError(fieldPath, `Field is required`, 'REQUIRED'))
    return errors
  }

  // Skip validation if value is null/undefined and not required
  if (value == null) return errors

  // Basic type validation
  switch (fieldDef.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(createValidationError(fieldPath, `Field must be a string`, 'INVALID_TYPE'))
      }
      break
    
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(createValidationError(fieldPath, `Field must be a number`, 'INVALID_TYPE'))
      }
      break
    
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(createValidationError(fieldPath, `Field must be a boolean`, 'INVALID_TYPE'))
      }
      break
    
    case 'date':
      if (typeof value !== 'string' || isNaN(new Date(value).getTime())) {
        errors.push(createValidationError(fieldPath, `Field must be a valid date`, 'INVALID_TYPE'))
      }
      break
    
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(createValidationError(fieldPath, `Field must be an array`, 'INVALID_TYPE'))
      }
      break
    
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(createValidationError(fieldPath, `Field must be an object`, 'INVALID_TYPE'))
      }
      break
    
    case 'reference':
      // Reference validation would depend on the system
      if (typeof value !== 'string' && typeof value !== 'object') {
        errors.push(createValidationError(fieldPath, `Field must be a valid reference`, 'INVALID_TYPE'))
      }
      break
  }

  return errors
}

/**
 * Get default value for a field definition
 */
function getDefaultValueForField(fieldDef: FieldDefinition): any {
  if (fieldDef.defaultValue !== undefined) {
    return typeof fieldDef.defaultValue === 'function' 
      ? fieldDef.defaultValue() 
      : fieldDef.defaultValue
  }

  switch (fieldDef.type) {
    case 'string': return ''
    case 'number': return 0
    case 'boolean': return false
    case 'date': return ''
    case 'array': return []
    case 'object': return {}
    case 'reference': return { _type: 'reference', _ref: '' }
    default: return null
  }
}

/**
 * React component for object field (Studio integration)
 */
export function ObjectFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<ObjectFieldConfig, Record<string, any>>) {
  const config = field.config as ObjectFieldConfig || {}
  const {
    fields = {},
    layout = 'sections',
    collapsible = false,
    collapsed = false,
    title,
    description
  } = config

  const objectValue = value || {}

  const updateField = (fieldName: string, fieldValue: any) => {
    if (readOnly || disabled) return
    onChange({
      ...objectValue,
      [fieldName]: fieldValue
    })
  }

  const renderField = (fieldName: string, fieldDef: FieldDefinition) => {
    const fieldValue = objectValue[fieldName]
    
    return {
      type: 'div',
      props: {
        key: fieldName,
        className: 'object-field-item',
        children: [
          {
            type: 'label',
            props: {
              className: 'field-label',
              children: fieldDef.title || fieldName
            }
          },
          fieldDef.description && {
            type: 'div',
            props: {
              className: 'field-description',
              children: fieldDef.description
            }
          },
          // This would be replaced with actual field renderer in real implementation
          {
            type: 'div',
            props: {
              className: 'field-input',
              children: `${fieldDef.type} field: ${JSON.stringify(fieldValue)}`
            }
          }
        ].filter(Boolean)
      }
    }
  }

  const fieldEntries = Object.entries(fields)

  return {
    type: 'div',
    props: {
      className: `object-field object-${layout}`,
      children: [
        // Header
        (title || description) && {
          type: 'div',
          props: {
            className: 'object-header',
            children: [
              title && {
                type: 'h3',
                props: {
                  className: 'object-title',
                  children: title
                }
              },
              description && {
                type: 'p',
                props: {
                  className: 'object-description',
                  children: description
                }
              }
            ].filter(Boolean)
          }
        },
        
        // Fields
        {
          type: 'div',
          props: {
            className: 'object-fields',
            children: fieldEntries.map(([fieldName, fieldDef]) => 
              renderField(fieldName, fieldDef as FieldDefinition)
            )
          }
        }
      ].filter(Boolean)
    }
  }
}

/**
 * Preview component for object field
 */
export function ObjectFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: Record<string, any>
  config?: ObjectFieldConfig
  compact?: boolean 
}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { type: 'span', props: { children: '(empty object)' } }
  }

  const keys = Object.keys(value)
  if (keys.length === 0) {
    return { type: 'span', props: { children: '(empty object)' } }
  }

  const displayText = compact && keys.length > 3
    ? `{${keys.length} properties}`
    : `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`

  return {
    type: 'span',
    props: {
      children: displayText,
      className: 'object-field-preview',
      title: compact ? Object.keys(value).join(', ') : undefined
    }
  }
}

// Attach component to field type
ObjectFieldType.component = ObjectFieldComponent as any
ObjectFieldType.preview = ObjectFieldPreview as any