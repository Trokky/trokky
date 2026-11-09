import { ContentSchema, ContentSchemaSchema, TrokkyConfig } from '../types/index.js'
import { isSingletonSchema } from './singleton.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('core', 'SchemaRegistry')

/** Top-level schema keys the server keeps. Anything else is dropped when the schema is parsed. */
const SCHEMA_KEYS = ['name', 'type', 'title', 'description', 'singleton', 'fields']

/** Near misses worth naming outright, beyond what spelling distance finds. */
const SCHEMA_KEY_HINTS: Record<string, string> = {
  issingleton: 'singleton',
  label: 'title',
  displayname: 'title',
  field: 'fields',
  properties: 'fields',
}

/** The field types the Studio registers (packages/studio/src/fields/builtin.ts). */
export const BUILTIN_FIELD_TYPES = [
  'string', 'text', 'email', 'url', 'password', 'slug', 'number', 'boolean', 'date',
  'richtext', 'portable', 'media', 'image', 'video', 'audio', 'document', 'reference',
  'array', 'object', 'color', 'icon', 'geoCoordinate', 'info',
]

export class SchemaRegistry {
  private schemas: Map<string, ContentSchema> = new Map()
  private config: TrokkyConfig['features']

  constructor(schemas: ContentSchema[] | string, config?: TrokkyConfig['features']) {
    this.config = config || {}
    
    if (Array.isArray(schemas)) {
      this.loadSchemas(schemas)
    } else {
      // TODO: Implement dynamic schema loading from file pattern
      throw new Error('File-based schema loading not yet implemented')
    }
  }

  private loadSchemas(schemas: ContentSchema[]): void {
    for (const schema of schemas) {
      this.validateAndRegisterSchema(schema)
    }
  }

  private validateAndRegisterSchema(schema: ContentSchema): void {
    const problems = findSchemaProblems(schema, this.config?.customFieldTypes ?? [])
    if (problems.length > 0) {
      if (this.config?.strictSchemas) {
        throw new Error(`Invalid schema "${schema.name}" (strictSchemas):\n- ${problems.join('\n- ')}`)
      }
      for (const problem of problems) {
        logger.warn(`Schema "${schema.name}": ${problem}`)
      }
    }

    try {
      // Automatically inject auto-fields for document schemas based on configuration
      let processedSchema = this.injectAutoSlugField(normalizeSchemaFields(schema))
      processedSchema = this.injectAutoThumbnailField(processedSchema)
      
      const validatedSchema = ContentSchemaSchema.parse(processedSchema)
      this.schemas.set(validatedSchema.name, validatedSchema)
    } catch (error) {
      throw new Error(`Invalid schema "${schema.name}": ${error}`)
    }
  }

  /**
   * Automatically injects a slug field for document schemas if:
   * 1. It's a document type (not singleton necessarily, but typically)
   * 2. No slug field is already defined
   * 3. There's a 'title' field to generate from (or fallback to the first string field)
   */
  private injectAutoSlugField(schema: ContentSchema): ContentSchema {
    // Skip if slug field already exists
    if (schema.fields.slug) {
      return schema
    }

    // Find a suitable source field for slug generation
    const sourceField = this.findSlugSourceField(schema)
    
    // Only inject if we have a source field
    if (!sourceField) {
      return schema
    }

    // Create a copy of the schema with the injected slug field
    // Insert slug field right after the source field for better UX
    const newFields: Record<string, any> = {}
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      newFields[fieldName] = fieldDef
      
      // Insert slug field right after the source field
      if (fieldName === sourceField) {
        newFields.slug = {
          type: 'slug',
          // Use i18n: prefix to indicate this should be translated on the frontend
          title: 'i18n:autoFields.slug.title',
          description: 'i18n:autoFields.slug.description',
          source: sourceField,
          autoGenerate: true,
          unique: true,
          required: false // Auto-generated, so not strictly required from user
        }
      }
    }

    return {
      ...schema,
      fields: newFields
    }
  }

  /**
   * Automatically injects a thumbnail field for document schemas if:
   * 1. Feature is enabled in configuration (default: true)
   * 2. It's a document type (or singleton if configured to include them)
   * 3. No thumbnail/featured image field is already defined
   * 4. Schema is not in the skip list
   */
  private injectAutoThumbnailField(schema: ContentSchema): ContentSchema {
    const autoThumbnailConfig = this.config?.autoThumbnail || {}

    // Check if feature is enabled (default: true)
    if (autoThumbnailConfig.enabled === false) {
      return schema
    }

    // Check if schema is in skip list
    if (autoThumbnailConfig.skipSchemas?.includes(schema.name)) {
      return schema
    }

    // Skip singletons if configured to do so (default: true)
    const skipSingletons = autoThumbnailConfig.skipSingletons !== false
    if (skipSingletons && isSingletonSchema(schema)) {
      return schema
    }

    // Get field name from config (default: '_thumbnail')
    const fieldName = autoThumbnailConfig.fieldName || '_thumbnail'
    
    // Skip if thumbnail field already exists (check configured name and common variations)
    if (schema.fields[fieldName] || 
        schema.fields._thumbnail || 
        schema.fields.thumbnail || 
        schema.fields.featuredImage || 
        schema.fields.featured_image ||
        schema.fields.image) {
      return schema
    }

    // Get configuration values with defaults
    const maxFileSize = autoThumbnailConfig.maxFileSize || 10 * 1024 * 1024 // 10MB
    const allowedTypes = autoThumbnailConfig.allowedTypes || [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ]

    // Create a copy of the schema with the injected thumbnail field
    // Insert thumbnail field at the beginning for better UX (after title/name if present)
    const newFields: Record<string, any> = {}
    let thumbnailInserted = false
    
    for (const [fieldKey, fieldDef] of Object.entries(schema.fields)) {
      newFields[fieldKey] = fieldDef
      
      // Insert thumbnail field after title, name, or slug field for better UX
      if (!thumbnailInserted && (fieldKey === 'title' || fieldKey === 'name' || fieldKey === 'slug')) {
        newFields[fieldName] = {
          type: 'media',
          // Use i18n: prefix to indicate this should be translated on the frontend
          title: 'i18n:autoFields._thumbnail.title',
          description: 'i18n:autoFields._thumbnail.description',
          required: false,
          options: {
            // Enable upload/browse functionality
            enableUpload: true,
            enableBrowse: true,
            enableDragDrop: true,
            // Media type and validation
            showVariantSelector: true,
            showMetadata: true,
            showPreview: true,
            requireAlt: true
          },
          validation: {
            allowedTypes,
            maxFileSize,
            restrictToMediaType: 'image'
          }
        }
        thumbnailInserted = true
      }
    }

    // If we haven't inserted it yet, add it at the beginning
    if (!thumbnailInserted) {
      const fieldsWithThumbnail: Record<string, any> = {
        [fieldName]: {
          type: 'media',
          // Use i18n: prefix to indicate this should be translated on the frontend
          title: 'i18n:autoFields._thumbnail.title',
          description: 'i18n:autoFields._thumbnail.description',
          required: false,
          options: {
            // Enable upload/browse functionality
            enableUpload: true,
            enableBrowse: true,
            enableDragDrop: true,
            // Media type and validation
            showVariantSelector: true,
            showMetadata: true,
            showPreview: true,
            requireAlt: true
          },
          validation: {
            allowedTypes,
            maxFileSize,
            restrictToMediaType: 'image'
          }
        },
        ...newFields
      }
      return {
        ...schema,
        fields: fieldsWithThumbnail
      }
    }

    return {
      ...schema,
      fields: newFields
    }
  }

  /**
   * Find the best field to use as slug source
   * Priority: 'title' > 'name' > first string field
   */
  private findSlugSourceField(schema: ContentSchema): string | null {
    const fields = schema.fields

    // Priority 1: 'title' field
    if (fields.title && fields.title.type === 'string') {
      return 'title'
    }

    // Priority 2: 'name' field  
    if (fields.name && fields.name.type === 'string') {
      return 'name'
    }

    // Priority 3: First string field
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if ((fieldDef as any).type === 'string') {
        return fieldName
      }
    }

    return null
  }

  public getSchema(name: string): ContentSchema | null {
    return this.schemas.get(name) || null
  }

  public hasSchema(name: string): boolean {
    return this.schemas.has(name)
  }

  public getAllSchemas(): ContentSchema[] {
    return Array.from(this.schemas.values())
  }

  public getSchemaNames(): string[] {
    return Array.from(this.schemas.keys())
  }

  public registerSchema(schema: ContentSchema): void {
    this.validateAndRegisterSchema(schema)
  }

  public unregisterSchema(name: string): boolean {
    return this.schemas.delete(name)
  }
}

/**
 * Accept the array form of `fields` ([{ name, type, ... }]) at the top level of
 * a schema and convert it to the record form keyed by field name that the
 * engine, validator and route handlers iterate over. Record form passes through.
 */
export function normalizeSchemaFields(schema: ContentSchema): ContentSchema {
  const fields = (schema as { fields?: unknown }).fields
  if (!Array.isArray(fields)) {
    return schema
  }
  const record: Record<string, unknown> = {}
  for (const entry of fields as Array<Record<string, unknown>>) {
    const { name, ...rest } = entry
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Schema "${schema.name}": every field in array form needs a non-empty "name"`)
    }
    if (name in record) {
      throw new Error(`Schema "${schema.name}": duplicate field "${name}"`)
    }
    record[name] = rest
  }
  return { ...schema, fields: record } as ContentSchema
}

/**
 * Mistakes the schema parser lets through without a word: a top-level key it drops, and a field
 * type nothing on the server or in the Studio knows (no validation, no editor). Each entry is a
 * sentence naming the key or field, with a suggestion when one is close.
 */
export function findSchemaProblems(schema: ContentSchema, customFieldTypes: string[] = []): string[] {
  const problems: string[] = []

  for (const key of Object.keys(schema as object)) {
    if (SCHEMA_KEYS.includes(key)) continue
    const hint = SCHEMA_KEY_HINTS[key.toLowerCase()] ?? closest(key, SCHEMA_KEYS)
    problems.push(
      `unknown key "${key}" is ignored${hint ? ` (did you mean "${hint}"?)` : ''}. ` +
        `A schema keeps only ${SCHEMA_KEYS.join(', ')}.`
    )
  }

  const knownTypes = [...BUILTIN_FIELD_TYPES, ...customFieldTypes]
  const visit = (fields: unknown, path: string): void => {
    const entries = Array.isArray(fields)
      ? fields.map((field) => [(field as { name?: string })?.name ?? '?', field] as const)
      : fields && typeof fields === 'object'
        ? Object.entries(fields)
        : []
    for (const [name, field] of entries) {
      if (!field || typeof field !== 'object') continue
      const fieldPath = path ? `${path}.${name}` : name
      const type = (field as { type?: unknown }).type
      if (typeof type === 'string' && !knownTypes.includes(type)) {
        const hint = closest(type, knownTypes)
        problems.push(
          `field "${fieldPath}" has type "${type}", which is not a built-in field type` +
            `${hint ? ` (did you mean "${hint}"?)` : ''}. The server does not validate it and the ` +
            'Studio has no editor for it. If it is a custom Studio field, list it in features.customFieldTypes.'
        )
      }
      visit((field as { fields?: unknown }).fields, fieldPath)
      const of = (field as { of?: unknown }).of
      if (of && typeof of === 'object') {
        visit(Array.isArray(of) ? of : { '[]': of }, fieldPath)
      }
    }
  }
  visit((schema as { fields?: unknown }).fields, '')

  return problems
}

/**
 * The candidate within two edits of `value` (case-insensitive), when there is exactly one best
 * and the edits are less than half the word: `file` is two edits from `date`, but not a typo of it.
 */
function closest(value: string, candidates: string[]): string | undefined {
  let best: string | undefined
  let bestDistance = Infinity
  let tied = false
  for (const candidate of candidates) {
    const distance = editDistance(value.toLowerCase(), candidate.toLowerCase())
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
      tied = false
    } else if (distance === bestDistance) {
      tied = true
    }
  }
  if (tied || bestDistance > 2 || bestDistance * 2 >= value.length) return undefined
  return best
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}
