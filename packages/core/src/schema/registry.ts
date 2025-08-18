import { ContentSchema, ContentSchemaSchema } from '../types/index.js'

export class SchemaRegistry {
  private schemas: Map<string, ContentSchema> = new Map()

  constructor(schemas: ContentSchema[] | string) {
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
      // Automatically inject auto-fields for document schemas
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
   * 1. It's a document type
   * 2. No thumbnail/featured image field is already defined
   */
  private injectAutoThumbnailField(schema: ContentSchema): ContentSchema {
    // Skip if thumbnail field already exists (various naming conventions)
    if (schema.fields._thumbnail || 
        schema.fields.thumbnail || 
        schema.fields.featuredImage || 
        schema.fields.featured_image ||
        schema.fields.image) {
      return schema
    }

    // Only inject for document types (not singletons typically)
    if (schema.type === 'singleton') {
      return schema
    }

    // Create a copy of the schema with the injected thumbnail field
    // Insert thumbnail field at the beginning for better UX (after title/name if present)
    const newFields: Record<string, any> = {}
    let thumbnailInserted = false
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      newFields[fieldName] = fieldDef
      
      // Insert thumbnail field after title, name, or slug field for better UX
      if (!thumbnailInserted && (fieldName === 'title' || fieldName === 'name' || fieldName === 'slug')) {
        newFields._thumbnail = {
          type: 'media',
          title: 'Featured Image',
          description: 'Main image representing this content',
          required: false,
          mediaType: 'image',
          options: {
            showVariantSelector: true,
            uploadSettings: {
              maxFileSize: 10 * 1024 * 1024, // 10MB
              allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            }
          }
        }
        thumbnailInserted = true
      }
    }

    // If we haven't inserted it yet, add it at the beginning
    if (!thumbnailInserted) {
      const fieldsWithThumbnail: Record<string, any> = {
        _thumbnail: {
          type: 'media',
          title: 'Featured Image', 
          description: 'Main image representing this content',
          required: false,
          mediaType: 'image',
          options: {
            showVariantSelector: true,
            uploadSettings: {
              maxFileSize: 10 * 1024 * 1024, // 10MB
              allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            }
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