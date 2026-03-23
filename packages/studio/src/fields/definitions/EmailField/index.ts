/**
 * Email Field Plugin
 * Complete email field implementation that extends StringField
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { EmailFieldDefinition } from './definition.js';
import { EmailFieldComponent } from './component.js';
import { EmailFieldPreview } from './preview.js';
import { validateEmailField } from './validation.js';
import { EMAIL_FIELD_DEFAULTS } from './definition.js';

export const emailFieldPlugin: FieldPlugin<EmailFieldDefinition, string> = {
  type: 'email',
  displayName: 'Email',
  description: 'Email address input with validation and mailto links',
  category: 'text',
  
  component: EmailFieldComponent,
  previewComponent: EmailFieldPreview,
  
  validate: validateEmailField,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || EMAIL_FIELD_DEFAULTS.defaultValue || '';
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'email',
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
      ...EMAIL_FIELD_DEFAULTS,
      ...schemaField,
      type: 'email' as const
    };
  },
  
  settings: {
    icon: 'EnvelopeIcon',
    color: '#0EA5E9', // Sky blue for email
    tags: ['email', 'contact', 'communication', 'validation']
  },

  // Demo configuration for auto-generated demos
  demoConfig: {
    examples: [
      { name: 'Personal', value: 'john.doe@gmail.com', description: 'Personal email address' },
      { name: 'Business', value: 'contact@company.com', description: 'Business email address' },
      { name: 'Support', value: 'support@example.org', description: 'Support email address' }
    ],
    invalidValue: 'invalid-email-format',
    variants: [
      {
        name: 'Email Field',
        definition: {
          type: 'email' as const,
          title: 'Email Address',
          description: 'Enter your email address',
          required: true
        }
      },
      {
        name: 'Optional Email',
        definition: {
          type: 'email' as const,
          title: 'Email (Optional)',
          description: 'Email address for notifications',
          required: false
        }
      }
    ]
  }
};

// Export types and components for direct use
export { EmailFieldComponent } from './component.js';
export { EmailFieldPreview } from './preview.js';
export { validateEmailField } from './validation.js';
export type { EmailFieldDefinition, EmailValidation, EmailFieldOptions } from './definition.js';