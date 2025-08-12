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
      // Automatically inject slug field for document schemas (if not already present)
      const processedSchema = this.injectAutoSlugField(schema)
      
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
      console.log(`📋 Schema "${schema.name}": Slug field already exists, skipping auto-injection`)
      return schema
    }

    // Find a suitable source field for slug generation
    const sourceField = this.findSlugSourceField(schema)
    
    // Only inject if we have a source field
    if (!sourceField) {
      console.log(`📋 Schema "${schema.name}": No suitable source field found for slug generation, skipping`)
      return schema
    }

    console.log(`📋 Schema "${schema.name}": Auto-injecting slug field with source "${sourceField}"`)

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
      if (fieldDef.type === 'string') {
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