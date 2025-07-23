/**
 * Field Registry Setup - Register React field components with @trokky/fields-core field types
 */

import React from 'react'
import { BuiltInFieldTypes } from '@trokky/fields-browser'
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
import { fieldRendererRegistry } from './field-renderer-registry.js'
import type { FieldRendererEntry } from '../types/field-renderer.js'
import { createStudioLogger } from '../utils/logger.js'

// Import our React field components
import { StringField, StringFieldPreview } from '../components/fields/StringField.js'
import { NumberField, NumberFieldPreview } from '../components/fields/NumberField.js'
import { BooleanField, BooleanFieldPreview } from '../components/fields/BooleanField.js'

const logger = createStudioLogger('FieldRegistrySetup')

/**
 * Map field type names to React components
 * @todo Add remaining field types: date, array, object, reference, slug, email, url, image, file
 * @todo Consider auto-generating this mapping from field type definitions
 */
const fieldComponentMap: Record<string, { 
  component: React.ComponentType<any>
  preview?: React.ComponentType<any> 
}> = {
  'string': { component: StringField, preview: StringFieldPreview },
  'simple-string': { component: StringField, preview: StringFieldPreview },
  'number': { component: NumberField, preview: NumberFieldPreview },
  'boolean': { component: BooleanField, preview: BooleanFieldPreview },
  // @todo Add more mappings as we create more components
}

/**
 * Convert field type to renderer entry with React components
 */
function createRendererEntry(fieldType: FieldType): FieldRendererEntry | null {
  // Get React component for this field type
  const componentMapping = fieldComponentMap[fieldType.name]
  
  if (!componentMapping) {
    logger.warn(`No React component found for field type: ${fieldType.name}`)
    return null
  }
  
  // Map field names/categories to UI categories
  const getCategoryFromFieldType = (fieldType: FieldType): FieldRendererEntry['meta']['category'] => {
    const name = fieldType.name.toLowerCase()
    
    // Text-based fields
    if (['string', 'simple-string', 'email', 'url', 'slug'].includes(name)) {
      return 'text'
    }
    
    // Number fields
    if (['number', 'integer', 'float', 'decimal'].includes(name)) {
      return 'number'
    }
    
    // Media fields
    if (['image', 'file', 'video', 'audio'].includes(name)) {
      return 'media'
    }
    
    // Reference fields
    if (['reference', 'cross-reference'].includes(name)) {
      return 'reference'
    }
    
    // Structure fields
    if (['array', 'object', 'group'].includes(name)) {
      return 'structure'
    }
    
    // Default to specialized
    return 'specialized'
  }

  return {
    type: fieldType.name,
    component: componentMapping.component as any,
    preview: componentMapping.preview as any,
    meta: {
      displayName: fieldType.name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      description: fieldType.description || `${fieldType.name} field type`,
      icon: fieldType.icon || 'document-text',
      category: getCategoryFromFieldType(fieldType)
    }
  }
}

/**
 * Auto-discover and register all built-in field types
 */
export function registerBuiltInFieldTypes(): void {
  logger.info('Auto-discovering built-in field types from @trokky/fields-core')

  let registered = 0
  let skipped = 0

  for (const fieldType of BuiltInFieldTypes) {
    try {
      const rendererEntry = createRendererEntry(fieldType)
      
      if (!rendererEntry) {
        logger.debug(`No React component available for field type "${fieldType.name}", skipping`)
        skipped++
        continue
      }

      fieldRendererRegistry.register(rendererEntry)
      
      logger.debug(`Registered field type: ${fieldType.name}`)
      registered++
    } catch (error) {
      logger.error(`Failed to register field type "${fieldType.name}"`, error)
      skipped++
    }
  }

  logger.info(`Built-in field registration complete: ${registered} registered, ${skipped} skipped`)
}

/**
 * Register a custom field type (for developers)
 */
export function registerCustomFieldType(fieldType: FieldType): void {
  logger.info(`Registering custom field type: ${fieldType.name}`)

  try {
    // Validate field type
    if (!fieldType.name) {
      throw new Error('Field type must have a name')
    }

    // Check if already registered
    if (fieldRendererRegistry.hasRenderer(fieldType.name)) {
      logger.warn(`Field type "${fieldType.name}" is already registered, overriding`)
    }

    const rendererEntry = createRendererEntry(fieldType)
    
    if (!rendererEntry) {
      throw new Error(`No React component mapping found for field type "${fieldType.name}"`)
    }
    
    fieldRendererRegistry.register(rendererEntry)
    
    logger.info(`Successfully registered custom field type: ${fieldType.name}`)
  } catch (error) {
    logger.error(`Failed to register custom field type "${fieldType.name}"`, error)
    throw error
  }
}

/**
 * Register multiple custom field types
 */
export function registerCustomFieldTypes(fieldTypes: FieldType[]): void {
  logger.info(`Registering ${fieldTypes.length} custom field types`)

  let registered = 0
  let failed = 0

  for (const fieldType of fieldTypes) {
    try {
      registerCustomFieldType(fieldType)
      registered++
    } catch (error) {
      logger.error(`Failed to register custom field type "${fieldType.name}"`, error)
      failed++
    }
  }

  logger.info(`Custom field registration complete: ${registered} registered, ${failed} failed`)
}

/**
 * Unregister a field type
 */
export function unregisterFieldType(typeName: string): boolean {
  logger.info(`Unregistering field type: ${typeName}`)
  
  const success = fieldRendererRegistry.unregister(typeName)
  
  if (success) {
    logger.info(`Successfully unregistered field type: ${typeName}`)
  } else {
    logger.warn(`Field type "${typeName}" was not registered`)
  }
  
  return success
}

/**
 * Get comprehensive registration status
 */
export function getRegistrationStatus() {
  const registeredTypes = fieldRendererRegistry.getRegisteredTypes()
  const allRenderers = fieldRendererRegistry.getAllRenderers()
  
  // Count by category
  const byCategory = new Map<string, string[]>()
  
  for (const [typeName, entry] of allRenderers) {
    const category = entry.meta.category
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(typeName)
  }

  return {
    total: registeredTypes.length,
    types: registeredTypes.sort(),
    byCategory: Object.fromEntries(
      Array.from(byCategory.entries()).map(([category, types]) => [
        category, 
        { count: types.length, types: types.sort() }
      ])
    ),
    details: Object.fromEntries(
      Array.from(allRenderers.entries()).map(([typeName, entry]) => [
        typeName,
        {
          displayName: entry.meta.displayName,
          description: entry.meta.description,
          category: entry.meta.category,
          icon: entry.meta.icon,
          hasPreview: !!entry.preview
        }
      ])
    )
  }
}

/**
 * Initialize the field registry system
 */
export function initializeFieldRegistry(): void {
  logger.info('Initializing field registry system')
  
  // Clear any existing registrations
  fieldRendererRegistry.clear()
  
  // Register built-in field types
  registerBuiltInFieldTypes()
  
  // Register custom field types from integrated config if available
  const integratedConfig = (window as any).TROKKY_INTEGRATED_CONFIG;
  if (integratedConfig?.customFields && integratedConfig.customFields.length > 0) {
    logger.info(`Registering ${integratedConfig.customFields.length} custom field types from integrated config`);
    registerCustomFieldTypes(integratedConfig.customFields);
  }
  
  // Log final status
  const status = getRegistrationStatus()
  logger.info(`Field registry initialized with ${status.total} field types:`, status.byCategory)
}