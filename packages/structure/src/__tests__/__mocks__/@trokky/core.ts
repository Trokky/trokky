/**
 * Mock @trokky/core for testing
 */

export interface User {
  id: string
  email: string
  role: string
  isActive: boolean
  [key: string]: any
}

export interface ContentSchema {
  name: string
  title?: string
  fields: any[]
  category?: string
  [key: string]: any
}

export class SchemaRegistry {
  private schemas = new Map<string, ContentSchema>()

  constructor(schemas: ContentSchema[] = []) {
    schemas.forEach(schema => this.schemas.set(schema.name, schema))
  }

  getSchema(name: string): ContentSchema | null {
    return this.schemas.get(name) || null
  }

  hasSchema(name: string): boolean {
    return this.schemas.has(name)
  }

  getAllSchemas(): ContentSchema[] {
    return Array.from(this.schemas.values())
  }

  getSchemaNames(): string[] {
    return Array.from(this.schemas.keys())
  }

  registerSchema(schema: ContentSchema): void {
    this.schemas.set(schema.name, schema)
  }

  unregisterSchema(name: string): boolean {
    return this.schemas.delete(name)
  }
}

// Export other commonly used types and classes
export const mockUser: User = {
  id: 'test-user',
  email: 'test@example.com',
  role: 'editor',
  isActive: true
}

export const mockSchema: ContentSchema = {
  name: 'testDocument',
  title: 'Test Document',
  fields: []
}