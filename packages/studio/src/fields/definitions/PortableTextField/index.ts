import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { PortableTextFieldDefinition, PortableTextContent } from './definition.js';
import { PortableTextFieldComponent } from './component.js';
import { PortableTextFieldPreview } from './preview.js';
import { validatePortableTextField, getDefaultPortableTextValue } from './validation.js';

export const portableTextFieldPlugin: FieldPlugin<PortableTextFieldDefinition, PortableTextContent> = {
  type: 'portable',
  displayName: 'Portable Text',
  description: 'Structured, portable rich text editor',
  category: 'text',
  
  component: PortableTextFieldComponent,
  previewComponent: PortableTextFieldPreview,
  
  validate: validatePortableTextField,
  
  getDefaultValue: getDefaultPortableTextValue,
  
  toSchemaField: (definition) => {
    return {
      type: 'portable',
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
      type: 'portable' as const,
      title: schemaField.title || 'Portable Text Field',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      default: schemaField.default
    };
  },
  
  settings: {
    icon: 'document-text',
    color: '#059669',
    tags: ['text', 'portable', 'structured', 'blocks']
  },

  demoConfig: {
    examples: [
      { 
        name: 'Simple Article', 
        value: {
          blocks: [
            {
              _key: 'h1-block',
              _type: 'block',
              style: 'h1',
              children: [{
                _key: 'h1-span',
                _type: 'span',
                text: 'Welcome to Portable Text',
                marks: []
              }]
            },
            {
              _key: 'p1-block',
              _type: 'block',
              style: 'normal',
              children: [{
                _key: 'p1-span',
                _type: 'span',
                text: 'This is a paragraph with some ',
                marks: []
              }, {
                _key: 'p1-strong',
                _type: 'span',
                text: 'bold text',
                marks: ['strong']
              }, {
                _key: 'p1-span2',
                _type: 'span',
                text: ' and some ',
                marks: []
              }, {
                _key: 'p1-em',
                _type: 'span',
                text: 'italic text',
                marks: ['em']
              }, {
                _key: 'p1-span3',
                _type: 'span',
                text: '.',
                marks: []
              }]
            },
            {
              _key: 'quote-block',
              _type: 'block',
              style: 'blockquote',
              children: [{
                _key: 'quote-span',
                _type: 'span',
                text: 'Portable text makes content truly portable across platforms.',
                marks: []
              }]
            }
          ],
          metadata: {
            blockCount: 3,
            characterCount: 145,
            wordCount: 25,
            version: '1.0'
          }
        }, 
        description: 'Article with heading, paragraph, and quote' 
      },
      { 
        name: 'Simple Text', 
        value: {
          blocks: [{
            _key: 'simple-block',
            _type: 'block',
            style: 'normal',
            children: [{
              _key: 'simple-span',
              _type: 'span',
              text: 'Just a simple paragraph of text.',
              marks: []
            }]
          }],
          metadata: {
            blockCount: 1,
            characterCount: 32,
            wordCount: 7,
            version: '1.0'
          }
        }, 
        description: 'Simple paragraph' 
      }
    ],
    invalidValue: {
      blocks: [],
      metadata: {
        blockCount: 0,
        characterCount: 0,
        wordCount: 0,
        version: '1.0'
      }
    },
    variants: [
      {
        name: 'Basic Portable Text',
        definition: {
          type: 'portable' as const,
          title: 'Content',
          description: 'Structured content with blocks',
          options: { 
            enabledBlockTypes: ['block', 'heading'],
            enabledStyles: ['normal', 'h1', 'h2', 'h3'],
            showBlockCount: true
          }
        }
      },
      {
        name: 'Full Featured',
        definition: {
          type: 'portable' as const,
          title: 'Article Body',
          description: 'Full featured portable text editor',
          required: true,
          validation: { 
            minBlocks: 1, 
            maxBlocks: 20,
            minLength: 10 
          },
          options: { 
            showWordCount: true,
            showCharacterCount: true,
            enableFullscreen: true,
            enabledBlockTypes: ['block', 'heading', 'quote'],
            enabledStyles: ['normal', 'h1', 'h2', 'h3', 'blockquote']
          }
        }
      }
    ]
  }
};

export * from './definition.js';
export * from './validation.js';
export { PortableTextFieldComponent } from './component.js';
export { PortableTextFieldPreview } from './preview.js';