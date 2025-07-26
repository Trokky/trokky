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
  ArrayItemType,
  ArrayOption,
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
    return definition.defaultValue || [];
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'array',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      itemType: definition.itemType,
      options_list: definition.options_list,
      itemDefinition: definition.itemDefinition,
      referenceTo: definition.referenceTo,
      defaultValue: definition.defaultValue
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
      { name: 'Mixed', value: ['apple', 'banana', 'cherry'], description: 'Array of strings' }
    ],
    variants: [
      {
        name: 'Multi-Select Dropdown',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Technologies',
          description: 'Select multiple technologies you work with',
          itemType: 'string',
          options: {
            layout: 'select',
            mode: 'multiple',
            selectOptions: {
              placeholder: 'Choose technologies...',
              searchable: true,
              showDescriptions: true
            }
          },
          options_list: [
            { title: 'React', value: 'react', description: 'JavaScript library for building UIs' },
            { title: 'TypeScript', value: 'typescript', description: 'Typed superset of JavaScript' },
            { title: 'Node.js', value: 'nodejs', description: 'JavaScript runtime for server-side' },
            { title: 'Python', value: 'python', description: 'High-level programming language' },
            { title: 'Go', value: 'go', description: 'Open source programming language' }
          ]
        } as ArrayFieldDefinition
      },
      {
        name: 'Single-Select Dropdown',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Priority Level',
          description: 'Select task priority',
          itemType: 'string',
          options: {
            layout: 'select',
            mode: 'single',
            selectOptions: {
              placeholder: 'Choose priority...'
            }
          },
          options_list: [
            { title: 'Low', value: 'low', color: 'green' },
            { title: 'Medium', value: 'medium', color: 'yellow' },
            { title: 'High', value: 'high', color: 'orange' },
            { title: 'Critical', value: 'critical', color: 'red' }
          ]
        } as ArrayFieldDefinition
      },
      {
        name: 'Checkbox Group',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Features',
          description: 'Select features to enable',
          itemType: 'string',
          options: {
            layout: 'checkboxes'
          },
          options_list: [
            { title: 'Dark Mode', value: 'dark_mode', description: 'Enable dark theme' },
            { title: 'Notifications', value: 'notifications', description: 'Push notifications' },
            { title: 'Analytics', value: 'analytics', description: 'Usage analytics' },
            { title: 'Beta Features', value: 'beta', description: 'Experimental features' }
          ]
        } as ArrayFieldDefinition
      },
      {
        name: 'Radio Button Group',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Theme',
          description: 'Choose your preferred theme',
          itemType: 'string',
          options: {
            layout: 'radio',
            mode: 'single'
          },
          options_list: [
            { title: 'Light', value: 'light', description: 'Light color scheme' },
            { title: 'Dark', value: 'dark', description: 'Dark color scheme' },
            { title: 'Auto', value: 'auto', description: 'Follow system preference' }
          ]
        } as ArrayFieldDefinition
      },
      {
        name: 'Tag Input',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Skills',
          description: 'Add your technical skills',
          itemType: 'string',
          options: {
            layout: 'tags',
            tagOptions: {
              placeholder: 'Add a skill...',
              allowCustom: true,
              suggestions: ['JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'Go', 'Rust'],
              maxTags: 10,
              colorScheme: 'blue'
            }
          }
        } as ArrayFieldDefinition
      },
      {
        name: 'Category Tags',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Categories',
          description: 'Categorize your content',
          itemType: 'string',
          options: {
            layout: 'tags',
            tagOptions: {
              placeholder: 'Add category...',
              allowCustom: false,
              suggestions: ['Technology', 'Design', 'Business', 'Science', 'Art', 'Music', 'Sports', 'Travel'],
              colorScheme: 'green'
            }
          }
        } as ArrayFieldDefinition
      },
      {
        name: 'Sortable List',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Todo Items',
          description: 'Manage your tasks (drag to reorder)',
          itemType: 'string',
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
      },
      {
        name: 'Grid Layout',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Image Gallery',
          description: 'Collection of images in grid format',
          itemType: 'string',
          defaultValue: ['landscape.jpg', 'portrait.jpg', 'nature.jpg', 'city.jpg', 'sunset.jpg', 'mountains.jpg'],
          options: {
            layout: 'grid',
            gridColumns: {
              sm: 1,
              md: 2,
              lg: 3,
              xl: 4
            },
            addButtonText: 'Add image'
          }
        } as ArrayFieldDefinition
      },
      {
        name: 'Number Array',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Scores',
          description: 'Array of numeric scores',
          itemType: 'number',
          options: {
            layout: 'list',
            addButtonText: 'Add score'
          },
          validation: {
            minItems: 1,
            maxItems: 10,
            unique: false
          }
        } as ArrayFieldDefinition
      },
      {
        name: 'Boolean Flags',
        definition: {
          ...ARRAY_FIELD_DEFAULTS,
          title: 'Permissions',
          description: 'Select user permissions',
          itemType: 'string',
          options: {
            layout: 'checkboxes'
          },
          options_list: [
            { title: 'Read', value: 'read', description: 'View content' },
            { title: 'Write', value: 'write', description: 'Create and edit content' },
            { title: 'Delete', value: 'delete', description: 'Remove content' },
            { title: 'Admin', value: 'admin', description: 'Full administrative access' }
          ]
        } as ArrayFieldDefinition
      }
    ]
  }
};