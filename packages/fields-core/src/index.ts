/**
 * @trokky/fields-core
 * Built-in field types for Trokky CMS
 */

// Export all field types
export * from './types/index.js'

// Export utilities and helpers
export * from './utils/validation.js'

// Main registration function for built-in field types
import { FieldTypeRegistry } from '@trokky/core'
import { BuiltInFieldTypes } from './types/index.js'

/**
 * Register all built-in field types with the registry
 */
export function registerBuiltInFieldTypes(): void {
  BuiltInFieldTypes.forEach(fieldType => {
    FieldTypeRegistry.register(fieldType)
  })
}