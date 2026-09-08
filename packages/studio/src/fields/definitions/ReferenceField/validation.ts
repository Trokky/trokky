import type {
  ReferenceFieldDefinition,
  ReferenceValue
} from './definition.js';
import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import { REFERENCE_FIELD_DEFAULTS } from './definition.js';

export function validateReferenceField(
  value: string | string[] | ReferenceValue | ReferenceValue[] | undefined,
  definition: ReferenceFieldDefinition,
  _context?: DocumentContext
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
  
  // Validate each reference (skip null/undefined in arrays)
  for (const ref of references) {
    // Skip null/undefined references in arrays (they'll be filtered out by sanitization)
    if (!ref && Array.isArray(value)) {
      continue;
    }
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

    // Validate against target types (typed reference) or includeTypes/excludeTypes (universal reference)
    if (ref._type && !isTypeAllowed(ref._type, definition)) {
      const allowedTypes = getTargetTypes(definition);
      if (allowedTypes.length > 0) {
        // Typed reference: show allowed types
        errors.push(`Reference type '${ref._type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      } else {
        // Universal reference with filters
        const { includeTypes, excludeTypes } = definition.options || {};
        if (includeTypes && includeTypes.length > 0) {
          errors.push(`Reference type '${ref._type}' is not allowed. Allowed types: ${includeTypes.join(', ')}`);
        } else if (excludeTypes && excludeTypes.length > 0) {
          errors.push(`Reference type '${ref._type}' is excluded.`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }
  
  errors.push('Invalid reference format');
  return { isValid: false, errors };
}

/**
 * Get the allowed target types for a reference field.
 * Returns an empty array for universal references (when `to` is not specified),
 * which means any document type is allowed.
 */
function getTargetTypes(definition: ReferenceFieldDefinition): string[] {
  const { to } = definition;

  // Universal reference: no `to` specified, any type allowed
  if (!to) {
    return [];
  }

  if (typeof to === 'string') {
    return [to];
  }

  if (Array.isArray(to)) {
    return to.map(target => typeof target === 'string' ? target : target.type);
  }

  return [];
}

/**
 * Check if a reference type is allowed based on the field definition.
 * For universal references, applies includeTypes/excludeTypes filtering.
 */
export function isTypeAllowed(
  refType: string,
  definition: ReferenceFieldDefinition
): boolean {
  const { to, options } = definition;

  // Typed reference: check against explicit `to` types
  if (to) {
    const allowedTypes = getTargetTypes(definition);
    return allowedTypes.includes(refType);
  }

  // Universal reference: apply includeTypes/excludeTypes filtering
  const { includeTypes, excludeTypes } = options || {};

  // If includeTypes is specified, type must be in the list
  if (includeTypes && includeTypes.length > 0) {
    if (!includeTypes.includes(refType)) {
      return false;
    }
  }

  // If excludeTypes is specified, type must not be in the list
  if (excludeTypes && excludeTypes.length > 0) {
    if (excludeTypes.includes(refType)) {
      return false;
    }
  }

  return true;
}

/**
 * Get filtered document types for universal references.
 * Applies includeTypes/excludeTypes filtering to the list of all available types.
 */
export function getFilteredTypes(
  definition: ReferenceFieldDefinition,
  allTypes: string[]
): string[] {
  const { to, options } = definition;

  // Typed reference: return explicit `to` types
  if (to) {
    return getTargetTypes(definition);
  }

  // Universal reference: apply filtering
  const { includeTypes, excludeTypes } = options || {};
  let types = [...allTypes];

  if (includeTypes && includeTypes.length > 0) {
    types = types.filter(t => includeTypes.includes(t));
  }

  if (excludeTypes && excludeTypes.length > 0) {
    types = types.filter(t => !excludeTypes.includes(t));
  }

  return types;
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

  // Handle object reference with _ref
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

  // Handle empty reference placeholder (from array add item)
  // Return a marker object that ReferenceField can recognize as "empty but valid slot"
  if (typeof value === 'object' && value._type === 'reference' && !value._ref) {
    return { _ref: '', _type: 'reference', _empty: true } as any;
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