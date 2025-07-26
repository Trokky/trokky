/**
 * Boolean Field Plugin
 * Handles true/false values with various UI styles (checkbox, toggle, radio, button)
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { BooleanFieldDefinition } from './definition.js';
import { BooleanFieldComponent } from './component.js';
import { BooleanFieldPreview } from './preview.js';
import { validateBooleanField, convertToBoolean } from './validation.js';
import { BOOLEAN_FIELD_DEFAULTS } from './definition.js';

// Export all components and utilities
export { BooleanFieldComponent } from './component.js';
export { BooleanFieldPreview } from './preview.js';
export { validateBooleanField, convertToBoolean, getBooleanDisplayText } from './validation.js';
export type { BooleanFieldDefinition, BooleanValidation, BooleanFieldOptions } from './definition.js';

// Plugin definition
export const booleanFieldPlugin: FieldPlugin<BooleanFieldDefinition, boolean> = {
  type: 'boolean',
  displayName: 'Boolean',
  description: 'True/false values with checkbox, toggle, radio, or button styles',
  category: 'boolean',
  component: BooleanFieldComponent,
  previewComponent: BooleanFieldPreview,
  validate: validateBooleanField,
  
  getDefaultValue: (definition: BooleanFieldDefinition) => {
    return convertToBoolean(definition.defaultValue) ?? false;
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'boolean',
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
      ...BOOLEAN_FIELD_DEFAULTS,
      ...schemaField,
      type: 'boolean' as const
    };
  },
  
  // Demo configurations for the field registry
  demoConfig: {
    examples: [
      { name: 'True', value: true, description: 'Boolean true value' },
      { name: 'False', value: false, description: 'Boolean false value' }
    ],
    variants: [
      {
        name: 'Basic Checkbox',
        definition: {
          ...BOOLEAN_FIELD_DEFAULTS,
          title: 'Agree to Terms',
          description: 'Basic checkbox for agreement',
          options: {
            style: 'checkbox',
            label: 'I agree to the terms and conditions'
          }
        } as BooleanFieldDefinition
      },
      {
        name: 'Toggle Switch',
        definition: {
          ...BOOLEAN_FIELD_DEFAULTS,
          title: 'Enable Notifications',
          description: 'Toggle switch for settings',
          options: {
            style: 'toggle',
            label: 'Email notifications',
            color: 'green'
          }
        } as BooleanFieldDefinition
      },
      {
        name: 'Radio Buttons',
        definition: {
          ...BOOLEAN_FIELD_DEFAULTS,
          title: 'Active Status',
          description: 'Yes/No radio button selection',
          options: {
            style: 'radio',
            trueText: 'Active',
            falseText: 'Inactive',
            color: 'blue'
          }
        } as BooleanFieldDefinition
      },
      {
        name: 'Button Style',
        definition: {
          ...BOOLEAN_FIELD_DEFAULTS,
          title: 'Visibility',
          description: 'Button-style boolean selection',
          options: {
            style: 'button',
            trueText: 'Visible',
            falseText: 'Hidden',
            color: 'purple',
            size: 'md'
          }
        } as BooleanFieldDefinition
      },
      {
        name: 'Required Checkbox',
        definition: {
          ...BOOLEAN_FIELD_DEFAULTS,
          title: 'Terms Agreement',
          description: 'Must be checked to proceed',
          required: true,
          validation: {
            required: true,
            mustBeTrue: true,
            message: 'You must agree to the terms to continue'
          },
          options: {
            style: 'checkbox',
            label: 'I have read and agree to the terms of service',
            color: 'red'
          }
        } as BooleanFieldDefinition
      }
    ]
  }
};