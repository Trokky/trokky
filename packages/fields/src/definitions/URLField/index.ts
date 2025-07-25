import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { URLFieldDefinition } from './definition.js';
import { URLFieldComponent } from './component.js';
import { URLFieldPreview } from './preview.js';
import { validateURLField } from './validation.js';
import { URL_FIELD_DEFAULTS } from './definition.js';

export const urlFieldPlugin: FieldPlugin<URLFieldDefinition, string> = {
  type: 'url',
  displayName: 'URL',
  description: 'URL input with validation and clickable links in preview',
  category: 'text',
  
  component: URLFieldComponent,
  previewComponent: URLFieldPreview,
  
  validate: validateURLField,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || URL_FIELD_DEFAULTS.defaultValue || '';
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'url',
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
      ...URL_FIELD_DEFAULTS,
      ...schemaField,
      type: 'url' as const
    };
  },
  
  settings: {
    icon: 'LinkIcon',
    color: '#10B981', // Emerald green for URLs
    tags: ['url', 'link', 'website', 'validation']
  },

  // Demo configuration for auto-generated demos
  demoConfig: {
    examples: [
      { name: 'Website', value: 'https://example.com', description: 'Company website' },
      { name: 'Blog', value: 'https://blog.example.com', description: 'Blog URL' },
      { name: 'GitHub', value: 'https://github.com/user/repo', description: 'Repository link' }
    ],
    invalidValue: 'not-a-url',
    variants: [
      {
        name: 'URL Field',
        definition: {
          type: 'url' as const,
          title: 'Website URL',
          description: 'Enter website URL',
          required: true
        }
      },
      {
        name: 'HTTPS Only',
        definition: {
          type: 'url' as const,
          title: 'Secure URL',
          description: 'HTTPS URLs only',
          validation: {
            requireHttps: true
          }
        }
      }
    ]
  }
};

// Export types and components for direct use
export { URLFieldComponent } from './component.js';
export { URLFieldPreview } from './preview.js';
export { validateURLField } from './validation.js';
export type { URLFieldDefinition, URLValidation, URLFieldOptions } from './definition.js';