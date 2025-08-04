import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { ObjectFieldDefinition } from './definition.js';
import { validateObjectField, getDefaultObjectValue } from './validation.js';
import { ObjectFieldComponent } from './component.js';
import { ObjectFieldPreview } from './preview.js';
import { OBJECT_FIELD_DEFAULTS } from './definition.js';

export * from './definition.js';
export * from './validation.js';
export * from './component.js';
export * from './preview.js';

// ObjectField plugin registration
export const ObjectFieldPlugin: FieldPlugin<ObjectFieldDefinition, Record<string, any>> = {
  type: 'object',
  displayName: 'Object Field',
  description: 'Nested object structure with defined field schema and multiple layout options',
  category: 'structure',
  
  // React components
  component: ObjectFieldComponent,
  previewComponent: ObjectFieldPreview,
  
  // Validation function
  validate: validateObjectField,
  
  // Default value generator
  getDefaultValue: (definition) => {
    return getDefaultObjectValue(definition);
  },
  
  // Schema conversion utilities
  toSchemaField: (definition) => {
    return {
      type: 'object',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      fields: definition.fields,
      validation: definition.validation,
      options: definition.options,
      defaultValue: definition.defaultValue
    };
  },
  
  fromSchemaField: (schemaField) => {
    // Convert fields from object format to array format if needed
    let fields = schemaField.fields || [];
    
    // If fields is an object (schema format), convert to array
    if (fields && !Array.isArray(fields) && typeof fields === 'object') {
      fields = Object.entries(fields).map(([name, field]: [string, any]) => ({
        name,
        type: field.type,
        title: field.title || name,
        description: field.description,
        required: field.required,
        validation: field.validation,
        options: field.options,
        defaultValue: field.defaultValue || field.default,
        // Handle nested fields for object type
        fields: field.fields,
        // Handle array 'of' property
        of: field.of,
        // Handle reference 'to' property
        to: field.to,
        // Handle conditional properties
        hidden: field.hidden,
        readOnly: field.readOnly,
        conditional: field.conditional
      }));
    }
    
    return {
      type: 'object' as const,
      title: schemaField.title || 'Object Field',
      description: schemaField.description,
      required: schemaField.required || false,
      fields,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      defaultValue: schemaField.defaultValue || {}
    };
  },
  
  settings: {
    icon: 'object',
    color: '#8B5CF6',
    tags: ['structure', 'nested', 'form']
  },

  // Demo configuration for auto-generated field demos
  demoConfig: {
    examples: [
      { 
        name: 'User Profile', 
        value: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1 (555) 123-4567',
          bio: 'Software developer with 5+ years of experience.'
        }, 
        description: 'User profile with personal information' 
      },
      { 
        name: 'Address', 
        value: {
          street: '123 Main Street',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'United States',
          isBusinessAddress: false
        }, 
        description: 'Complete address information' 
      },
      { 
        name: 'SEO Settings', 
        value: {
          metaTitle: 'Amazing Product - Best Solution for Your Needs',
          metaDescription: 'Discover our amazing product that provides the best solution for all your needs. Get started today and see the difference!',
          keywords: ['product', 'solution', 'amazing', 'best'],
          noIndex: false,
          noFollow: false,
          ogTitle: 'Amazing Product',
          ogDescription: 'The best solution for your needs'
        }, 
        description: 'SEO metadata with tabs layout' 
      }
    ],
    invalidValue: { __proto__: 'invalid' }, // Prototype pollution attempt
    variants: [
      {
        name: 'User Profile',
        definition: {
          type: 'object' as const,
          title: 'User Profile',
          description: 'Complete user profile information',
          fields: [
            {
              name: 'firstName',
              type: 'string',
              title: 'First Name',
              required: true
            },
            {
              name: 'lastName',
              type: 'string',
              title: 'Last Name',
              required: true
            },
            {
              name: 'email',
              type: 'string',
              title: 'Email Address',
              required: true
            }
          ]
        }
      },
      {
        name: 'Address Form',
        definition: {
          type: 'object' as const,
          title: 'Address',
          description: 'Complete address information',
          fields: [
            {
              name: 'street',
              type: 'string',
              title: 'Street Address',
              required: true
            },
            {
              name: 'city',
              type: 'string',
              title: 'City',
              required: true
            },
            {
              name: 'state',
              type: 'string',
              title: 'State',
              required: true
            }
          ]
        }
      }
    ]
  }
};