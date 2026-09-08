/**
 * Field Types
 * Dynamic field type registry interface for extensible field system
 */

// Field registry interface that @trokky/fields will implement
export interface FieldRegistry {
  getTypes(): string[];
  register(plugin: any): void;
  get(type: string): any;
  has(type: string): boolean;
}

// Dynamic field type getter for runtime type resolution
export interface FieldTypeProvider {
  getRegisteredTypes(): string[];
}

// Core field types (baseline - @trokky/fields can extend this)
export const CORE_FIELD_TYPES = [
  'string', 
  'number', 
  'boolean', 
  'array', 
  'object', 
  'reference', 
  'date', 
  'slug', 
  'email', 
  'url', 
  'text', 
  'richText', 
  'media'
] as const;

export type CoreFieldType = typeof CORE_FIELD_TYPES[number];
export type FieldType = string; // Allow any string for extensibility