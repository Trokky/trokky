import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { DateFieldDefinition, DateFieldValue } from './definition.js';
import { DateFieldComponent } from './component.js';
import { DateFieldPreview } from './preview.js';
import { validateDateField, getDefaultDateValue } from './validation.js';
import { DATE_FIELD_DEFAULTS } from './definition.js';

export const dateFieldPlugin: FieldPlugin<DateFieldDefinition, DateFieldValue> = {
  type: 'date',
  displayName: 'Date',
  description: 'Date picker with optional time selection',
  category: 'date',
  
  component: DateFieldComponent,
  previewComponent: DateFieldPreview,
  
  validate: validateDateField,
  getDefaultValue: getDefaultDateValue,
  
  toSchemaField: (definition) => {
    return {
      type: 'date',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      default: definition.default
    };
  },
  
  fromSchemaField: (schemaField) => {
    return {
      type: 'date' as const,
      title: schemaField.title || 'Date Field',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      default: schemaField.default
    };
  },
  
  demoConfig: {
    variants: [
      {
        name: 'Basic Date',
        definition: {
          type: 'date',
          title: 'Date',
          description: 'Select a date',
          required: false,
          options: {
            ...DATE_FIELD_DEFAULTS
          }
        }
      },
      {
        name: 'Date with Time',
        definition: {
          type: 'date',
          title: 'Date and Time',
          description: 'Select a date and time',
          required: false,
          options: {
            ...DATE_FIELD_DEFAULTS,
            includeTime: true,
            timeFormat: '12h'
          }
        }
      },
      {
        name: 'Date Range Limited',
        definition: {
          type: 'date',
          title: 'Limited Date Range',
          description: 'Only future dates allowed',
          required: false,
          validation: {
            disablePast: true,
            max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          },
          options: {
            ...DATE_FIELD_DEFAULTS,
            placeholder: 'Select a future date'
          }
        }
      }
    ],
    examples: [
      {
        name: 'Simple Date',
        value: '2024-03-15',
        description: 'Basic date value'
      },
      {
        name: 'Date with Time',
        value: '2024-03-15T14:30:00',
        description: 'Date with time component'
      },
      {
        name: 'Today',
        value: new Date().toISOString().split('T')[0],
        description: 'Current date'
      }
    ],
    invalidValue: 'invalid-date'
  }
};

// Re-export types and utilities
export type {
  DateFieldDefinition,
  DateFieldValue,
  DateValidation,
  DateFieldOptions
} from './definition.js';

export { DateFieldComponent } from './component.js';
export { DateFieldPreview } from './preview.js';
export {
  validateDateField,
  getDefaultDateValue,
  formatDateForDisplay
} from './validation.js';
export { DATE_FIELD_DEFAULTS } from './definition.js';