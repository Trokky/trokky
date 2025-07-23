/**
 * Browser-safe field types for Trokky Studio
 * Extracted from @trokky/fields-core without Node.js dependencies
 */

// Browser-safe field category enum (replaces @trokky/core import)
export const FieldCategory = {
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean', 
  DATE: 'date',
  MEDIA: 'media',
  REFERENCE: 'reference',
  STRUCTURE: 'structure'
} as const;

export type FieldCategoryType = typeof FieldCategory[keyof typeof FieldCategory];

// Basic field type interface (browser-safe)
export interface FieldType<Config = any, Value = any> {
  name: string;
  category: FieldCategoryType;
  description?: string;
  icon?: string;
  validate: (value: Value, config: Config, context?: any) => any;
  serialize?: (value: Value, config: Config) => any;
  deserialize?: (data: any, config: Config) => Value;
  defaultValue?: Value | ((config: Config) => Value);
  examples?: Array<{
    title: string;
    config: Config;
    value: Value;
  }>;
}

// Field configuration types
export type StringFieldConfig = {
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  format?: string;
};
export type NumberFieldConfig = {
  min?: number;
  max?: number;
  required?: boolean;
  step?: number;
  precision?: number;
  placeholder?: string;
  format?: string;
};
export type BooleanFieldConfig = {
  layout?: 'switch' | 'checkbox';
  trueLabel?: string;
  falseLabel?: string;
};

// Simple browser-safe field types (core 4 working types from Studio)
export const StringFieldType: FieldType<StringFieldConfig, string> = {
  name: 'string',
  category: FieldCategory.TEXT,
  description: 'Single line text input',
  icon: 'document-text',
  validate: (value, config) => {
    if (config?.required && (!value || value.trim() === '')) {
      return { valid: false, message: 'This field is required' };
    }
    if (config?.maxLength && value && value.length > config.maxLength) {
      return { valid: false, message: `Maximum length is ${config.maxLength} characters` };
    }
    return { valid: true };
  },
  defaultValue: ''
};

export const SimpleStringFieldType: FieldType<{required?: boolean}, string> = {
  name: 'simple-string',
  category: FieldCategory.TEXT,
  description: 'Simple text field',
  icon: 'document-text',
  validate: (value, config) => {
    if (config?.required && (!value || value.trim() === '')) {
      return { valid: false, message: 'This field is required' };
    }
    return { valid: true };
  },
  defaultValue: ''
};

export const NumberFieldType: FieldType<NumberFieldConfig, number> = {
  name: 'number',
  category: FieldCategory.NUMBER,
  description: 'Numeric input',
  icon: 'hashtag',
  validate: (value, config) => {
    if (config?.required && (value === null || value === undefined)) {
      return { valid: false, message: 'This field is required' };
    }
    if (value !== null && value !== undefined) {
      if (config?.min !== undefined && value < config.min) {
        return { valid: false, message: `Minimum value is ${config.min}` };
      }
      if (config?.max !== undefined && value > config.max) {
        return { valid: false, message: `Maximum value is ${config.max}` };
      }
    }
    return { valid: true };
  },
  defaultValue: 0
};

export const BooleanFieldType: FieldType<BooleanFieldConfig, boolean> = {
  name: 'boolean',
  category: FieldCategory.BOOLEAN,
  description: 'True/false toggle',
  icon: 'check-circle',
  validate: () => ({ valid: true }),
  defaultValue: false
};

// Placeholder types for fields without React components yet
export const DateFieldType: FieldType = { name: 'date', category: FieldCategory.DATE, description: 'Date field', validate: () => ({ valid: true }) };
export const ArrayFieldType: FieldType = { name: 'array', category: FieldCategory.STRUCTURE, description: 'Array field', validate: () => ({ valid: true }) };
export const ObjectFieldType: FieldType = { name: 'object', category: FieldCategory.STRUCTURE, description: 'Object field', validate: () => ({ valid: true }) };
export const ReferenceFieldType: FieldType = { name: 'reference', category: FieldCategory.REFERENCE, description: 'Reference field', validate: () => ({ valid: true }) };
export const SlugFieldType: FieldType = { name: 'slug', category: FieldCategory.TEXT, description: 'Slug field', validate: () => ({ valid: true }) };
export const EmailFieldType: FieldType = { name: 'email', category: FieldCategory.TEXT, description: 'Email field', validate: () => ({ valid: true }) };
export const URLFieldType: FieldType = { name: 'url', category: FieldCategory.TEXT, description: 'URL field', validate: () => ({ valid: true }) };
export const ImageFieldType: FieldType = { name: 'image', category: FieldCategory.MEDIA, description: 'Image field', validate: () => ({ valid: true }) };
export const FileFieldType: FieldType = { name: 'file', category: FieldCategory.MEDIA, description: 'File field', validate: () => ({ valid: true }) };

// Array of all built-in field types (browser-safe)
export const BuiltInFieldTypes = [
  StringFieldType,
  SimpleStringFieldType,
  NumberFieldType,
  BooleanFieldType,
  DateFieldType,
  ArrayFieldType,
  ObjectFieldType,
  ReferenceFieldType,
  SlugFieldType,
  EmailFieldType,
  URLFieldType,
  ImageFieldType,
  FileFieldType
];