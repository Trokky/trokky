/**
 * Reference Expander Utility
 * Expands reference fields in documents by fetching the referenced documents
 */

import type { ContentSchema } from '../types/index.js'

/**
 * Reference value structure
 */
export interface ReferenceValue {
  _ref: string
  _type: string
  _cached?: Record<string, unknown>
}

/**
 * Options for reference expansion
 */
export interface ExpandOptions {
  /** Fields to expand (dot notation supported for nested fields) */
  fields: string[]
  /** Maximum depth for nested expansions (default: 1) */
  maxDepth?: number
  /** Current depth (internal use) */
  currentDepth?: number
}

/**
 * Document fetcher function type
 */
export type DocumentFetcher = (collection: string, id: string) => Promise<Record<string, unknown> | null>

/**
 * Schema getter function type
 */
export type SchemaGetter = (collection: string) => ContentSchema | null

/**
 * Check if a value is a reference
 */
export function isReference(value: unknown): value is ReferenceValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_ref' in value &&
    '_type' in value &&
    typeof (value as ReferenceValue)._ref === 'string' &&
    typeof (value as ReferenceValue)._type === 'string'
  )
}

/**
 * Find all reference fields in a schema
 */
export function findReferenceFields(
  schema: ContentSchema,
  prefix: string = ''
): string[] {
  const referenceFields: string[] = []
  const fields = schema.fields || {}

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const fieldPath = prefix ? `${prefix}.${fieldName}` : fieldName
    const field = fieldDef as Record<string, unknown>

    if (field.type === 'reference') {
      referenceFields.push(fieldPath)
    } else if (field.type === 'object' && field.fields) {
      // Recursively find references in nested objects
      const nestedSchema = { fields: field.fields } as ContentSchema
      const nestedRefs = findReferenceFields(nestedSchema, fieldPath)
      referenceFields.push(...nestedRefs)
    } else if (field.type === 'array' && field.of) {
      // Check if array contains references
      const arrayOf = field.of as Record<string, unknown>
      if (arrayOf.type === 'reference') {
        referenceFields.push(`${fieldPath}[]`)
      } else if (arrayOf.type === 'object' && arrayOf.fields) {
        // Array of objects with potential references
        const nestedSchema = { fields: arrayOf.fields } as ContentSchema
        const nestedRefs = findReferenceFields(nestedSchema, `${fieldPath}[]`)
        referenceFields.push(...nestedRefs)
      }
    }
  }

  return referenceFields
}

/**
 * Get a nested value from a document using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/\[\]/g, '').split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Set a nested value in a document using dot notation
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.replace(/\[\]/g, '').split('.')
  let current: Record<string, unknown> = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

/**
 * Expand references in a single document
 */
export async function expandDocumentReferences(
  document: Record<string, unknown>,
  options: ExpandOptions,
  fetchDocument: DocumentFetcher,
  getSchema?: SchemaGetter
): Promise<Record<string, unknown>> {
  const { fields, maxDepth = 1, currentDepth = 0 } = options

  if (currentDepth >= maxDepth) {
    return document
  }

  // Create a copy to avoid mutating the original
  const expanded = { ...document }

  // Collect all references to fetch
  const referencesToFetch: Map<string, { collection: string; id: string; paths: string[] }> = new Map()

  for (const fieldPath of fields) {
    const isArrayField = fieldPath.includes('[]')
    const cleanPath = fieldPath.replace(/\[\]/g, '')
    const value = getNestedValue(expanded, cleanPath)

    if (isArrayField && Array.isArray(value)) {
      // Handle array of references
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        if (isReference(item)) {
          const key = `${item._type}:${item._ref}`
          if (!referencesToFetch.has(key)) {
            referencesToFetch.set(key, {
              collection: item._type,
              id: item._ref,
              paths: []
            })
          }
          referencesToFetch.get(key)!.paths.push(`${cleanPath}.${i}`)
        }
      }
    } else if (isReference(value)) {
      // Handle single reference
      const key = `${value._type}:${value._ref}`
      if (!referencesToFetch.has(key)) {
        referencesToFetch.set(key, {
          collection: value._type,
          id: value._ref,
          paths: []
        })
      }
      referencesToFetch.get(key)!.paths.push(cleanPath)
    }
  }

  // Fetch all referenced documents in parallel
  const fetchPromises = Array.from(referencesToFetch.entries()).map(
    async ([key, { collection, id, paths }]) => {
      try {
        const referencedDoc = await fetchDocument(collection, id)
        return { key, document: referencedDoc, paths }
      } catch (error) {
        console.warn(`Failed to expand reference ${collection}/${id}:`, error)
        return { key, document: null, paths }
      }
    }
  )

  const results = await Promise.all(fetchPromises)

  // Apply expanded documents
  for (const { document: referencedDoc, paths } of results) {
    if (referencedDoc) {
      for (const path of paths) {
        // Check if path is an array index path (e.g., "authors.0")
        const pathParts = path.split('.')
        const lastPart = pathParts[pathParts.length - 1]
        const isArrayIndex = /^\d+$/.test(lastPart)

        if (isArrayIndex) {
          // Handle array item expansion
          const arrayPath = pathParts.slice(0, -1).join('.')
          const index = parseInt(lastPart, 10)
          const array = getNestedValue(expanded, arrayPath) as unknown[]
          if (Array.isArray(array) && array[index]) {
            array[index] = referencedDoc
          }
        } else {
          setNestedValue(expanded, path, referencedDoc)
        }
      }
    }
  }

  return expanded
}

/**
 * Expand references in multiple documents
 */
export async function expandDocumentsReferences(
  documents: Record<string, unknown>[],
  options: ExpandOptions,
  fetchDocument: DocumentFetcher,
  getSchema?: SchemaGetter
): Promise<Record<string, unknown>[]> {
  // Process all documents in parallel
  return Promise.all(
    documents.map(doc => expandDocumentReferences(doc, options, fetchDocument, getSchema))
  )
}

/**
 * Parse expand parameter from query string
 * Supports formats:
 * - "field1,field2" - comma-separated field names
 * - "field1,field2[]" - array fields with [] suffix
 * - "*" - expand all reference fields (requires schema)
 */
export function parseExpandParam(
  expandParam: string | string[] | undefined,
  schema?: ContentSchema
): string[] {
  if (!expandParam) return []

  // Handle array of expand params
  const expandString = Array.isArray(expandParam) ? expandParam.join(',') : expandParam

  // Handle wildcard expansion
  if (expandString === '*' && schema) {
    return findReferenceFields(schema)
  }

  // Parse comma-separated fields
  return expandString
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0)
}
