import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { NumberFieldDefinition } from './definition.js';
import { NumberFieldComponent } from './component.js';
import { NumberFieldPreview } from './preview.js';
import { validateNumberField } from './validation.js';
import { NUMBER_FIELD_DEFAULTS } from './definition.js';

export const numberFieldPlugin: FieldPlugin<NumberFieldDefinition, number | string> = {
  type: 'number',
  displayName: 'Number',
  description: 'Numeric input with validation, formatting, and locale support',
  category: 'number',
  
  component: NumberFieldComponent,
  previewComponent: NumberFieldPreview,
  
  validate: validateNumberField,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || NUMBER_FIELD_DEFAULTS.defaultValue || '';
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'number',
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
      ...NUMBER_FIELD_DEFAULTS,
      ...schemaField,
      type: 'number' as const
    };
  },
  
  settings: {
    icon: 'HashtagIcon',
    color: '#3B82F6', // Blue for numbers
    tags: ['number', 'numeric', 'math', 'calculation', 'validation']
  },

  // Demo configuration for auto-generated demos
  demoConfig: {
    examples: [
      { name: 'Age', value: 25, description: 'Person age in years' },
      { name: 'Price', value: 99.99, description: 'Product price' },
      { name: 'Percentage', value: 75.5, description: 'Completion percentage' }
    ],
    invalidValue: 'not-a-number',
    variants: [
      {
        name: 'Number Field',
        definition: {
          type: 'number' as const,
          title: 'Number',
          description: 'Enter a number',
          required: true,
          validation: {
            min: 0,
            max: 1000
          }
        }
      },
      {
        name: 'Currency Field',
        definition: {
          type: 'number' as const,
          title: 'Price',
          description: 'Enter price in USD',
          required: true,
          validation: {
            min: 0,
            precision: 2,
            nonNegativeOnly: true
          },
          options: {
            format: 'currency',
            currency: 'USD',
            showThousandSeparator: true
          }
        }
      },
      {
        name: 'Percentage Field',
        definition: {
          type: 'number' as const,
          title: 'Progress',
          description: 'Enter percentage (0-100)',
          required: true,
          validation: {
            min: 0,
            max: 100,
            precision: 1
          },
          options: {
            format: 'percentage',
            suffix: '%'
          }
        }
      },
      {
        name: 'Integer Field',
        definition: {
          type: 'number' as const,
          title: 'Quantity',
          description: 'Enter whole number only',
          required: true,
          validation: {
            min: 1,
            max: 999,
            integerOnly: true,
            positiveOnly: true,
            step: 1
          },
          options: {
            showSpinButtons: true
          }
        }
      }
    ]
  }
};

// Export types and components for direct use
export { NumberFieldComponent } from './component.js';
export { NumberFieldPreview } from './preview.js';
export { validateNumberField, formatNumber, parseFormattedNumber, cleanNumberString } from './validation.js';
export type { NumberFieldDefinition, NumberValidation, NumberFieldOptions } from './definition.js';