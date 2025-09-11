/**
 * Color Field Plugin
 * Field for color selection with various formats
 */

import type { FieldPlugin } from '../../base/FieldPlugin'
import type {
  DocumentContext,
  ValidationResult,
} from '../../base/FieldDefinition'
import { ColorFieldComponent } from './component.js'
import { ColorFieldPreview } from './preview.js'
import { ColorFieldDefinition, colorFieldSchema } from './definition.js'

export * from './definition.js'
export { ColorFieldComponent } from './component.js'
export { ColorFieldPreview } from './preview.js'

export const ColorFieldPlugin: FieldPlugin<ColorFieldDefinition, string> = {
  // Plugin metadata
  type: 'color',
  displayName: 'Color',
  description: 'Color picker field with multiple format support',
  category: 'custom',

  // React component for Studio rendering
  component: ColorFieldComponent,

  // Optional preview component
  previewComponent: ColorFieldPreview,

  // Validation function
  validate: (
    value: string,
    definition: ColorFieldDefinition,
    context?: DocumentContext
  ): ValidationResult => {
    if (!value) {
      if (definition.required) {
        return {
          isValid: false,
          errors: ['This field is required'],
        }
      }
      return { isValid: true, errors: [] }
    }

    const result = colorFieldSchema.safeParse(value)

    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(err => err.message),
      }
    }

    // Check custom validation
    if (
      definition.validation?.allowedColors &&
      !definition.validation.allowedColors.includes(value)
    ) {
      return {
        isValid: false,
        errors: [`Color ${value} is not in the allowed list`],
      }
    }

    if (
      definition.validation?.forbiddenColors &&
      definition.validation.forbiddenColors.includes(value)
    ) {
      return {
        isValid: false,
        errors: [`Color ${value} is not allowed`],
      }
    }

    if (definition.validation?.custom) {
      const customResult = definition.validation.custom(value)
      if (customResult !== true) {
        return {
          isValid: false,
          errors: [
            typeof customResult === 'string' ? customResult : 'Invalid color',
          ],
        }
      }
    }

    return { isValid: true, errors: [] }
  },

  // Default value generator
  getDefaultValue: (definition: ColorFieldDefinition): string => {
    return definition.options?.defaultValue || '#000000'
  },

  // Schema conversion utilities
  toSchemaField: (definition: ColorFieldDefinition) => {
    return {
      type: 'string',
      pattern: '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$',
      default: definition.options?.defaultValue,
    }
  },

  fromSchemaField: (schemaField: any): ColorFieldDefinition => {
    return {
      type: 'color',
      title: schemaField.title || 'Color',
      options: {
        format: 'hex',
        defaultValue: schemaField.default || '#000000',
      },
    }
  },

  // Optional settings
  settings: {
    icon: '🎨',
    color: '#7C3AED',
    tags: ['color', 'design', 'style'],
  },

  // Demo configuration
  demoConfig: {
    examples: [
      {
        name: 'Primary Blue',
        value: '#3B82F6',
        description: 'A vibrant blue color',
      },
      {
        name: 'Success Green',
        value: '#10B981',
        description: 'A positive green color',
      },
      {
        name: 'Warning Yellow',
        value: '#F59E0B',
        description: 'An attention-grabbing yellow',
      },
    ],
    invalidValue: 'not-a-color',
    variants: [
      {
        name: 'Basic Hex',
        definition: {
          type: 'color' as const,
          title: 'Theme Color',
          options: {
            format: 'hex' as const,
          },
        },
      },
      {
        name: 'With Swatches',
        definition: {
          type: 'color' as const,
          title: 'Brand Color',
          options: {
            format: 'hex' as const,
            swatches: [
              '#FF0000',
              '#00FF00',
              '#0000FF',
              '#FFFF00',
              '#FF00FF',
              '#00FFFF',
            ],
          },
        },
      },
    ],
  },
}
