/**
 * Textarea Field Plugin
 * Complete plugin definition for multi-line text input fields
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { TextareaFieldDefinition } from './definition.js';
import { TextareaFieldComponent } from './component.js';
import { TextareaFieldPreview } from './preview.js';
import { validateTextareaField, getTextareaFieldDefaultValue } from './validation.js';
import { TEXTAREA_FIELD_DEFAULTS } from './definition.js';

// Export types for external use
export type { TextareaFieldDefinition, TextareaValidation, TextareaFieldOptions } from './definition.js';

// Textarea field plugin implementation
export const textareaFieldPlugin: FieldPlugin<TextareaFieldDefinition, string> = {
  type: 'text',
  displayName: 'Textarea',
  description: 'Multi-line text input for longer content',
  category: 'text',

  // React components
  component: TextareaFieldComponent,
  previewComponent: TextareaFieldPreview,

  // Validation and defaults
  validate: (value, definition) => validateTextareaField(value, definition),
  getDefaultValue: (definition) => getTextareaFieldDefaultValue(definition),

  // Schema conversion (for API/storage)
  toSchemaField: (definition) => ({
    type: 'text',
    title: definition.title,
    description: definition.description,
    required: definition.required,
    hidden: definition.hidden,
    readOnly: definition.readOnly,
    validation: definition.validation,
    options: definition.options,
    defaultValue: definition.defaultValue
  }),

  fromSchemaField: (schemaField) => ({
    ...TEXTAREA_FIELD_DEFAULTS,
    ...schemaField,
    type: 'text' as const
  }),

  // Plugin metadata
  settings: {
    icon: 'TextareaIcon',
    color: '#10B981', // Green color
    tags: ['text', 'multiline', 'content', 'textarea']
  },

  // Demo configuration for auto-generated field demos
  demoConfig: {
    examples: [
      { 
        name: 'Description', 
        value: 'This is a detailed description\nof the product features and benefits.\n\nIt supports multiple paragraphs.', 
        description: 'Product description' 
      },
      { 
        name: 'Notes', 
        value: 'Meeting notes:\n- Discussed new features\n- Set project deadlines\n- Assigned team roles', 
        description: 'Meeting notes' 
      },
      { 
        name: 'Content', 
        value: 'Blog post content goes here.\n\nThis field is perfect for longer text that needs formatting and structure.', 
        description: 'Blog content' 
      }
    ],
    invalidValue: 'A'.repeat(501), // Exceeds typical maxLength validation
    variants: [
      {
        name: 'Basic Textarea',
        definition: {
          type: 'text' as const,
          title: 'Textarea Field',
          description: 'Multi-line text input',
          options: { rows: 4, autoResize: true, placeholder: 'Write your content...' }
        }
      },
      {
        name: 'Limited Textarea',
        definition: {
          type: 'text' as const,
          title: 'Limited Textarea',
          description: 'Textarea with word/character limits',
          options: { rows: 6, autoResize: true, placeholder: 'Write up to 100 words...' },
          validation: { maxLength: 500, wordCount: { max: 100 } }
        }
      }
    ]
  }
};