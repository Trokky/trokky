/**
 * Textarea Field Validation
 * Server-side validation functions for textarea fields
 */

import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { TextareaFieldDefinition } from './definition.js';

/**
 * Validate textarea field value
 */
export function validateTextareaField(
  value: string,
  definition: TextareaFieldDefinition
): ValidationResult {
  const validation = definition.validation || {};
  const errors: string[] = [];
  const warnings: string[] = [];

  // Convert value to string and handle null/undefined
  const stringValue = value || '';

  // Required validation
  if (definition.required && stringValue.trim().length === 0) {
    errors.push(`${definition.title || 'This field'} is required`);
  }

  // Length validation
  if (validation.minLength && stringValue.length < validation.minLength) {
    errors.push(`Text must be at least ${validation.minLength} characters long`);
  }

  if (validation.maxLength && stringValue.length > validation.maxLength) {
    errors.push(`Text must not exceed ${validation.maxLength} characters`);
  }

  // Word count validation
  if (validation.wordCount) {
    const words = stringValue.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    if (validation.wordCount.min && wordCount < validation.wordCount.min) {
      errors.push(`Text must contain at least ${validation.wordCount.min} words`);
    }

    if (validation.wordCount.max && wordCount > validation.wordCount.max) {
      errors.push(`Text must not exceed ${validation.wordCount.max} words`);
    }
  }

  // Line count validation
  if (validation.lineCount) {
    const lineCount = stringValue.split('\n').length;

    if (validation.lineCount.min && lineCount < validation.lineCount.min) {
      errors.push(`Text must contain at least ${validation.lineCount.min} lines`);
    }

    if (validation.lineCount.max && lineCount > validation.lineCount.max) {
      errors.push(`Text must not exceed ${validation.lineCount.max} lines`);
    }
  }

  // Custom validation
  if (validation.custom) {
    const customResult = validation.custom(stringValue);
    if (!customResult.isValid) {
      errors.push(...(customResult.errors || []));
      warnings.push(...(customResult.warnings || []));
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Get default value for textarea field
 */
export function getTextareaFieldDefaultValue(definition: TextareaFieldDefinition): string {
  return definition.defaultValue || '';
}