import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { BooleanFieldDefinition } from './definition.js';

export function validateBooleanField(value: boolean | string | null | undefined, definition: BooleanFieldDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Convert value to boolean for validation
  let boolValue: boolean | null = null;
  
  if (value === null || value === undefined || value === '') {
    // Handle empty/null values
    if (definition.validation?.required || definition.required) {
      errors.push(definition.validation?.message || 'Selection is required');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }
  
  // Convert various inputs to boolean
  if (typeof value === 'boolean') {
    boolValue = value;
  } else if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    
    // Handle common string representations
    if (['true', '1', 'yes', 'on', 'checked'].includes(lowerValue)) {
      boolValue = true;
    } else if (['false', '0', 'no', 'off', 'unchecked', ''].includes(lowerValue)) {
      boolValue = false;
    } else {
      errors.push('Invalid boolean value. Expected true/false or yes/no');
      return { isValid: false, errors, warnings };
    }
  } else {
    // Handle other types by truthiness (numbers, objects, etc.)
    boolValue = Boolean(value);
    
    // Warn about potential type confusion
    if (typeof value === 'number') {
      warnings.push('Number converted to boolean - consider using explicit true/false');
    } else if (typeof value === 'object') {
      warnings.push('Object converted to boolean - this may not be intended');
    }
  }
  
  const validation = definition.validation || {};
  
  // Validate mustBeTrue constraint
  if (validation.mustBeTrue && !boolValue) {
    errors.push(validation.message || 'This field must be checked');
  }
  
  // Validate mustBeFalse constraint (rare but possible)
  if (validation.mustBeFalse && boolValue) {
    errors.push(validation.message || 'This field must be unchecked');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Convert various input types to boolean with security sanitization
 */
export function convertToBoolean(value: any): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Reject dangerous types to prevent XSS and injection attacks
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error('Invalid input type for boolean field');
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Sanitize string input to prevent XSS
    const sanitizedValue = value.replace(/[<>'"&]/g, '').toLowerCase().trim();
    
    if (['true', '1', 'yes', 'on', 'checked'].includes(sanitizedValue)) {
      return true;
    } else if (['false', '0', 'no', 'off', 'unchecked', ''].includes(sanitizedValue)) {
      return false;
    }
  }
  
  // For other types, use JavaScript truthiness but return null for unclear cases
  if (typeof value === 'number' && isFinite(value)) {
    return value !== 0;
  }
  
  // Reject objects, arrays, and other complex types for security
  if (typeof value === 'object') {
    return null;
  }
  
  // For unclear cases, return null to trigger validation error
  return null;
}

/**
 * Get display text for boolean value
 */
export function getBooleanDisplayText(value: boolean | null, definition: BooleanFieldDefinition): string {
  const options = definition.options || {};
  
  if (value === true) {
    return options.trueText || 'Yes';
  } else if (value === false) {
    return options.falseText || 'No';
  } else {
    return '-';
  }
}