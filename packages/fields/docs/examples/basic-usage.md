# Basic Usage Examples

Practical examples of using @trokky/fields in real applications.

## Blog Post Schema

Complete example of a blog post content schema using various field types:

```typescript
import type { ContentSchema } from '@trokky/core';

export const blogPostSchema: ContentSchema = {
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: {
    // Basic text fields
    title: {
      type: 'string',
      title: 'Post Title',
      required: true,
      validation: {
        minLength: 1,
        maxLength: 100
      },
      options: {
        placeholder: 'Enter an engaging title...'
      }
    },
    
    slug: {
      type: 'slug',
      title: 'URL Slug',
      required: true,
      options: {
        source: 'title',
        autoGenerate: true,
        maxLength: 96
      },
      validation: {
        unique: true
      }
    },
    
    excerpt: {
      type: 'textarea',
      title: 'Excerpt',
      description: 'Brief summary for previews and SEO',
      validation: {
        maxLength: 300
      },
      options: {
        rows: 3,
        placeholder: 'Write a compelling excerpt...'
      }
    },
    
    // Rich content
    content: {
      type: 'richtext',
      title: 'Content',
      required: true,
      validation: {
        minLength: 100
      },
      options: {
        toolbar: [
          'bold', 'italic', 'link', 'blockquote',
          'bulletList', 'orderedList', 'heading2', 'heading3'
        ]
      }
    },
    
    // Media
    featuredImage: {
      type: 'image',
      title: 'Featured Image',
      validation: {
        required: true
      },
      options: {
        showAltText: true,
        showCaption: true,
        cropAspectRatio: 16/9
      }
    },
    
    // Metadata
    category: {
      type: 'reference',
      title: 'Category',
      required: true,
      options: {
        to: 'category',
        displayField: 'name'
      }
    },
    
    tags: {
      type: 'array',
      title: 'Tags',
      options: {
        of: {
          type: 'reference',
          options: {
            to: 'tag',
            displayField: 'name',
            allowCreate: true
          }
        },
        layout: 'tags'
      },
      validation: {
        maxItems: 10
      }
    },
    
    // Publishing
    status: {
      type: 'string',
      title: 'Status',
      required: true,
      defaultValue: 'draft',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
          { title: 'Archived', value: 'archived' }
        ]
      }
    },
    
    publishedAt: {
      type: 'date',
      title: 'Published Date',
      showIf: { field: 'status', equals: 'published' },
      requiredIf: { field: 'status', equals: 'published' },
      options: {
        includeTime: true
      }
    },
    
    featured: {
      type: 'boolean',
      title: 'Featured Post',
      description: 'Highlight this post on the homepage',
      defaultValue: false,
      options: {
        layout: 'toggle'
      }
    },
    
    // SEO
    seo: {
      type: 'object',
      title: 'SEO Settings',
      options: {
        collapsible: true,
        fields: {
          metaTitle: {
            type: 'string',
            title: 'Meta Title',
            validation: {
              maxLength: 60
            },
            options: {
              placeholder: 'Leave empty to use post title'
            }
          },
          metaDescription: {
            type: 'textarea',
            title: 'Meta Description',
            validation: {
              maxLength: 160
            },
            options: {
              rows: 2,
              placeholder: 'Brief description for search engines'
            }
          },
          focusKeyword: {
            type: 'string',
            title: 'Focus Keyword',
            description: 'Primary keyword for SEO optimization'
          }
        }
      }
    },
    
    // Author information
    author: {
      type: 'reference',
      title: 'Author',
      required: true,
      options: {
        to: 'author',
        displayField: 'name',
        showPreview: true
      }
    }
  }
};
```

## Using Fields in React Components

### Field Renderer Example

```typescript
import React, { useState } from 'react';
import { FieldRenderer } from '@trokky/fields';
import type { StringFieldDefinition } from '@trokky/fields';

function BlogPostForm() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'draft'
  });
  
  const updateField = (fieldName: string) => (value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  const titleField: StringFieldDefinition = {
    type: 'string',
    title: 'Post Title',
    required: true,
    validation: {
      minLength: 1,
      maxLength: 100
    }
  };
  
  return (
    <form>
      <FieldRenderer
        fieldId="title"
        value={formData.title}
        onChange={updateField('title')}
        definition={titleField}
      />
      
      <FieldRenderer
        fieldId="content"
        value={formData.content}
        onChange={updateField('content')}
        definition={{
          type: 'richtext',
          title: 'Content',
          required: true
        }}
      />
      
      <FieldRenderer
        fieldId="status"
        value={formData.status}
        onChange={updateField('status')}
        definition={{
          type: 'string',
          title: 'Status',
          options: {
            list: ['draft', 'published', 'archived']
          }
        }}
      />
    </form>
  );
}
```

### Custom Form with Validation

```typescript
import React, { useState, useCallback } from 'react';
import { FieldRenderer, validateField } from '@trokky/fields';

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    // Validate name
    const nameResult = validateField(formData.name, {
      type: 'string',
      required: true,
      validation: { minLength: 2 }
    });
    if (!nameResult.isValid) {
      newErrors.name = nameResult.message || 'Invalid name';
    }
    
    // Validate email
    const emailResult = validateField(formData.email, {
      type: 'email',
      required: true,
      validation: { email: true }
    });
    if (!emailResult.isValid) {
      newErrors.email = emailResult.message || 'Invalid email';
    }
    
    // Validate message
    const messageResult = validateField(formData.message, {
      type: 'textarea',
      required: true,
      validation: { minLength: 10 }
    });
    if (!messageResult.isValid) {
      newErrors.message = messageResult.message || 'Invalid message';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);
  
  const updateField = (fieldName: string) => (value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ name: true, email: true, message: true });
    
    if (validateForm()) {
      // Submit form
      console.log('Form submitted:', formData);
    }
  };
  
  // Validate on change
  React.useEffect(() => {
    if (Object.keys(touched).length > 0) {
      validateForm();
    }
  }, [formData, touched, validateForm]);
  
  return (
    <form onSubmit={handleSubmit}>
      <FieldRenderer
        fieldId="name"
        value={formData.name}
        onChange={updateField('name')}
        definition={{
          type: 'string',
          title: 'Name',
          required: true,
          validation: { minLength: 2 }
        }}
        hasError={touched.name && !!errors.name}
        error={errors.name}
      />
      
      <FieldRenderer
        fieldId="email"
        value={formData.email}
        onChange={updateField('email')}
        definition={{
          type: 'email',
          title: 'Email',
          required: true
        }}
        hasError={touched.email && !!errors.email}
        error={errors.email}
      />
      
      <FieldRenderer
        fieldId="message"
        value={formData.message}
        onChange={updateField('message')}
        definition={{
          type: 'textarea',
          title: 'Message',
          required: true,
          validation: { minLength: 10 },
          options: { rows: 4 }
        }}
        hasError={touched.message && !!errors.message}
        error={errors.message}
      />
      
      <button type="submit">Send Message</button>
    </form>
  );
}
```

## E-commerce Product Schema

Example of a complex product schema with conditional fields:

```typescript
export const productSchema = {
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: {
    // Basic info
    name: {
      type: 'string',
      title: 'Product Name',
      required: true,
      validation: { maxLength: 100 }
    },
    
    sku: {
      type: 'string',
      title: 'SKU',
      required: true,
      validation: {
        pattern: /^[A-Z0-9-]+$/,
        unique: true
      }
    },
    
    description: {
      type: 'richtext',
      title: 'Description',
      required: true
    },
    
    // Pricing
    pricing: {
      type: 'object',
      title: 'Pricing',
      options: {
        fields: {
          price: {
            type: 'number',
            title: 'Price',
            required: true,
            validation: { min: 0 },
            options: {
              format: 'currency',
              currency: 'USD'
            }
          },
          compareAtPrice: {
            type: 'number',
            title: 'Compare at Price',
            description: 'Original price for showing discounts',
            validation: { min: 0 },
            options: {
              format: 'currency',
              currency: 'USD'
            }
          },
          taxable: {
            type: 'boolean',
            title: 'Taxable',
            defaultValue: true
          }
        }
      }
    },
    
    // Inventory
    inventory: {
      type: 'object',
      title: 'Inventory',
      options: {
        fields: {
          tracked: {
            type: 'boolean',
            title: 'Track Inventory',
            defaultValue: true
          },
          quantity: {
            type: 'number',
            title: 'Quantity',
            showIf: { field: 'inventory.tracked', equals: true },
            validation: { min: 0, integer: true },
            defaultValue: 0
          },
          allowBackorder: {
            type: 'boolean',
            title: 'Allow Backorder',
            showIf: { field: 'inventory.tracked', equals: true },
            defaultValue: false
          }
        }
      }
    },
    
    // Shipping
    shipping: {
      type: 'object',
      title: 'Shipping',
      options: {
        fields: {
          weight: {
            type: 'number',
            title: 'Weight (lbs)',
            validation: { min: 0 }
          },
          dimensions: {
            type: 'object',
            title: 'Dimensions',
            options: {
              fields: {
                length: {
                  type: 'number',
                  title: 'Length (in)',
                  validation: { min: 0 }
                },
                width: {
                  type: 'number',
                  title: 'Width (in)',
                  validation: { min: 0 }
                },
                height: {
                  type: 'number',
                  title: 'Height (in)',
                  validation: { min: 0 }
                }
              }
            }
          },
          requiresShipping: {
            type: 'boolean',
            title: 'Requires Shipping',
            defaultValue: true
          }
        }
      }
    },
    
    // Media
    images: {
      type: 'array',
      title: 'Product Images',
      validation: {
        minItems: 1,
        maxItems: 10
      },
      options: {
        of: {
          type: 'image',
          options: {
            showAltText: true,
            cropAspectRatio: 1
          }
        },
        layout: 'grid',
        sortable: true
      }
    },
    
    // Categories and tags
    category: {
      type: 'reference',
      title: 'Category',
      required: true,
      options: {
        to: 'productCategory',
        displayField: 'name'
      }
    },
    
    tags: {
      type: 'array',
      title: 'Tags',
      options: {
        of: {
          type: 'string'
        },
        layout: 'tags'
      }
    },
    
    // Variants
    hasVariants: {
      type: 'boolean',
      title: 'Has Variants',
      description: 'Product has size, color, or other variants',
      defaultValue: false
    },
    
    variants: {
      type: 'array',
      title: 'Variants',
      showIf: { field: 'hasVariants', equals: true },
      options: {
        of: {
          type: 'object',
          options: {
            fields: {
              title: {
                type: 'string',
                title: 'Variant Title',
                required: true
              },
              sku: {
                type: 'string',
                title: 'Variant SKU',
                required: true
              },
              price: {
                type: 'number',
                title: 'Price',
                options: {
                  format: 'currency',
                  currency: 'USD'
                }
              },
              inventory: {
                type: 'number',
                title: 'Inventory',
                validation: { min: 0, integer: true }
              }
            }
          }
        }
      }
    },
    
    // Status
    status: {
      type: 'string',
      title: 'Status',
      required: true,
      defaultValue: 'draft',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Active', value: 'active' },
          { title: 'Archived', value: 'archived' }
        ]
      }
    }
  }
};
```

## Dynamic Field Rendering

Example of dynamically rendering fields based on a schema:

```typescript
import React from 'react';
import { FieldRenderer } from '@trokky/fields';

interface DynamicFormProps {
  schema: any;
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

function DynamicForm({ schema, data, onChange, errors = {} }: DynamicFormProps) {
  const renderField = (fieldName: string, fieldDef: any) => {
    // Check conditional display
    if (fieldDef.showIf) {
      const shouldShow = evaluateCondition(fieldDef.showIf, data);
      if (!shouldShow) return null;
    }
    
    return (
      <div key={fieldName} className="form-field">
        <FieldRenderer
          fieldId={fieldName}
          value={data[fieldName]}
          onChange={(value) => onChange(fieldName, value)}
          definition={fieldDef}
          hasError={!!errors[fieldName]}
          error={errors[fieldName]}
        />
      </div>
    );
  };
  
  return (
    <div className="dynamic-form">
      <h2>{schema.title}</h2>
      {Object.entries(schema.fields).map(([fieldName, fieldDef]) =>
        renderField(fieldName, fieldDef)
      )}
    </div>
  );
}

// Helper function to evaluate conditional logic
function evaluateCondition(condition: any, data: Record<string, any>): boolean {
  if (condition.field && condition.equals !== undefined) {
    return data[condition.field] === condition.equals;
  }
  
  if (condition.and) {
    return condition.and.every((c: any) => evaluateCondition(c, data));
  }
  
  if (condition.or) {
    return condition.or.some((c: any) => evaluateCondition(c, data));
  }
  
  return true;
}
```

## Field Registry Usage

Working with the field registry:

```typescript
import { fieldRegistry } from '@trokky/fields';

// Get all available field types
const allFields = fieldRegistry.getAll();
console.log('Available fields:', allFields.map(f => f.type));

// Get fields by category
const textFields = fieldRegistry.getByCategory('text');
const mediaFields = fieldRegistry.getByCategory('media');

// Check if a field type exists
if (fieldRegistry.has('customField')) {
  console.log('Custom field is available');
}

// Get field plugin for validation
const stringField = fieldRegistry.get('string');
if (stringField) {
  const validationResult = stringField.validate('test', {
    type: 'string',
    required: true
  });
  console.log('Validation result:', validationResult);
}

// Get registry statistics
const stats = fieldRegistry.getStats();
console.log('Registry stats:', stats);
// Output: { total: 18, bySource: { builtin: 18 }, byCategory: { text: 6, ... } }
```

These examples demonstrate the flexibility and power of the @trokky/fields system for building complex forms and content management interfaces.