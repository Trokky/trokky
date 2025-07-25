import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { URLFieldDefinition } from './definition.js';

export function validateURLField(value: string | null | undefined, definition: URLFieldDefinition): ValidationResult {
  const errors: string[] = [];
  
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    if (definition.validation?.required || definition.required) {
      errors.push(definition.validation?.message || 'URL is required');
    }
    return { isValid: errors.length === 0, errors };
  }
  
  // Basic URL validation
  try {
    const url = new URL(value);
    
    // Check allowed protocols
    const allowedProtocols = definition.validation?.protocols || ['http:', 'https:'];
    if (!allowedProtocols.includes(url.protocol)) {
      errors.push(`URL must use one of these protocols: ${allowedProtocols.map(p => p.replace(':', '')).join(', ')}`);
    }
    
    // Check HTTPS requirement
    if (definition.validation?.requireHttps && url.protocol !== 'https:') {
      errors.push('URL must use HTTPS');
    }
    
  } catch (e) {
    errors.push('Please enter a valid URL (e.g., https://example.com)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}