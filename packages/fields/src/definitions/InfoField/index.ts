/**
 * Info Field Plugin
 * Display-only field for showing informational messages in the Studio
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { InfoFieldDefinition } from './definition.js';
import { InfoFieldComponent } from './component.js';
import { InfoFieldPreview } from './preview.js';
import { validateInfoField } from './validation.js';
import { INFO_FIELD_DEFAULTS } from './definition.js';

export const infoFieldPlugin: FieldPlugin<InfoFieldDefinition, null> = {
  type: 'info',
  displayName: 'Info',
  description: 'Display-only informational message with markdown support',
  category: 'text',

  component: InfoFieldComponent,
  previewComponent: InfoFieldPreview,

  validate: validateInfoField,

  // Info fields don't store values
  getDefaultValue: () => null,

  toSchemaField: (definition) => {
    return {
      type: 'info',
      title: definition.title,
      description: definition.description,
      content: definition.content,
      options: definition.options,
    };
  },

  fromSchemaField: (schemaField) => {
    return {
      type: 'info' as const,
      title: schemaField.title || '',
      description: schemaField.description,
      content: schemaField.content || '',
      options: schemaField.options || {},
    };
  },

  settings: {
    icon: 'information-circle',
    color: '#3B82F6',
    tags: ['info', 'help', 'documentation', 'display']
  },

  // Demo configuration
  demoConfig: {
    examples: [
      {
        name: 'Info Message',
        value: null,
        description: 'General information'
      },
      {
        name: 'Warning',
        value: null,
        description: 'Warning message'
      },
      {
        name: 'Tip',
        value: null,
        description: 'Helpful tip'
      }
    ],
    invalidValue: null,
    variants: [
      {
        name: 'Basic Info',
        definition: {
          type: 'info' as const,
          title: 'Information',
          content: 'This is a basic informational message.',
          options: { variant: 'info' }
        }
      },
      {
        name: 'Warning with Markdown',
        definition: {
          type: 'info' as const,
          title: 'Important Warning',
          content: '⚠️ **Warning:** This action cannot be undone.\n\nPlease make sure you have a backup before proceeding.',
          options: { variant: 'warning', markdown: true }
        }
      },
      {
        name: 'Helpful Tip',
        definition: {
          type: 'info' as const,
          title: 'Pro Tip',
          content: '💡 Use keyboard shortcuts to speed up your workflow:\n\n- **Cmd+S**: Save\n- **Cmd+K**: Quick search\n- **Cmd+P**: Command palette',
          options: { variant: 'tip', markdown: true }
        }
      },
      {
        name: 'Collapsible Documentation',
        definition: {
          type: 'info' as const,
          title: 'Field Documentation',
          content: '## How to use this field\n\nThis field accepts the following values:\n\n- `option1`: First option\n- `option2`: Second option\n- `option3`: Third option\n\nSee [documentation](https://example.com) for more details.',
          options: {
            variant: 'info',
            markdown: true,
            collapsible: true,
            defaultCollapsed: false
          }
        }
      }
    ]
  }
};

// Export components and types for direct use
export { InfoFieldComponent } from './component.js';
export { InfoFieldPreview } from './preview.js';
export { validateInfoField } from './validation.js';
export type {
  InfoFieldDefinition,
  InfoFieldOptions,
  InfoVariant,
  VariantConfig
} from './definition.js';
export { INFO_FIELD_DEFAULTS, VARIANT_CONFIGS } from './definition.js';
