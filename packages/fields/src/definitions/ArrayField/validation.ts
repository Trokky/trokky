import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { ArrayFieldDefinition, ArrayOption } from './definition.js';

export function validateArrayField(value: any[] | null | undefined, definition: ArrayFieldDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Handle null/undefined values
  if (value === null || value === undefined) {
    if (definition.validation?.required || definition.required) {
      errors.push('Array is required');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }
  
  // Ensure value is an array
  if (!Array.isArray(value)) {
    errors.push('Value must be an array');
    return { isValid: false, errors, warnings };
  }
  
  const validation = definition.validation || {};
  const arrayValue = value as any[];
  
  // Length validation
  if (validation.minItems !== undefined && arrayValue.length < validation.minItems) {
    errors.push(`Array must have at least ${validation.minItems} item${validation.minItems !== 1 ? 's' : ''}`);
  }
  
  if (validation.maxItems !== undefined && arrayValue.length > validation.maxItems) {
    errors.push(`Array must have no more than ${validation.maxItems} item${validation.maxItems !== 1 ? 's' : ''}`);
  }
  
  // Uniqueness validation
  if (validation.unique) {
    const uniqueValues = new Set();
    const duplicates = new Set();
    
    arrayValue.forEach((item, index) => {
      const valueToCheck = validation.uniqueBy 
        ? (item && typeof item === 'object' ? item[validation.uniqueBy] : item)
        : item;
        
      if (uniqueValues.has(valueToCheck)) {
        duplicates.add(valueToCheck);
      } else {
        uniqueValues.add(valueToCheck);
      }
    });
    
    if (duplicates.size > 0) {
      errors.push(`Duplicate values are not allowed: ${Array.from(duplicates).join(', ')}`);
    }
  }
  
  // Item type validation
  arrayValue.forEach((item, index) => {
    const itemValidation = validateArrayItem(item, definition, index);
    if (!itemValidation.isValid) {
      errors.push(`Item ${index + 1}: ${itemValidation.errors.join(', ')}`);
    }
    warnings.push(...itemValidation.warnings || []);
  });
  
  // Options validation (for select/radio/checkbox layouts)
  if (definition.options_list && arrayValue.length > 0) {
    const validValues = new Set(definition.options_list.map(opt => opt.value));
    
    arrayValue.forEach((item, index) => {
      if (!validValues.has(item)) {
        warnings.push(`Item ${index + 1}: "${item}" is not in the predefined options list`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a single array item
 */
export function validateArrayItem(item: any, definition: ArrayFieldDefinition, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (item === null || item === undefined) {
    errors.push('Item cannot be null or undefined');
    return { isValid: false, errors, warnings };
  }
  
  // Type-specific validation
  switch (definition.itemType) {
    case 'string':
      if (typeof item !== 'string') {
        errors.push(`Expected string, got ${typeof item}`);
      } else {
        // Additional string validation
        if (item.trim().length === 0) {
          warnings.push('Empty string value');
        }
        // XSS prevention for string items
        if (/<[^>]*>/.test(item)) {
          warnings.push('Item contains HTML-like content');
        }
      }
      break;
      
    case 'number':
      if (typeof item !== 'number') {
        errors.push(`Expected number, got ${typeof item}`);
      } else if (!isFinite(item)) {
        errors.push('Number must be finite');
      }
      break;
      
    case 'boolean':
      if (typeof item !== 'boolean') {
        errors.push(`Expected boolean, got ${typeof item}`);
      }
      break;
      
    case 'object':
      if (typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`Expected object, got ${typeof item}`);
      } else {
        // Validate object structure if itemDefinition is provided
        if (definition.itemDefinition) {
          const objectValidation = validateObjectItem(item, definition.itemDefinition);
          errors.push(...objectValidation.errors);
          warnings.push(...objectValidation.warnings || []);
        }
      }
      break;
      
    case 'reference':
      // Basic reference validation - should have _ref property
      if (typeof item !== 'object' || !item._ref) {
        errors.push('Reference items must have a _ref property');
      }
      break;
      
    default:
      warnings.push(`Unknown item type: ${definition.itemType}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate object item structure
 */
function validateObjectItem(item: any, itemDefinition: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic object validation - more sophisticated validation would require
  // field registry access to validate individual fields
  if (!item || typeof item !== 'object') {
    errors.push('Invalid object structure');
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate array add operation
 */
export function validateArrayAdd(currentArray: any[], newItem: any, definition: ArrayFieldDefinition, index?: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check max items constraint
  if (definition.validation?.maxItems && currentArray.length >= definition.validation.maxItems) {
    errors.push(`Cannot add item: maximum of ${definition.validation.maxItems} items allowed`);
  }
  
  // Validate the new item itself
  const itemValidation = validateArrayItem(newItem, definition, index ?? currentArray.length);
  errors.push(...itemValidation.errors);
  warnings.push(...itemValidation.warnings || []);
  
  // Check uniqueness if required
  if (definition.validation?.unique) {
    const valueToCheck = definition.validation.uniqueBy 
      ? (newItem && typeof newItem === 'object' ? newItem[definition.validation.uniqueBy] : newItem)
      : newItem;
      
    const exists = currentArray.some(existingItem => {
      const existingValue = definition.validation?.uniqueBy
        ? (existingItem && typeof existingItem === 'object' ? existingItem[definition.validation.uniqueBy] : existingItem)
        : existingItem;
      return existingValue === valueToCheck;
    });
    
    if (exists) {
      errors.push('Item already exists in array (duplicates not allowed)');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate array remove operation
 */
export function validateArrayRemove(currentArray: any[], index: number, definition: ArrayFieldDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check bounds
  if (index < 0 || index >= currentArray.length) {
    errors.push('Invalid index for remove operation');
    return { isValid: false, errors, warnings };
  }
  
  // Check min items constraint
  if (definition.validation?.minItems && currentArray.length <= definition.validation.minItems) {
    errors.push(`Cannot remove item: minimum of ${definition.validation.minItems} items required`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate array move operation
 */
export function validateArrayMove(currentArray: any[], fromIndex: number, toIndex: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check bounds
  if (fromIndex < 0 || fromIndex >= currentArray.length || toIndex < 0 || toIndex >= currentArray.length) {
    errors.push('Invalid indices for move operation');
  }
  
  if (fromIndex === toIndex) {
    warnings.push('Move operation has no effect (same position)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get default value for array item based on type
 */
// Counter for generating unique item numbers
let itemCounter = 1;

export function getDefaultItemValue(definition: ArrayFieldDefinition): any {
  switch (definition.itemType) {
    case 'string':
      // For list layouts, provide numbered placeholder text instead of empty string
      if (definition.options?.layout === 'list') {
        return `New todo item ${itemCounter++}`;
      }
      // For grid layouts, provide placeholder image names
      if (definition.options?.layout === 'grid') {
        return `photo-${itemCounter++}.jpg`;
      }
      return '';
    case 'number':
      // For number arrays, generate random values instead of always 0
      return Math.floor(Math.random() * 100) + 1;
    case 'boolean':
      return false;
    case 'object':
      return definition.itemDefinition ? {} : {};
    case 'reference':
      return { _ref: '' };
    default:
      return null;
  }
}

/**
 * Sanitize array item for security with protection against XSS and prototype pollution
 */
export function sanitizeArrayItem(item: any, definition: ArrayFieldDefinition): any {
  // Prevent null/undefined
  if (item === null || item === undefined) {
    return getDefaultItemValue(definition);
  }
  
  switch (definition.itemType) {
    case 'string':
      if (typeof item === 'string') {
        // Enhanced XSS prevention
        return item
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '') // Remove dangerous characters and control chars
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/data:/gi, '') // Remove data: protocol  
          .replace(/vbscript:/gi, '') // Remove vbscript: protocol
          .trim()
          .slice(0, 1000); // Limit length to prevent DoS
      }
      return String(item || '').slice(0, 1000);
      
    case 'number':
      const num = parseFloat(item);
      return isFinite(num) ? num : 0;
      
    case 'boolean':
      return Boolean(item);
      
    case 'object':
      // Enhanced object sanitization with prototype pollution protection
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return sanitizeObject(item);
      }
      return {};
      
    case 'reference':
      if (typeof item === 'object' && item !== null && item._ref) {
        return { _ref: String(item._ref).slice(0, 100) }; // Limit ref length
      }
      return { _ref: '' };
      
    default:
      return item;
  }
}

/**
 * Deep sanitize object to prevent prototype pollution
 */
function sanitizeObject(obj: any, depth = 0): any {
  // Prevent deep recursion DoS
  if (depth > 10) {
    return {};
  }
  
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return {};
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    
    // Limit object keys
    if (Object.keys(sanitized).length >= 50) {
      break;
    }
    
    // Sanitize key
    const sanitizedKey = String(key)
      .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '')
      .slice(0, 100);
      
    if (!sanitizedKey) continue;
    
    // Recursively sanitize value
    if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    } else if (typeof value === 'string') {
      sanitized[sanitizedKey] = String(value)
        .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '')
        .slice(0, 1000);
    } else if (typeof value === 'number') {
      sanitized[sanitizedKey] = isFinite(value) ? value : 0;
    } else if (typeof value === 'boolean') {
      sanitized[sanitizedKey] = Boolean(value);
    } else {
      // Skip functions, symbols, etc.
      continue;
    }
  }
  
  return sanitized;
}