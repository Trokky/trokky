/**
 * String Field Plugin
 * Complete field plugin definition for string fields
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { StringFieldDefinition } from './definition.js';
import { StringFieldComponent } from './component.js';
import { StringFieldPreview } from './preview.js';
import { validateStringField } from './validation.js';
import { STRING_FIELD_DEFAULTS } from './definition.js';

export const stringFieldPlugin: FieldPlugin<StringFieldDefinition, string> = {
  type: 'string',
  displayName: 'String',
  description: 'Single or multi-line text input',
  category: 'text',
  
  component: StringFieldComponent,
  previewComponent: StringFieldPreview,
  
  validate: validateStringField,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || STRING_FIELD_DEFAULTS.defaultValue || '';
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'string',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      defaultValue: definition.defaultValue
    };
  },
  
  fromSchemaField: (schemaField) => {
    return {
      type: 'string' as const,
      title: schemaField.title || 'String Field',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      defaultValue: schemaField.defaultValue
    };
  },
  
  settings: {
    icon: 'text',
    color: '#3B82F6',
    tags: ['text', 'input', 'basic']
  }
};

// Export components and types for direct use
export { StringFieldComponent } from './component.js';
export { StringFieldPreview } from './preview.js';
export { validateStringField } from './validation.js';
export type { StringFieldDefinition, StringValidation, StringFieldOptions } from './definition.js';