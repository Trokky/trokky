/**
 * Schema validation utilities for CLI commands
 * Provides client-side validation with helpful error messages
 */

import chalk from 'chalk'
import { TrokkyClient } from '../../client.js'

/**
 * Field definition from schema
 */
interface FieldDefinition {
  type: string
  title?: string
  validation?: {
    required?: boolean
  }
  options?: {
    list?: Array<{ title: string; value: string }>
  }
  fields?: Record<string, FieldDefinition>
  of?: { type: string; fields?: Record<string, FieldDefinition> }
}

/**
 * Schema definition
 */
interface SchemaDefinition {
  name: string
  title?: string
  singleton?: boolean
  fields: Record<string, FieldDefinition>
}

/**
 * Validation error with suggestion
 */
export interface ValidationError {
  field: string
  message: string
  suggestion?: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Schema cache with TTL
 */
interface SchemaCacheEntry {
  schemas: Map<string, SchemaDefinition>
  timestamp: number
}

const schemaCache = new Map<string, SchemaCacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Find similar field names using Levenshtein distance
 */
function findSimilarFields(field: string, validFields: string[], maxDistance: number = 3): string[] {
  const suggestions: Array<{ field: string; distance: number }> = []

  for (const validField of validFields) {
    const distance = levenshteinDistance(field.toLowerCase(), validField.toLowerCase())
    if (distance <= maxDistance) {
      suggestions.push({ field: validField, distance })
    }
  }

  return suggestions
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map(s => s.field)
}

/**
 * Get expected type name for display
 */
function getExpectedTypeName(fieldDef: FieldDefinition): string {
  switch (fieldDef.type) {
    case 'string':
    case 'text':
    case 'slug':
    case 'richtext':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
    case 'reference':
      return 'object (reference)'
    case 'media':
      return 'object (media reference)'
    default:
      return fieldDef.type
  }
}

/**
 * Get actual type name of a value
 */
function getActualTypeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Check if value type matches expected field type
 */
function isValidType(value: unknown, fieldDef: FieldDefinition): boolean {
  if (value === null || value === undefined) return true // Allow null/undefined

  switch (fieldDef.type) {
    case 'string':
    case 'text':
    case 'slug':
    case 'richtext':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'object':
    case 'reference':
    case 'media':
      return typeof value === 'object' && !Array.isArray(value)
    default:
      return true // Unknown types pass through
  }
}

/**
 * Fetch and cache schemas for a client
 */
export async function getSchemas(client: TrokkyClient): Promise<Map<string, SchemaDefinition>> {
  const baseUrl = client.getBaseUrl() || 'default'

  // Check cache first
  const cached = schemaCache.get(baseUrl)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.schemas
  }

  const collections = await client.getCollections()
  const schemas = new Map<string, SchemaDefinition>()

  for (const collection of collections) {
    if (collection.name && collection.fields) {
      schemas.set(collection.name, collection as SchemaDefinition)
    }
  }

  schemaCache.set(baseUrl, { schemas, timestamp: Date.now() })
  return schemas
}

/**
 * Get schema for a specific collection
 */
export async function getSchema(client: TrokkyClient, collection: string): Promise<SchemaDefinition | undefined> {
  const schemas = await getSchemas(client)
  return schemas.get(collection)
}

/**
 * Validate data against collection schema
 */
export async function validateData(
  client: TrokkyClient,
  collection: string,
  data: Record<string, unknown>,
  options: { partial?: boolean } = {}
): Promise<ValidationResult> {
  const schema = await getSchema(client, collection)

  if (!schema) {
    return { valid: true, errors: [] } // Can't validate without schema
  }

  const errors: ValidationError[] = []
  const validFields = Object.keys(schema.fields)
  const systemFields = ['_id', '_collection', '_createdAt', '_updatedAt', '_revision', '_status', '_createdBy', '_updatedBy', '_createdByType', '_updatedByType']

  // Check for unknown fields
  for (const key of Object.keys(data)) {
    if (systemFields.includes(key)) continue // Skip system fields

    if (!validFields.includes(key)) {
      const suggestions = findSimilarFields(key, validFields)
      const error: ValidationError = {
        field: key,
        message: `Unknown field '${key}'`
      }

      if (suggestions.length > 0) {
        error.suggestion = suggestions.length === 1
          ? `Did you mean '${suggestions[0]}'?`
          : `Did you mean one of: ${suggestions.join(', ')}?`
      } else {
        error.suggestion = `Available fields: ${validFields.join(', ')}`
      }

      errors.push(error)
    }
  }

  // Check field types for provided fields
  for (const [key, value] of Object.entries(data)) {
    if (systemFields.includes(key)) continue

    const fieldDef = schema.fields[key]
    if (!fieldDef) continue // Already handled as unknown field

    if (!isValidType(value, fieldDef)) {
      errors.push({
        field: key,
        message: `Field '${key}' expects type '${getExpectedTypeName(fieldDef)}', got '${getActualTypeName(value)}'`
      })
    }

    // Check enum values if field has a list
    if (fieldDef.options?.list && value !== null && value !== undefined) {
      const validValues = fieldDef.options.list.map(item => item.value)
      if (!validValues.includes(value as string)) {
        errors.push({
          field: key,
          message: `Invalid value '${value}' for field '${key}'`,
          suggestion: `Valid values: ${validValues.join(', ')}`
        })
      }
    }
  }

  // Check required fields (only for full updates, not partial)
  if (!options.partial) {
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.validation?.required && !(fieldName in data)) {
        errors.push({
          field: fieldName,
          message: `Required field '${fieldName}' is missing`
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  const lines: string[] = []

  for (const error of errors) {
    lines.push(chalk.red(`  - ${error.message}`))
    if (error.suggestion) {
      lines.push(chalk.yellow(`    ${error.suggestion}`))
    }
  }

  return lines.join('\n')
}

/**
 * Check if a string looks like inline JSON
 */
export function isInlineJson(str: string): boolean {
  const trimmed = str.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

/**
 * Clear schema cache (useful for testing)
 */
export function clearSchemaCache(): void {
  schemaCache.clear()
}
