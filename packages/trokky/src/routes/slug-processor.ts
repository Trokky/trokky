import type { TrokkyCore, ContentSchema, SchemaFieldDefinition } from '../core/index.js'
import type { SlugifyOptions, SlugFieldConfig } from '../types/index.js'
import { createLogger } from '../core/index.js'

// Re-export types for consumers of this module
export type { SlugifyOptions, SlugFieldConfig } from '../types/index.js'

const logger = createLogger('routes', 'SlugProcessor')

/**
 * Type-safe helper to get a number option from field or options
 */
function getNumberOption(fieldValue: unknown, optionValue: unknown, defaultValue: number): number {
  if (typeof fieldValue === 'number' && !isNaN(fieldValue)) return fieldValue
  if (typeof optionValue === 'number' && !isNaN(optionValue)) return optionValue
  return defaultValue
}

/**
 * Type-safe helper to get a string option from field or options
 */
function getStringOption(fieldValue: unknown, optionValue: unknown, defaultValue: string): string {
  if (typeof fieldValue === 'string') return fieldValue
  if (typeof optionValue === 'string') return optionValue
  return defaultValue
}

/**
 * Type-safe helper to get a boolean option from field or options
 */
function getBooleanOption(fieldValue: unknown, optionValue: unknown, defaultValue: boolean): boolean {
  if (typeof fieldValue === 'boolean') return fieldValue
  if (typeof optionValue === 'boolean') return optionValue
  return defaultValue
}

/**
 * Unicode-aware slugify algorithm
 * Replicates the client-side logic from @trokky/fields for server-side consistency
 *
 * Note: Character class regex is safe - user input (allowedChars) is properly escaped
 */
export function defaultSlugify(input: string, options: SlugifyOptions = {}): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  const {
    preserveCase = false,
    allowedChars = '',
    allowSlashes = true,
    prefix = '',
    suffix = ''
  } = options

  let slug = input
    .toString()
    .normalize('NFD')                          // Normalize unicode characters (decompose)
    .replace(/[\u0300-\u036f]/g, '')          // Remove diacritical marks (accents)
    .trim()                                    // Remove leading/trailing whitespace

  // Convert to lowercase unless preserveCase is true
  if (!preserveCase) {
    slug = slug.toLowerCase()
  }

  // Build character class for allowed characters
  const baseChars = preserveCase ? 'a-zA-Z0-9' : 'a-z0-9'
  const slashChar = allowSlashes ? '\\/' : ''
  // Escape special regex characters in allowedChars to prevent ReDoS
  const escapedAllowedChars = allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const allowedPattern = `[^${baseChars}\\s\\-${slashChar}${escapedAllowedChars}]`

  slug = slug
    .replace(new RegExp(allowedPattern, 'g'), '')  // Remove invalid characters
    .replace(/\s+/g, '-')                          // Replace spaces with hyphens
    .replace(/-+/g, '-')                           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')                         // Remove leading/trailing hyphens

  // Add prefix and suffix
  if (prefix && slug) {
    // Don't add separator if prefix already ends with one (/, -, etc.)
    const needsSeparator = !prefix.endsWith('/') && !prefix.endsWith('-') && !slug.startsWith('-')
    slug = prefix + (needsSeparator ? '-' : '') + slug
  }
  if (suffix && slug) {
    // Don't add separator if suffix already starts with one or slug ends with one
    const needsSeparator = !suffix.startsWith('/') && !suffix.startsWith('-') && !slug.endsWith('-')
    slug = slug + (needsSeparator ? '-' : '') + suffix
  }

  return slug
}

/**
 * Get source field value for auto-generation
 * Supports nested paths via dot notation (e.g., 'metadata.title')
 */
export function getSourceValue(source: string | string[], document: Record<string, any>): string {
  if (!source) return ''

  const sources = Array.isArray(source) ? source : [source]

  for (const fieldPath of sources) {
    if (!fieldPath || typeof fieldPath !== 'string') continue
    const value = getNestedValue(document, fieldPath)
    if (value && typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

/**
 * Helper function to get nested object values safely
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined
  if (!path || typeof path !== 'string') return undefined

  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && current[key] !== undefined
      ? current[key]
      : undefined
  }, obj)
}

/**
 * Find all slug fields in a schema that have autoGenerate enabled
 */
export function findAutoGenerateSlugFields(schema: ContentSchema): SlugFieldConfig[] {
  const slugFields: SlugFieldConfig[] = []

  // Validate schema structure
  if (!schema.fields || typeof schema.fields !== 'object') {
    return slugFields
  }

  for (const [fieldName, rawFieldDef] of Object.entries(schema.fields)) {
    // Skip invalid field definitions
    if (!rawFieldDef || typeof rawFieldDef !== 'object') {
      continue
    }

    // Cast to SchemaFieldDefinition to access field properties
    const fieldDef = rawFieldDef as SchemaFieldDefinition

    if (fieldDef.type !== 'slug') {
      continue
    }

    // Safely access options object
    const options = (fieldDef.options && typeof fieldDef.options === 'object')
      ? fieldDef.options as Record<string, unknown>
      : {}

    // Check for source at field level first, then fall back to options
    const source = fieldDef.source || options.source as string | string[] | undefined

    // Default autoGenerate to true unless explicitly set to false
    const autoGenerate = getBooleanOption(fieldDef.autoGenerate, options.autoGenerate, true)

    if (autoGenerate && source) {
      slugFields.push({
        fieldName,
        source,
        autoGenerate: true,
        unique: getBooleanOption(fieldDef.unique, options.unique, true),
        maxLength: getNumberOption(fieldDef.maxLength, options.maxLength, 200),
        minLength: getNumberOption(fieldDef.minLength, options.minLength, 1),
        preserveCase: getBooleanOption(fieldDef.preserveCase, options.preserveCase, false),
        allowedChars: getStringOption(fieldDef.allowedChars, options.allowedChars, ''),
        allowSlashes: getBooleanOption(fieldDef.allowSlashes, options.allowSlashes, true),
        prefix: getStringOption(fieldDef.prefix, options.prefix, ''),
        suffix: getStringOption(fieldDef.suffix, options.suffix, '')
      })
    }
  }

  return slugFields
}

/**
 * Get a document's id, supporting adapters that return `id` and/or `_id`
 */
function getDocId(doc: unknown): string | undefined {
  const record = doc as Record<string, unknown> | null | undefined
  const id = record?.id ?? record?._id
  return typeof id === 'string' ? id : undefined
}

/**
 * Check if a slug is unique within a collection
 *
 * @requires Storage adapter must support filtering by arbitrary fields via listDocuments
 */
async function isSlugUnique(
  core: TrokkyCore,
  collection: string,
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const documents = await core.listDocuments(collection, {
    filter: { slug }
  })

  // Filter out the current document if updating
  const conflictingDocs = excludeId
    ? documents.filter(doc => getDocId(doc) !== excludeId)
    : documents

  return conflictingDocs.length === 0
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Generate a unique slug by appending numbers if conflicts exist
 *
 * Optimized to query all matching slugs once instead of making N+1 queries.
 *
 * @param core - TrokkyCore instance
 * @param collection - Collection name
 * @param baseSlug - Base slug to make unique
 * @param excludeId - Document ID to exclude (for updates)
 * @param maxAttempts - Maximum number of attempts before throwing error
 */
async function generateUniqueSlug(
  core: TrokkyCore,
  collection: string,
  baseSlug: string,
  excludeId?: string,
  maxAttempts: number = 100
): Promise<string> {
  // First check if base slug is available (common case)
  if (await isSlugUnique(core, collection, baseSlug, excludeId)) {
    return baseSlug
  }

  logger.debug('Base slug taken, finding unique variant', { baseSlug, collection })

  // Get all documents in collection to find existing numbered variants
  // This is more efficient than making individual queries for each candidate
  const allDocs = await core.listDocuments(collection, {})

  // Build regex to match baseSlug and baseSlug-N patterns
  const escapedBase = escapeRegExp(baseSlug)
  const pattern = new RegExp(`^${escapedBase}(?:-([0-9]+))?$`)

  // Extract existing numbers from matching slugs
  const existingNumbers = new Set<number>()
  existingNumbers.add(1) // Base slug (no suffix) counts as "1"

  for (const doc of allDocs) {
    if (excludeId && getDocId(doc) === excludeId) continue

    const docSlug = (doc as Record<string, any>).slug
    if (typeof docSlug !== 'string') continue

    const match = docSlug.match(pattern)
    if (match) {
      // If it's baseSlug-N, add N; if it's just baseSlug, add 1
      const num = match[1] ? parseInt(match[1], 10) : 1
      if (!isNaN(num)) {
        existingNumbers.add(num)
      }
    }
  }

  // Find first available number starting from 2
  for (let counter = 2; counter <= maxAttempts + 1; counter++) {
    if (!existingNumbers.has(counter)) {
      const uniqueSlug = `${baseSlug}-${counter}`
      logger.debug('Generated unique slug', { baseSlug, uniqueSlug, counter })
      return uniqueSlug
    }
  }

  throw new Error(`Could not generate unique slug after ${maxAttempts} attempts`)
}

/**
 * Process document data to auto-generate slug fields
 * This should be called before saving a document
 *
 * Note on maxLength: The limit is applied AFTER prefix/suffix are added.
 * E.g., maxLength=20, prefix="blog", slug="hello-world" yields "blog-hello-world" (17 chars)
 *
 * Note on race conditions: If two concurrent requests create documents with the same title,
 * both might get the same slug. For production use, consider adding a unique constraint
 * at the database/storage adapter level.
 */
export async function processSlugFields(
  core: TrokkyCore,
  collection: string,
  data: Record<string, any>,
  existingDocumentId?: string
): Promise<Record<string, any>> {
  const schema = core.getSchema(collection)
  if (!schema) {
    logger.debug('No schema found, skipping slug processing', { collection })
    return data // No schema found, return data as-is
  }

  const slugFields = findAutoGenerateSlugFields(schema)
  if (slugFields.length === 0) {
    return data // No slug fields to process
  }

  logger.debug('Processing slug fields', {
    collection,
    fieldCount: slugFields.length,
    hasExistingId: !!existingDocumentId
  })

  const processedData = { ...data }

  for (const slugField of slugFields) {
    // Validate field name
    if (!slugField.fieldName || typeof slugField.fieldName !== 'string') {
      continue
    }

    const currentValue = processedData[slugField.fieldName]

    // Only auto-generate if the field is empty or not provided
    if (currentValue && typeof currentValue === 'string' && currentValue.trim() !== '') {
      // Slug already provided, skip auto-generation
      // But still check uniqueness if required
      if (slugField.unique) {
        const isUnique = await isSlugUnique(core, collection, currentValue, existingDocumentId)
        if (!isUnique) {
          logger.debug('Provided slug not unique, generating variant', {
            field: slugField.fieldName,
            slug: currentValue
          })
          // Generate unique variant
          processedData[slugField.fieldName] = await generateUniqueSlug(
            core,
            collection,
            currentValue,
            existingDocumentId
          )
        }
      }
      continue
    }

    // Get source value for generation
    const sourceValue = getSourceValue(slugField.source!, processedData)
    if (!sourceValue) {
      logger.debug('No source value available, skipping slug generation', {
        field: slugField.fieldName,
        source: slugField.source
      })
      // No source value available, can't auto-generate
      continue
    }

    // Generate the slug
    const baseSlug = defaultSlugify(sourceValue, {
      preserveCase: slugField.preserveCase,
      allowedChars: slugField.allowedChars,
      allowSlashes: slugField.allowSlashes,
      prefix: slugField.prefix,
      suffix: slugField.suffix
    })

    if (!baseSlug) {
      logger.debug('Slugification resulted in empty string', {
        field: slugField.fieldName,
        sourceValue
      })
      // Slugification resulted in empty string
      continue
    }

    // Apply length limits (after prefix/suffix)
    let finalSlug = baseSlug
    if (slugField.maxLength && finalSlug.length > slugField.maxLength) {
      finalSlug = finalSlug.slice(0, slugField.maxLength).replace(/-+$/, '')
    }

    // Ensure uniqueness if required
    if (slugField.unique) {
      finalSlug = await generateUniqueSlug(core, collection, finalSlug, existingDocumentId)
    }

    logger.debug('Slug generated', {
      field: slugField.fieldName,
      sourceValue,
      slug: finalSlug
    })

    processedData[slugField.fieldName] = finalSlug
  }

  return processedData
}
