import { SlugFieldComponent } from './component.js';
import { SlugFieldPreview } from './preview.js';
// Unicode-aware slugify algorithm based on legacy Trokky implementation
export function defaultSlugify(input, options = {}) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    const { preserveCase = false, allowedChars = '', prefix = '', suffix = '' } = options;
    let slug = input
        .toString()
        .normalize('NFD') // Normalize unicode characters (decompose)
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks (accents)
        .trim(); // Remove leading/trailing whitespace
    // Convert to lowercase unless preserveCase is true
    if (!preserveCase) {
        slug = slug.toLowerCase();
    }
    // Build character class for allowed characters
    const baseChars = preserveCase ? 'a-zA-Z0-9' : 'a-z0-9';
    const escapedAllowedChars = allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allowedPattern = `[^${baseChars}\\s\\-${escapedAllowedChars}]`;
    slug = slug
        .replace(new RegExp(allowedPattern, 'g'), '') // Remove invalid characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
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
export function generateUniqueSlug(baseSlug, isUnique) {
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
export function validateSlugFormat(slug, definition) {
    const errors = [];
    const warnings = [];
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
        const escapedAllowed = allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const validPattern = new RegExp(`^[${baseChars}\\-${escapedAllowed}]+$`);
        if (!validPattern.test(slug)) {
            errors.push('Slug contains invalid characters');
        }
    }
    return { isValid: errors.length === 0, errors, warnings };
}
// Get source field value for auto-generation
export function getSourceValue(source, document) {
    if (!source)
        return '';
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
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}
// SlugField Plugin Definition
export const SlugFieldPlugin = {
    type: 'slug',
    displayName: 'Slug',
    description: 'URL-friendly slug field with auto-generation and uniqueness validation',
    category: 'text',
    // Components
    component: SlugFieldComponent,
    previewComponent: SlugFieldPreview,
    // Generate default value
    getDefaultValue: (definition) => {
        return definition.allowEmpty ? '' : 'untitled';
    },
    // Validate slug value
    validate: (value, definition) => {
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
            prefix: definition.prefix,
            suffix: definition.suffix
        };
    },
    fromSchemaField: (schemaField) => {
        return {
            type: 'slug',
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
                    type: 'slug',
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
                    type: 'slug',
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
                    type: 'slug',
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
