/**
 * String Field Validation
 * Server-side validation logic for string fields
 */

import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import type { StringFieldDefinition } from './definition.js';

export function validateStringField(
  value: string,
  definition: StringFieldDefinition,
  _context?: DocumentContext
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validation = definition.validation || {};

  // Convert value to string and trim whitespace
  const stringValue = String(value || '').trim();

  // Required validation
  if (definition.required && !stringValue) {
    errors.push(`${definition.title} is required`);
  }

  // Skip other validations if value is empty and not required
  if (!stringValue && !definition.required) {
    return { isValid: true, errors: [], warnings };
  }

  // Length validations
  if (validation.minLength !== undefined && stringValue.length < validation.minLength) {
    errors.push(`${definition.title} must be at least ${validation.minLength} characters long`);
  }

  if (validation.maxLength !== undefined && stringValue.length > validation.maxLength) {
    errors.push(`${definition.title} must be no more than ${validation.maxLength} characters long`);
  }

  // Pattern validation
  if (validation.pattern) {
    const regex = typeof validation.pattern === 'string' 
      ? new RegExp(validation.pattern) 
      : validation.pattern;
    
    if (!regex.test(stringValue)) {
      errors.push(`${definition.title} format is invalid`);
    }
  }

  // Email validation
  if (validation.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stringValue)) {
      errors.push(`${definition.title} must be a valid email address`);
    }
  }

  // URL validation
  if (validation.url) {
    try {
      new URL(stringValue);
    } catch {
      errors.push(`${definition.title} must be a valid URL`);
    }
  }

  // Custom validation
  if (validation.custom) {
    const customResult = validation.custom(stringValue);
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