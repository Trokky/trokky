import { ValidationErrorDetail, ValidationResult, FieldContext } from '@trokky/core'

/**
 * Helper function to create a validation error
 */
export function createValidationError(
  field: string,
  message: string,
  code: string
): ValidationErrorDetail {
  return { field, message, code }
}

/**
 * Helper function to create validation errors array
 */
export function createValidationErrors(
  fieldPath: string,
  messages: Array<{ message: string; code: string }>
): ValidationErrorDetail[] {
  return messages.map(({ message, code }) => 
    createValidationError(fieldPath, message, code)
  )
}

/**
 * Helper function to get field path from context
 */
export function getFieldPath(context: FieldContext): string {
  return context.fieldPath.join('.')
}

/**
 * Helper function to create a validation result
 */
export function createFieldValidationResult(
  errors: Array<{ message: string; code: string }>,
  fieldPath: string
): ValidationResult {
  return {
    valid: errors.length === 0,
    errors: errors.map(({ message, code }) => 
      createValidationError(fieldPath, message, code)
    )
  }
}

/**
 * Helper function to create a simple validation result
 */
export function createValidationResult(
  errors: ValidationErrorDetail[]
): ValidationResult {
  return {
    valid: errors.length === 0,
    errors
  }
}