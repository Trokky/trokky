import { ContentSchema, ContentSchemaSchema, TrokkyConfig } from '../types/index.js'

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
    try {
      // Automatically inject auto-fields for document schemas based on configuration
      let processedSchema = this.injectAutoSlugField(schema)
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
    if (skipSingletons && schema.singleton === true) {
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