/**
 * Info Field Validation
 * Info fields are display-only, so they always pass validation
 */

import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { InfoFieldDefinition } from './definition.js';

/**
 * Validate info field value
 * Info fields don't store values, so validation always passes
 */
export function validateInfoField(
  value: any,
  definition: InfoFieldDefinition
): ValidationResult {
  // Info fields are always valid since they don't store data
  return {
    isValid: true,
    errors: [],
    warnings: [],
  };
}
