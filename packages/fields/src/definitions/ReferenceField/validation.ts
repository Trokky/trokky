import type { 
  ReferenceFieldDefinition, 
  ReferenceValidation,
  ReferenceValue,
  ReferenceSearchResult
} from './definition.js';
import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import { REFERENCE_FIELD_DEFAULTS } from './definition.js';

export function validateReferenceField(
  value: string | string[] | ReferenceValue | ReferenceValue[] | undefined,
  definition: ReferenceFieldDefinition,
  context?: DocumentContext
): ValidationResult {
  const validation = { ...REFERENCE_FIELD_DEFAULTS.validation, ...definition.validation };
  
  const errors: string[] = [];
  
  // Handle required validation
  if (validation.required) {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      errors.push('This field is required');
    }
  }
  
  if (!value) {
    return { isValid: true, errors: [] };
  }
  
  // Normalize value to array for validation
  const references = Array.isArray(value) ? value : [value];
  
  // Check multiple validation
  if (!validation.multiple && references.length > 1) {
    errors.push('Only one reference is allowed');
  }
  
  // Check min/max references
  if (validation.minReferences && references.length < validation.minReferences) {
    errors.push(`At least ${validation.minReferences} reference${validation.minReferences > 1 ? 's' : ''} required`);
  }
  
  if (validation.maxReferences && references.length > validation.maxReferences) {
    errors.push(`Maximum ${validation.maxReferences} reference${validation.maxReferences > 1 ? 's' : ''} allowed`);
  }
  
  // Validate each reference
  for (const ref of references) {
    const refValidation = validateSingleReference(ref, definition);
    if (!refValidation.isValid) {
      errors.push(...refValidation.errors);
    }
  }
  
  // Custom validation
  if (validation.customValidation) {
    // Convert to the format expected by custom validation
    const validationValue = Array.isArray(value) 
      ? value.map(ref => typeof ref === 'string' ? ref : ref._ref)
      : typeof value === 'string' ? value : value?._ref;
      
    const customResult = validation.customValidation(validationValue);
    if (customResult !== true) {
      errors.push(typeof customResult === 'string' ? customResult : 'Invalid reference');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

function validateSingleReference(
  ref: string | ReferenceValue,
  definition: ReferenceFieldDefinition
): ValidationResult {
  const errors: string[] = [];
  
  if (!ref) {
    errors.push('Reference cannot be empty');
    return { isValid: false, errors };
  }
  
  // Handle string reference (ID only)
  if (typeof ref === 'string') {
    if (!ref.trim()) {
      errors.push('Reference ID cannot be empty');
    }
    return { isValid: errors.length === 0, errors };
  }
  
  // Handle structured reference
  if (typeof ref === 'object' && ref._ref) {
    if (!ref._ref.trim()) {
      errors.push('Reference ID cannot be empty');
    }
    
    if (!ref._type) {
      errors.push('Reference type is required');
    }
    
    // Validate against target types
    const allowedTypes = getTargetTypes(definition);
    if (allowedTypes.length > 0 && !allowedTypes.includes(ref._type)) {
      errors.push(`Reference type '${ref._type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return { isValid: errors.length === 0, errors };
  }
  
  errors.push('Invalid reference format');
  return { isValid: false, errors };
}

function getTargetTypes(definition: ReferenceFieldDefinition): string[] {
  const { to } = definition;
  
  if (typeof to === 'string') {
    return [to];
  }
  
  if (Array.isArray(to)) {
    return to.map(target => typeof target === 'string' ? target : target.type);
  }
  
  return [];
}

export function sanitizeReferenceValue(
  value: any
): string | string[] | ReferenceValue | ReferenceValue[] | undefined {
  if (!value) return undefined;
  
  // Handle array values
  if (Array.isArray(value)) {
    const sanitized = value
      .map(sanitizeSingleReference)
      .filter(ref => ref !== undefined);
    
    if (sanitized.length === 0) return undefined;
    
    // Check if all are strings
    const allStrings = sanitized.every(ref => typeof ref === 'string');
    if (allStrings) {
      return sanitized as string[];
    }
    
    // Otherwise return as ReferenceValue array
    return sanitized as ReferenceValue[];
  }
  
  return sanitizeSingleReference(value);
}

function sanitizeSingleReference(value: any): string | ReferenceValue | undefined {
  if (!value) return undefined;
  
  // Handle string reference
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  
  // Handle object reference
  if (typeof value === 'object' && value._ref) {
    const sanitized: ReferenceValue = {
      _ref: String(value._ref).trim(),
      _type: String(value._type || '').trim()
    };
    
    if (!sanitized._ref || !sanitized._type) {
      return undefined;
    }
    
    // Preserve cached data if present
    if (value._cached && typeof value._cached === 'object') {
      sanitized._cached = { ...value._cached };
    }
    
    // Preserve metadata if present
    if (value._metadata && typeof value._metadata === 'object') {
      sanitized._metadata = { ...value._metadata };
    }
    
    return sanitized;
  }
  
  return undefined;
}

export function getDefaultReferenceValue(definition: ReferenceFieldDefinition): any {
  const defaultValue = definition.default;
  const validation = { ...REFERENCE_FIELD_DEFAULTS.validation, ...definition.validation };
  
  if (defaultValue !== undefined) {
    return sanitizeReferenceValue(defaultValue);
  }
  
  if (validation.multiple) {
    return [];
  }
  
  return undefined;
}

export function normalizeReferenceValue(value: any): ReferenceValue[] {
  const sanitized = sanitizeReferenceValue(value);
  
  if (!sanitized) return [];
  
  const references = Array.isArray(sanitized) ? sanitized : [sanitized];
  
  return references.map(ref => {
    if (typeof ref === 'string') {
      return {
        _ref: ref,
        _type: 'unknown'
      };
    }
    return ref;
  });
}

export function getReferenceDisplayValue(
  ref: string | ReferenceValue,
  displayField: string = 'title'
): string {
  if (typeof ref === 'string') {
    return ref;
  }
  
  if (ref._cached && ref._cached[displayField]) {
    return String(ref._cached[displayField]);
  }
  
  if (ref._cached?.title) {
    return ref._cached.title;
  }
  
  return ref._ref || 'Unknown Reference';
}