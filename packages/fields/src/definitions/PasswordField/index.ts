import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { PasswordFieldDefinition } from './definition.js';
import { PasswordFieldComponent } from './component.js';
import { PasswordFieldPreview } from './preview.js';
import { validatePasswordField } from './validation.js';
import { PASSWORD_FIELD_DEFAULTS } from './definition.js';

export const passwordFieldPlugin: FieldPlugin<PasswordFieldDefinition, string> = {
  type: 'password',
  displayName: 'Password',
  description: 'Password input with visibility toggle and strength validation',
  category: 'text',
  
  component: PasswordFieldComponent,
  previewComponent: PasswordFieldPreview,
  
  validate: validatePasswordField,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || PASSWORD_FIELD_DEFAULTS.defaultValue || '';
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'password',
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
      ...PASSWORD_FIELD_DEFAULTS,
      ...schemaField,
      type: 'password' as const
    };
  },
  
  settings: {
    icon: 'LockClosedIcon',
    color: '#7C3AED', // Violet for password security
    tags: ['password', 'security', 'authentication', 'validation']
  },

  // Demo configuration for auto-generated demos
  demoConfig: {
    examples: [
      { name: 'Simple', value: 'password123', description: 'Basic password' },
      { name: 'Strong', value: 'MyStr0ng!P@ssw0rd', description: 'Strong password with mixed characters' },
      { name: 'Complex', value: 'C0mpl3x#P@ssw0rd!2024', description: 'Complex password with all requirements' }
    ],
    invalidValue: '123',
    variants: [
      {
        name: 'Password Field',
        definition: {
          type: 'password' as const,
          title: 'Password',
          description: 'Enter your password',
          required: true,
          validation: {
            minLength: 8
          }
        }
      },
      {
        name: 'Strong Password',
        definition: {
          type: 'password' as const,
          title: 'Strong Password',
          description: 'Password with strength requirements and generator',
          required: true,
          validation: {
            minLength: 12,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true
          },
          options: {
            showStrength: true,
            showGenerator: true,
            generator: {
              length: 16,
              includeUppercase: true,
              includeLowercase: true,
              includeNumbers: true,
              includeSpecialChars: true
            }
          }
        }
      }
    ]
  }
};

// Export types and components for direct use
export { PasswordFieldComponent } from './component.js';
export { PasswordFieldPreview } from './preview.js';
export { validatePasswordField, calculatePasswordStrength, generatePassword } from './validation.js';
export type { PasswordFieldDefinition, PasswordValidation, PasswordFieldOptions } from './definition.js';
export type { PasswordGeneratorOptions } from './validation.js';