import { ContentSchema, ContentSchemaSchema } from '../types/index'

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
      const validatedSchema = ContentSchemaSchema.parse(schema)
      this.schemas.set(validatedSchema.name, validatedSchema)
    } catch (error) {
      throw new Error(`Invalid schema "${schema.name}": ${error}`)
    }
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