/**
 * Field Registration API - Public API for developers to register custom fields
 */

// Local type definition to avoid importing @trokky/core in browser
interface FieldType<Config = any, Value = any> {
  name: string
  category?: string | any  // FieldCategory enum from @trokky/core
  description?: string
  icon?: string
  validate?: (value: Value, config: Config, context?: any) => any
  serialize?: (value: Value, config: Config) => any
  deserialize?: (data: any, config: Config) => Value
  defaultValue?: Value | ((config: Config) => Value)
  examples?: Array<{
    title: string
    config: Config
    value: Value
  }>
  component?: any
  preview?: any
}
import { 
  registerCustomFieldType, 
  registerCustomFieldTypes, 
  unregisterFieldType,
  getRegistrationStatus
} from '../services/field-registry-setup.js'
import { createStudioLogger } from '../utils/logger.js'

const logger = createStudioLogger('FieldRegistrationAPI')

/**
 * Public API for field type registration
 */
export const FieldRegistration = {
  /**
   * Register a single custom field type
   * 
   * @example
   * ```typescript
   * import { MyCustomField } from './fields/MyCustomField'
   * 
   * FieldRegistration.register(MyCustomField)
   * ```
   */
  register(fieldType: FieldType): void {
    logger.debug(`API call: register field type "${fieldType.name}"`)
    registerCustomFieldType(fieldType)
  },

  /**
   * Register multiple custom field types
   * 
   * @example
   * ```typescript
   * import { MyField1, MyField2 } from './fields'
   * 
   * FieldRegistration.registerMany([MyField1, MyField2])
   * ```
   */
  registerMany(fieldTypes: FieldType[]): void {
    logger.debug(`API call: register ${fieldTypes.length} field types`)
    registerCustomFieldTypes(fieldTypes)
  },

  /**
   * Unregister a field type
   * 
   * @example
   * ```typescript
   * FieldRegistration.unregister('my-custom-field')
   * ```
   */
  unregister(typeName: string): boolean {
    logger.debug(`API call: unregister field type "${typeName}"`)
    return unregisterFieldType(typeName)
  },

  /**
   * Get list of all registered field types
   * 
   * @example
   * ```typescript
   * const types = FieldRegistration.getRegisteredTypes()
   * console.log('Available field types:', types)
   * ```
   */
  getRegisteredTypes(): string[] {
    return getRegistrationStatus().types
  },

  /**
   * Get detailed registration status
   * 
   * @example
   * ```typescript
   * const status = FieldRegistration.getStatus()
   * console.log(`${status.total} field types registered`)
   * console.log('By category:', status.byCategory)
   * ```
   */
  getStatus() {
    return getRegistrationStatus()
  },

  /**
   * Check if a field type is registered
   * 
   * @example
   * ```typescript
   * if (FieldRegistration.isRegistered('string')) {
   *   console.log('String field is available')
   * }
   * ```
   */
  isRegistered(typeName: string): boolean {
    return getRegistrationStatus().types.includes(typeName)
  }
}

/**
 * Convenience function for registering a single field type
 */
export function registerFieldType(fieldType: FieldType): void {
  FieldRegistration.register(fieldType)
}

/**
 * Convenience function for registering multiple field types
 */
export function registerFieldTypes(fieldTypes: FieldType[]): void {
  FieldRegistration.registerMany(fieldTypes)
}