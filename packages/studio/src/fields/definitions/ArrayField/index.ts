/**
 * Array Field Plugin
 * Handles arrays of values with multiple presentation layouts (select, checkboxes, radio, tags, list, grid)
 * Based on sophisticated legacy Trokky architecture with modern improvements
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { ArrayFieldDefinition } from './definition.js';
import { ArrayFieldComponent } from './component.js';
import { ArrayFieldPreview } from './preview.js';
import { validateArrayField, getDefaultItemValue } from './validation.js';
import { ARRAY_FIELD_DEFAULTS } from './definition.js';

// Export all components and utilities
export { ArrayFieldComponent } from './component.js';
export { ArrayFieldPreview } from './preview.js';
export { 
  validateArrayField, 
  validateArrayAdd,
  validateArrayRemove,
  validateArrayMove,
  getDefaultItemValue,
  sanitizeArrayItem
} from './validation.js';
export type { 
  ArrayFieldDefinition, 
  ArrayValidation, 
  ArrayFieldOptions,
  ArrayLayout,
  ArrayItemDefinition,
  ArrayOperations,
  ArrayFieldContext
} from './definition.js';

// Plugin definition
export const arrayFieldPlugin: FieldPlugin<ArrayFieldDefinition, any[]> = {
  type: 'array',
  displayName: 'Array',
  description: 'Arrays of values with multiple layouts: select, checkboxes, radio, tags, list, grid',
  category: 'structure',
  component: ArrayFieldComponent,
  previewComponent: ArrayFieldPreview,
  validate: validateArrayField,
  
  getDefaultValue: (definition: ArrayFieldDefinition) => {
    return definition.default || [];
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'array',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      of: definition.of
    };
  },
  
  fromSchemaField: (schemaField) => {
    return {
      ...ARRAY_FIELD_DEFAULTS,
      ...schemaField,
      type: 'array' as const
    };
  },
  
  // Demo configurations for the field registry
  demoConfig: {
    examples: [
      { name: 'Empty', value: [], description: 'Empty array' },
      { name: 'Tags', value: ['react', 'typescript', 'node'], description: 'Array of tags' },
      { name: 'Numbers', value: [1, 2, 3, 4, 5], description: 'Array of numbers' },
      { name: 'Strings', value: ['apple', 'banana', 'cherry'], description: 'Array of strings' }
    ],
    variants: [
      {
        name: 'String Array',
        definition: {
          type: 'array',
          title: 'Tags',
          description: 'Array of string tags',
          of: {
            name: 'tag',
            type: 'string',
            title: 'Tag',
            required: true
          },
          options: {
            layout: 'tags'
          },
          validation: {
            minItems: 0,
            maxItems: 10
          }
        } as ArrayFieldDefinition
      },
      {
        name: 'Sortable List',
        definition: {
          type: 'array',
          title: 'Todo Items',
          description: 'Manage your tasks (drag to reorder)',
          of: {
            name: 'item',
            type: 'string',
            title: 'Item',
            required: true
          },
          options: {
            layout: 'list',
            sortable: true,
            addButtonText: 'Add todo item',
            showCount: true
          },
          validation: {
            minItems: 0,
            maxItems: 20
          }
        } as ArrayFieldDefinition
      }
    ]
  }
};