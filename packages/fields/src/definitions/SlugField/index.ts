import type { FieldPlugin, BaseFieldDefinition, ValidationResult } from '../../base/index.js';
import { SlugFieldComponent } from './component.js';
import { SlugFieldPreview } from './preview.js';

export interface SlugFieldDefinition extends BaseFieldDefinition {
  type: 'slug';
  
  // Auto-generation configuration
  source?: string | string[];         // Field(s) to generate slug from (e.g., 'title', ['title', 'subtitle'])
  autoGenerate?: boolean;             // Default: true
  
  // Validation options
  maxLength?: number;                 // Default: 200
  minLength?: number;                 // Default: 1
  unique?: boolean;                   // Default: true (requires uniqueness within collection)
  allowEmpty?: boolean;               // Default: false
  pattern?: RegExp;                   // Custom validation pattern
  
  // UI options
  placeholder?: string;               // Placeholder text for the input field
  
  // Behavior options
  readOnly?: boolean;                 // Default: false (allow manual override)
  preserveCase?: boolean;             // Default: false (convert to lowercase)
  allowedChars?: string;              // Additional allowed characters beyond a-z0-9-
  allowSlashes?: boolean;             // Default: false (allow / for hierarchical paths)
  
  // Prefix/suffix options
  prefix?: string;                    // Prefix to add to generated slugs
  suffix?: string;                    // Suffix to add to generated slugs
  
  // Custom slugify function
  slugify?: (input: string, options?: SlugifyOptions) => string;
}

export interface SlugifyOptions {
  preserveCase?: boolean;
  allowedChars?: string;
  allowSlashes?: boolean;
  prefix?: string;
  suffix?: string;
}

export interface SlugFieldValue {
  value: string;
  generated: boolean;     // Whether this slug was auto-generated
  source?: string;        // Which field it was generated from
  lastUpdated: Date;
}

// Unicode-aware slugify algorithm based on legacy Trokky implementation
export function defaultSlugify(input: string, options: SlugifyOptions = {}): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const {
    preserveCase = false,
    allowedChars = '',
    allowSlashes = false,
    prefix = '',
    suffix = ''
  } = options;

  let slug = input
    .toString()
    .normalize('NFD')                          // Normalize unicode characters (decompose)
    .replace(/[\u0300-\u036f]/g, '')          // Remove diacritical marks (accents)
    .trim();                                   // Remove leading/trailing whitespace

  // Convert to lowercase unless preserveCase is true
  if (!preserveCase) {
    slug = slug.toLowerCase();
  }

  // Build character class for allowed characters
  const baseChars = preserveCase ? 'a-zA-Z0-9' : 'a-z0-9';
  const slashChar = allowSlashes ? '\\/' : '';
  const escapedAllowedChars = allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allowedPattern = `[^${baseChars}\\s\\-${slashChar}${escapedAllowedChars}]`;

  slug = slug
    .replace(new RegExp(allowedPattern, 'g'), '')  // Remove invalid characters
    .replace(/\s+/g, '-')                          // Replace spaces with hyphens
    .replace(/-+/g, '-')                           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');                        // Remove leading/trailing hyphens

  // Add prefix and suffix
  if (prefix && slug) {
    slug = prefix + (slug.startsWith('-') ? '' : '-') + slug;
  }
  if (suffix && slug) {
    slug = slug + (slug.endsWith('-') ? '' : '-') + suffix;
  }

  return slug;
}

// Generate unique slug by appending numbers if conflicts exist
export function generateUniqueSlug(
  baseSlug: string, 
  isUnique: (slug: string) => Promise<boolean>
): Promise<string> {
  return new Promise(async (resolve) => {
    let candidate = baseSlug;
    let counter = 1;

    while (!(await isUnique(candidate))) {
      counter++;
      candidate = `${baseSlug}-${counter}`;
    }

    resolve(candidate);
  });
}

// Validation function for slug format
// TODO(#8): This validation is duplicated in packages/core/src/validation/validator.ts
// See: https://github.com/Trokky/trokky/issues/8
export function validateSlugFormat(slug: string, definition: SlugFieldDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if empty
  if (!slug || slug.trim() === '') {
    if (!definition.allowEmpty) {
      errors.push('Slug cannot be empty');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  // Length validation
  if (definition.minLength && slug.length < definition.minLength) {
    errors.push(`Slug must be at least ${definition.minLength} characters long`);
  }
  if (definition.maxLength && slug.length > definition.maxLength) {
    errors.push(`Slug cannot exceed ${definition.maxLength} characters`);
  }

  // Format validation
  if (slug.startsWith('-') || slug.endsWith('-')) {
    errors.push('Slug cannot start or end with hyphens');
  }

  if (slug.includes('--')) {
    errors.push('Slug cannot contain consecutive hyphens');
  }

  // Custom pattern validation
  if (definition.pattern && !definition.pattern.test(slug)) {
    errors.push('Slug format is invalid');
  }

  // Basic character validation (only if no custom pattern)
  if (!definition.pattern) {
    const baseChars = definition.preserveCase ? 'a-zA-Z0-9' : 'a-z0-9';
    const allowedChars = definition.allowedChars || '';
    const slashChar = definition.allowSlashes ? '\\/' : '';
    const escapedAllowed = allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const validPattern = new RegExp(`^[${baseChars}\\-${slashChar}${escapedAllowed}]+$`);

    if (!validPattern.test(slug)) {
      errors.push('Slug contains invalid characters');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// Get source field value for auto-generation
export function getSourceValue(source: string | string[], document: Record<string, any>): string {
  if (!source) return '';

  const sources = Array.isArray(source) ? source : [source];
  
  for (const fieldPath of sources) {
    const value = getNestedValue(document, fieldPath);
    if (value && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// SlugField Plugin Definition
export const SlugFieldPlugin: FieldPlugin<SlugFieldDefinition, string> = {
  type: 'slug',
  displayName: 'Slug',
  description: 'URL-friendly slug field with auto-generation and uniqueness validation',
  category: 'text',

  // Components
  component: SlugFieldComponent,
  previewComponent: SlugFieldPreview,

  // Generate default value
  getDefaultValue: (definition: SlugFieldDefinition) => {
    return definition.allowEmpty ? '' : 'untitled';
  },

  // Validate slug value
  validate: (value: string, definition: SlugFieldDefinition): ValidationResult => {
    return validateSlugFormat(value, definition);
  },

  // Schema conversion methods
  toSchemaField: (definition) => {
    return {
      type: 'slug',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      source: definition.source,
      autoGenerate: definition.autoGenerate,
      maxLength: definition.maxLength,
      minLength: definition.minLength,
      unique: definition.unique,
      allowEmpty: definition.allowEmpty,
      readOnly: definition.readOnly,
      preserveCase: definition.preserveCase,
      allowedChars: definition.allowedChars,
      allowSlashes: definition.allowSlashes,
      prefix: definition.prefix,
      suffix: definition.suffix
    };
  },

  fromSchemaField: (schemaField) => {
    return {
      type: 'slug' as const,
      title: schemaField.title || 'URL Slug',
      description: schemaField.description || 'Auto-generated URL-friendly slug',
      required: schemaField.required !== false, // Default to required
      source: schemaField.source || 'title', // Default source field
      autoGenerate: schemaField.autoGenerate !== false, // Default to auto-generate
      maxLength: schemaField.maxLength || 200,
      minLength: schemaField.minLength || 1,
      unique: schemaField.unique !== false, // Default to unique
      allowEmpty: schemaField.allowEmpty || false,
      readOnly: schemaField.readOnly || false,
      preserveCase: schemaField.preserveCase || false,
      allowedChars: schemaField.allowedChars || '',
      allowSlashes: schemaField.allowSlashes || false,
      prefix: schemaField.prefix || '',
      suffix: schemaField.suffix || ''
    };
  },

  // Demo configuration for FieldsDemo page
  demoConfig: {
    variants: [
      {
        name: 'Basic Slug',
        definition: {
          type: 'slug' as const,
          title: 'URL Slug',
          description: 'Auto-generated from title with uniqueness validation',
          source: 'title',
          required: true,
          unique: true
        }
      },
      {
        name: 'Manual Slug',
        definition: {
          type: 'slug' as const,
          title: 'Custom Slug',
          description: 'Manually editable slug with uniqueness validation',
          autoGenerate: false,
          required: true,
          maxLength: 100,
          unique: true
        }
      },
      {
        name: 'Prefixed Slug',
        definition: {
          type: 'slug' as const,
          title: 'Category Slug',
          description: 'Slug with category prefix and uniqueness validation',
          source: 'title',
          prefix: 'category',
          required: true,
          unique: true
        }
      }
    ],
    examples: [
      { name: 'Blog post', value: 'my-awesome-blog-post', description: 'Generated from "My Awesome Blog Post"' },
      { name: 'Product', value: 'super-widget-pro', description: 'Generated from "Super Widget Pro"' },
      { name: 'Category', value: 'electronics-gadgets', description: 'Generated from "Electronics & Gadgets"' }
    ],
    invalidValue: 'invalid--slug-'
  }
};

// Export components and utilities for direct use
export { SlugFieldComponent } from './component.js';
export { SlugFieldPreview } from './preview.js';

export default SlugFieldPlugin;