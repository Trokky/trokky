/**
 * Email Field Validation
 * Validates email addresses with proper regex and domain checks
 */

import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import type { EmailFieldDefinition } from './definition.js';

export function validateEmailField(
  value: string,
  definition: EmailFieldDefinition,
  _context?: DocumentContext
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Convert value to string and trim whitespace
  const emailValue = String(value || '').trim();

  // Required validation
  if (definition.required && !emailValue) {
    errors.push(`${definition.title || 'Email'} is required`);
  }

  // Skip email validation if empty and not required
  if (!emailValue && !definition.required) {
    return { isValid: true, errors: [], warnings };
  }

  // Email format validation (more comprehensive than basic regex)
  if (emailValue) {
    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(emailValue)) {
      errors.push(`${definition.title || 'Email'} must be a valid email address`);
    } else {
      // Additional validations for valid email format
      const [localPart, domain] = emailValue.split('@');
      
      // Local part validations
      if (localPart.length > 64) {
        errors.push('Email local part cannot exceed 64 characters');
      }
      
      // Domain validations  
      if (domain.length > 253) {
        errors.push('Email domain cannot exceed 253 characters');
      }
      
      // Check for common typos in popular domains
      const similarDomains: Record<string, string> = {
        'gmial.com': 'gmail.com',
        'gmai.com': 'gmail.com', 
        'yahooo.com': 'yahoo.com',
        'hotmial.com': 'hotmail.com'
      };
      
      const suggestion = similarDomains[domain.toLowerCase()];
      if (suggestion) {
        warnings.push(`Did you mean ${suggestion}?`);
      }
    }
  }

  // Length validations (email addresses have practical limits)
  const validation = definition.validation;
  
  if (validation?.maxLength !== undefined && emailValue.length > validation.maxLength) {
    errors.push(`${definition.title || 'Email'} must be no more than ${validation.maxLength} characters long`);
  }

  // Custom validation
  if (validation?.custom) {
    const customResult = validation.custom(emailValue);
    errors.push(...customResult.errors);
    if (customResult.warnings) {
      warnings.push(...customResult.warnings);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}