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
 * Configuration for array field type
 */
export interface ArrayFieldConfig {
  of: FieldDefinition[]  // Types of items allowed in the array
  min?: number           // Minimum number of items
  max?: number           // Maximum number of items
  sortable?: boolean     // Allow reordering items
  layout?: 'list' | 'grid' | 'tags'  // Visual layout
  addLabel?: string      // Custom label for add button
  collapsible?: boolean  // Allow collapsing items
  unique?: boolean       // Ensure array items are unique
}

/**
 * Array field type implementation
 * Handles arrays of other field types with validation and UI options
 */
export const ArrayFieldType: FieldType<ArrayFieldConfig, any[]> = {
  name: 'array',
  category: FieldCategory.STRUCTURE,
  description: 'Array of items with configurable types and validation',
  icon: 'list',

  /**
   * Validate array value against configuration rules
   */
  validate(value: any[], config: ArrayFieldConfig, context: FieldContext): ValidationResult {
    const errors: ValidationErrorDetail[] = []
    const fieldPath = getFieldPath(context)

    // Handle undefined/null values
    if (!value) {
      if (config.min && config.min > 0) {
        errors.push(createValidationError(fieldPath, `Array must have at least ${config.min} items`, 'MIN_ITEMS'))
      }
      return createValidationResult(errors)
    }

    // Ensure value is an array
    if (!Array.isArray(value)) {
      errors.push(createValidationError(fieldPath, 'Value must be an array', 'INVALID_TYPE'))
      return createValidationResult(errors)
    }

    // Check minimum length
    if (config.min !== undefined && value.length < config.min) {
      errors.push(createValidationError(fieldPath, `Array must have at least ${config.min} items`, 'MIN_ITEMS'))
    }

    // Check maximum length
    if (config.max !== undefined && value.length > config.max) {
      errors.push(createValidationError(fieldPath, `Array cannot have more than ${config.max} items`, 'MAX_ITEMS'))
    }

    // Check uniqueness if required
    if (config.unique) {
      const seen = new Set()
      for (let i = 0; i < value.length; i++) {
        const serialized = JSON.stringify(value[i])
        if (seen.has(serialized)) {
          errors.push(createValidationError(fieldPath, `Duplicate item found at position ${i + 1}`, 'DUPLICATE_ITEM'))
          break
        }
        seen.add(serialized)
      }
    }

    // Basic type validation for array items
    if (config.of && config.of.length > 0) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        const itemPath = `${fieldPath}[${i}]`
        
        // Check if item matches any of the allowed types
        let isValid = false
        for (const typeDef of config.of) {
          if (itemMatchesType(item, typeDef)) {
            isValid = true
            break
          }
        }

        if (!isValid) {
          const allowedTypeNames = config.of.map(t => t.type).join(', ')
          errors.push(createValidationError(
            itemPath, 
            `Item must be one of: ${allowedTypeNames}`, 
            'INVALID_ITEM_TYPE'
          ))
        }
      }
    }

    return createValidationResult(errors)
  },

  /**
   * Serialize array value
   */
  serialize(value: any[], config: ArrayFieldConfig): any[] | null {
    if (!Array.isArray(value)) return null
    
    // Remove any internal metadata
    return value.map(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const { _key, _type, ...cleanItem } = item
        return cleanItem
      }
      return item
    })
  },

  /**
   * Deserialize array value
   */
  deserialize(data: any, config: ArrayFieldConfig): any[] {
    if (!Array.isArray(data)) return []
    
    // Add internal keys for tracking items in UI
    return data.map((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return {
          _key: item._key || `item-${index}-${Date.now()}`,
          ...item
        }
      }
      return item
    })
  },

  /**
   * Default value
   */
  defaultValue: [],

  /**
   * Field examples for documentation
   */
  examples: [
    {
      title: 'Array of strings (tags)',
      config: {
        of: [{ type: 'string', name: 'tag' }],
        layout: 'tags',
        addLabel: 'Add tag'
      },
      value: ['javascript', 'typescript', 'cms']
    },
    {
      title: 'Array of numbers (ratings)',
      config: {
        of: [{ type: 'number', name: 'rating' }],
        min: 1,
        max: 5,
        layout: 'list'
      },
      value: [5, 4, 5, 3, 4]
    },
    {
      title: 'Mixed type array',
      config: {
        of: [
          { type: 'string', name: 'text' },
          { type: 'number', name: 'number' },
          { type: 'boolean', name: 'flag' }
        ],
        sortable: true,
        collapsible: true
      },
      value: ['hello', 42, true, 'world']
    },
    {
      title: 'Unique items array',
      config: {
        of: [{ type: 'string', name: 'item' }],
        unique: true,
        min: 1,
        max: 10
      },
      value: ['apple', 'banana', 'cherry']
    }
  ]
}

/**
 * Check if item matches a specific type definition
 */
function itemMatchesType(item: any, typeDef: FieldDefinition): boolean {
  switch (typeDef.type) {
    case 'string':
      return typeof item === 'string'
    case 'number':
      return typeof item === 'number'
    case 'boolean':
      return typeof item === 'boolean'
    case 'date':
      return typeof item === 'string' && !isNaN(new Date(item).getTime())
    case 'object':
      return typeof item === 'object' && item !== null && !Array.isArray(item)
    case 'array':
      return Array.isArray(item)
    default:
      return true // Allow unknown types for now
  }
}

/**
 * React component for array field (Studio integration)
 */
export function ArrayFieldComponent({
  field,
  value,
  onChange,
  context,
  readOnly,
  disabled,
  error
}: FieldProps<ArrayFieldConfig, any[]>) {
  const config = field.config as ArrayFieldConfig || {}
  const {
    layout = 'list',
    addLabel = 'Add item',
    sortable = false,
    collapsible = false
  } = config

  const items = Array.isArray(value) ? value : []

  const addItem = () => {
    if (readOnly || disabled) return
    
    // Create new item based on first allowed type
    const firstType = config.of?.[0]
    let newItem

    switch (firstType?.type) {
      case 'string':
        newItem = ''
        break
      case 'number':
        newItem = 0
        break
      case 'boolean':
        newItem = false
        break
      case 'object':
        newItem = { _key: `item-${Date.now()}` }
        break
      default:
        newItem = null
    }
    
    onChange([...items, newItem])
  }

  const removeItem = (index: number) => {
    if (readOnly || disabled) return
    const newItems = items.filter((_, i) => i !== index)
    onChange(newItems)
  }

  const updateItem = (index: number, newValue: any) => {
    if (readOnly || disabled) return
    const newItems = [...items]
    newItems[index] = newValue
    onChange(newItems)
  }

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (readOnly || disabled || !sortable) return
    const newItems = [...items]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)
    onChange(newItems)
  }

  return {
    type: 'div',
    props: {
      className: `array-field array-${layout}`,
      children: [
        // Array items
        {
          type: 'div',
          props: {
            className: 'array-items',
            children: items.map((item, index) => ({
              type: 'div',
              props: {
                key: item._key || index,
                className: 'array-item',
                children: [
                  // Item controls
                  sortable && !readOnly && !disabled && {
                    type: 'div',
                    props: {
                      className: 'item-controls',
                      children: [
                        {
                          type: 'button',
                          props: {
                            type: 'button',
                            onClick: () => moveItem(index, Math.max(0, index - 1)),
                            disabled: index === 0,
                            children: '↑'
                          }
                        },
                        {
                          type: 'button',
                          props: {
                            type: 'button',
                            onClick: () => moveItem(index, Math.min(items.length - 1, index + 1)),
                            disabled: index === items.length - 1,
                            children: '↓'
                          }
                        }
                      ]
                    }
                  },
                  // Item content (simplified for demo)
                  {
                    type: 'div',
                    props: {
                      className: 'item-content',
                      children: typeof item === 'string' ? item : JSON.stringify(item)
                    }
                  },
                  // Remove button
                  !readOnly && !disabled && {
                    type: 'button',
                    props: {
                      type: 'button',
                      onClick: () => removeItem(index),
                      className: 'remove-item',
                      children: '×'
                    }
                  }
                ].filter(Boolean)
              }
            }))
          }
        },
        // Add button
        !readOnly && !disabled && (!config.max || items.length < config.max) && {
          type: 'button',
          props: {
            type: 'button',
            onClick: addItem,
            className: 'add-item',
            children: addLabel
          }
        }
      ].filter(Boolean)
    }
  }
}

/**
 * Preview component for array field
 */
export function ArrayFieldPreview({ 
  value, 
  config, 
  compact = false 
}: { 
  value: any[]
  config?: ArrayFieldConfig
  compact?: boolean 
}) {
  if (!Array.isArray(value) || value.length === 0) {
    return { type: 'span', props: { children: '(empty array)' } }
  }

  const itemCount = value.length
  const displayText = compact && itemCount > 3
    ? `${itemCount} items`
    : value.slice(0, 3).map(item => 
        typeof item === 'string' ? item : typeof item
      ).join(', ') + (itemCount > 3 ? '...' : '')

  return {
    type: 'span',
    props: {
      children: `[${displayText}]`,
      className: 'array-field-preview',
      title: compact ? `Array with ${itemCount} items` : undefined
    }
  }
}

// Attach component to field type
ArrayFieldType.component = ArrayFieldComponent as any
ArrayFieldType.preview = ArrayFieldPreview as any