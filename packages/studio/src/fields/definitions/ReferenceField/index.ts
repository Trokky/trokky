import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { ReferenceFieldDefinition, ReferenceValue } from './definition.js';
import { ReferenceFieldComponent } from './component.js';
import { ReferenceFieldPreview } from './preview.js';
import { validateReferenceField, getDefaultReferenceValue } from './validation.js';
import { REFERENCE_FIELD_DEFAULTS } from './definition.js';

export const referenceFieldPlugin: FieldPlugin<ReferenceFieldDefinition, ReferenceValue | ReferenceValue[]> = {
  type: 'reference',
  displayName: 'Reference',
  description: 'Reference to other documents',
  category: 'reference',
  
  component: ReferenceFieldComponent,
  previewComponent: ReferenceFieldPreview,
  
  validate: validateReferenceField,
  
  getDefaultValue: getDefaultReferenceValue,
  
  toSchemaField: (definition) => {
    return {
      type: 'reference',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      to: definition.to,
      bidirectional: definition.bidirectional,
      bidirectionalConfig: definition.bidirectionalConfig,
      default: definition.default
    };
  },
  
  fromSchemaField: (schemaField) => {
    return {
      type: 'reference' as const,
      title: schemaField.title || 'Reference Field',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      // Keep `to` as undefined for universal references (don't default to 'document')
      to: schemaField.to,
      bidirectional: schemaField.bidirectional,
      bidirectionalConfig: schemaField.bidirectionalConfig,
      default: schemaField.default
    };
  },
  
  settings: {
    icon: 'link',
    color: '#8B5CF6',
    tags: ['reference', 'relation', 'link']
  },

  demoConfig: {
    examples: [
      { 
        name: 'Single Reference', 
        value: { _ref: 'article-1', _type: 'article', _cached: { title: 'Sample Article' } }, 
        description: 'Reference to an article' 
      },
      { 
        name: 'Multiple References', 
        value: [
          { _ref: 'user-1', _type: 'user', _cached: { title: 'John Doe' } },
          { _ref: 'user-2', _type: 'user', _cached: { title: 'Jane Smith' } }
        ], 
        description: 'Multiple user references' 
      }
    ],
    invalidValue: undefined,
    variants: [
      {
        name: 'Single Reference',
        definition: {
          type: 'reference' as const,
          title: 'Related Article',
          description: 'Reference to related article',
          to: 'article'
        }
      },
      {
        name: 'Multiple References',
        definition: {
          type: 'reference' as const,
          title: 'Authors',
          description: 'Multiple author references',
          to: 'author',
          validation: { multiple: true, maxReferences: 5 }
        }
      },
      {
        name: 'Universal Reference',
        definition: {
          type: 'reference' as const,
          title: 'Featured Content',
          description: 'Reference to any document type'
          // No `to` property = universal reference
        }
      },
      {
        name: 'Filtered Universal Reference',
        definition: {
          type: 'reference' as const,
          title: 'Related Content',
          description: 'Reference to specific document types',
          options: {
            includeTypes: ['article', 'video', 'faq'],
            excludeTypes: ['draft']
          }
        }
      }
    ]
  }
};

export * from './definition.js';
export * from './validation.js';
export { ReferenceFieldComponent } from './component.js';
export { ReferenceFieldPreview } from './preview.js';