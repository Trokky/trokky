import type { ArrayFieldDefinition, ArrayItemDefinition } from './definition.js';

/**
 * Validates an array field value
 */
export function validateArrayField(
  value: any[], 
  definition: ArrayFieldDefinition
): { valid: boolean; message?: string } {
  // Check if required field is empty
  if (definition.required && (!value || value.length === 0)) {
    return { valid: false, message: 'This field is required' };
  }

  // If value is empty and not required, it's valid
  if (!value || value.length === 0) {
    return { valid: true };
  }

  // Check array length constraints
  if (definition.validation?.minItems && value.length < definition.validation.minItems) {
    return { 
      valid: false, 
      message: `At least ${definition.validation.minItems} items are required` 
    };
  }

  if (definition.validation?.maxItems && value.length > definition.validation.maxItems) {
    return { 
      valid: false, 
      message: `Maximum ${definition.validation.maxItems} items allowed` 
    };
  }

  // Check uniqueness if required
  if (definition.validation?.unique) {
    const uniqueValues = new Set(value);
    if (uniqueValues.size !== value.length) {
      return { valid: false, message: 'All items must be unique' };
    }
  }

  return { valid: true };
}

/**
 * Gets default value for a new array item
 */
export function getDefaultItemValue(definition: ArrayFieldDefinition): any {
  const itemDef = definition.of;
  
  if (itemDef.default !== undefined) {
    return itemDef.default;
  }

  switch (itemDef.type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'date':
      return new Date().toISOString();
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

/**
 * Validates adding a new item to array
 */
export function validateArrayAdd(
  currentArray: any[], 
  newItem: any, 
  definition: ArrayFieldDefinition
): { valid: boolean; message?: string } {
  const newArray = [...currentArray, newItem];
  return validateArrayField(newArray, definition);
}

/**
 * Validates removing an item from array
 */
export function validateArrayRemove(
  currentArray: any[], 
  index: number, 
  definition: ArrayFieldDefinition
): { valid: boolean; message?: string } {
  const newArray = currentArray.filter((_, i) => i !== index);
  return validateArrayField(newArray, definition);
}

/**
 * Validates moving an item within array
 */
export function validateArrayMove(
  currentArray: any[], 
  fromIndex: number, 
  toIndex: number, 
  definition: ArrayFieldDefinition
): { valid: boolean; message?: string } {
  // Moving items doesn't change validation constraints
  return { valid: true };
}

/**
 * Sanitizes array item value
 */
export function sanitizeArrayItem(value: any, itemDefinition: ArrayItemDefinition): any {
  if (value === null || value === undefined) {
    return null;
  }

  switch (itemDefinition.type) {
    case 'string':
      return String(value);
    case 'number':
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    case 'boolean':
      return Boolean(value);
    case 'date':
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return value;
      return new Date().toISOString();
    default:
      return value;
  }
}