import type { FieldPlugin } from '../../base/FieldPlugin';
import type { RichTextFieldDefinition, RichTextContent } from './definition';
import { RichTextFieldComponent } from './component';
import { RichTextFieldPreview } from './preview';
import { validateRichTextField, getDefaultRichTextValue } from './validation';
import { RICHTEXT_FIELD_DEFAULTS } from './definition';

export const richtextFieldPlugin: FieldPlugin<RichTextFieldDefinition, string | RichTextContent> = {
  type: 'richtext',
  displayName: 'Rich Text',
  description: 'Rich text editor with formatting',
  category: 'text',
  
  component: RichTextFieldComponent,
  previewComponent: RichTextFieldPreview,
  
  validate: validateRichTextField,
  
  getDefaultValue: getDefaultRichTextValue,
  
  toSchemaField: (definition) => {
    return {
      type: 'richtext',
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
      type: 'richtext' as const,
      title: schemaField.title || 'Rich Text Field',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      default: schemaField.default
    };
  },
  
  settings: {
    icon: 'document-text',
    color: '#10B981',
    tags: ['text', 'rich', 'editor', 'formatting']
  },

  demoConfig: {
    examples: [
      { 
        name: 'Article Content', 
        value: '<h2>Introduction</h2><p>This is a <strong>rich text</strong> example with <em>formatting</em>.</p>', 
        description: 'Article with formatting' 
      },
      { 
        name: 'Simple Text', 
        value: 'Plain text content without formatting.', 
        description: 'Basic text content' 
      }
    ],
    invalidValue: '',
    variants: [
      {
        name: 'Basic Rich Text',
        definition: {
          type: 'richtext' as const,
          title: 'Content',
          description: 'Rich text with basic formatting',
          options: { 
            toolbar: ['bold', 'italic', 'underline', '|', 'link'],
            minHeight: '150px'
          }
        }
      },
      {
        name: 'Full Editor',
        definition: {
          type: 'richtext' as const,
          title: 'Article Body',
          description: 'Full featured rich text editor',
          required: true,
          validation: { minWords: 10, maxWords: 1000 },
          options: { 
            showWordCount: true,
            enableFullscreen: true
          }
        }
      }
    ]
  }
};

export * from './definition';
export * from './validation';
export { RichTextFieldComponent } from './component';
export { RichTextFieldPreview } from './preview';