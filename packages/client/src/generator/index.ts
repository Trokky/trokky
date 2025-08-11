/**
 * TypeScript Type Generator
 * Generates TypeScript types from Trokky schema definitions
 */

import type { TypeGeneratorOptions } from '../types/index.js'

export interface FieldSchema {
  type: string
  name: string
  title?: string
  description?: string
  required?: boolean
  validation?: Record<string, any>
  options?: Record<string, any>
  // New field format properties
  fields?: FieldSchema[] // for object fields
  of?: FieldSchema // for array fields
  to?: string // for reference fields
}

export interface DocumentSchema {
  name: string
  title?: string
  description?: string
  fields: FieldSchema[]
}

export interface ProjectSchema {
  name: string
  version: string
  documents: DocumentSchema[]
}

export class TypeGenerator {
  private options: Required<Omit<TypeGeneratorOptions, 'authToken' | 'username' | 'password'>> & Pick<TypeGeneratorOptions, 'authToken' | 'username' | 'password'>

  constructor(options: TypeGeneratorOptions) {
    this.options = {
      outputDir: options.outputDir,
      schemaUrl: options.schemaUrl,
      namespace: options.namespace || 'Trokky',
      fileExtension: options.fileExtension || 'ts',
      includeValidation: options.includeValidation ?? true,
      authToken: options.authToken,
      username: options.username,
      password: options.password
    }
  }

  /**
   * Generate TypeScript types from schema URL
   */
  async generateFromUrl(): Promise<void> {
    const schema = await this.fetchSchema()
    await this.generateTypes(schema)
  }

  /**
   * Generate TypeScript types from schema object
   */
  async generateFromSchema(schema: ProjectSchema): Promise<void> {
    await this.generateTypes(schema)
  }

  /**
   * Fetch schema from remote URL
   */
  private async fetchSchema(): Promise<ProjectSchema> {
    try {
      // For Trokky API, we need to fetch from /api/collections and transform the response
      const apiUrl = this.options.schemaUrl.replace('/api/schemas', '/api/collections')
      
      // Handle authentication
      let authToken = this.options.authToken
      
      // If no token but username/password provided, login first
      if (!authToken && this.options.username && this.options.password) {
        const loginUrl = apiUrl.replace('/api/collections', '/api/auth/login')
        const loginResponse = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            credentials: {
              username: this.options.username,
              password: this.options.password
            }
          })
        })
        
        if (!loginResponse.ok) {
          throw new Error(`Authentication failed: ${loginResponse.status} ${loginResponse.statusText}`)
        }
        
        const loginData = await loginResponse.json() as any
        if (loginData.success && loginData.data?.token) {
          authToken = loginData.data.token
        } else {
          throw new Error('Authentication failed: No token received')
        }
      }
      
      // Prepare headers
      const headers: Record<string, string> = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }
      
      const response = await fetch(apiUrl, { headers })
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json() as any
      
      // Transform Trokky API response to ProjectSchema format
      if (data.success && data.data && data.data.collections) {
        const collections = data.data.collections
        
        return {
          name: 'TrokkyProject',
          version: '1.0.0',
          documents: collections.map((collection: any) => ({
            name: collection.name,
            title: collection.title || collection.name,
            description: collection.description,
            fields: this.transformFields(collection.fields || {})
          }))
        }
      }
      
      // Fallback: try to parse as direct ProjectSchema format
      return data as ProjectSchema
    } catch (error) {
      throw new Error(`Failed to fetch schema from ${this.options.schemaUrl}: ${error}`)
    }
  }

  /**
   * Transform Trokky field format to generator field format
   */
  private transformFields(fields: Record<string, any> | any[]): FieldSchema[] {
    // Handle array format (nested fields in objects/arrays)
    if (Array.isArray(fields)) {
      return fields.map(field => ({
        name: field.name,
        type: field.type,
        title: field.title,
        description: field.description,
        required: field.required,
        validation: field.validation,
        options: field.options,
        // Handle new field formats
        fields: field.fields ? this.transformFields(field.fields) : undefined,
        of: field.of ? this.transformSingleField(field.of) : undefined,
        to: field.to
      }))
    }
    
    // Handle object format (top-level fields)
    return Object.entries(fields).map(([name, field]) => ({
      name,
      type: field.type,
      title: field.title,
      description: field.description,
      required: field.required,
      validation: field.validation,
      options: field.options,
      // Handle new field formats
      fields: field.fields ? this.transformFields(field.fields) : undefined,
      of: field.of ? this.transformSingleField(field.of) : undefined,
      to: field.to
    }))
  }

  /**
   * Transform a single field (used for array 'of' property)
   */
  private transformSingleField(field: any): FieldSchema {
    return {
      name: field.name || 'item', // fallback name for array items
      type: field.type,
      title: field.title,
      description: field.description,
      required: field.required,
      validation: field.validation,
      options: field.options,
      // Handle new field formats
      fields: field.fields ? this.transformFields(field.fields) : undefined,
      of: field.of ? this.transformSingleField(field.of) : undefined,
      to: field.to
    }
  }

  /**
   * Generate TypeScript types from schema
   */
  private async generateTypes(schema: ProjectSchema): Promise<void> {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true })

    // Generate document types
    for (const document of schema.documents) {
      const typeContent = this.generateDocumentType(document)
      const filename = `${this.camelToKebab(document.name)}.${this.options.fileExtension}`
      const filepath = path.join(this.options.outputDir, filename)
      
      await fs.writeFile(filepath, typeContent, 'utf8')
    }

    // Generate index file
    const indexContent = this.generateIndex(schema.documents)
    const indexFilepath = path.join(this.options.outputDir, `index.${this.options.fileExtension}`)
    await fs.writeFile(indexFilepath, indexContent, 'utf8')

    console.log(`Generated TypeScript types for ${schema.documents.length} documents in ${this.options.outputDir}`)
  }

  /**
   * Generate TypeScript interface for a document
   */
  private generateDocumentType(document: DocumentSchema): string {
    const imports = ['BaseDocument']
    const interfaceName = `${document.name}Document`
    
    let content = `/**\n * ${document.title || document.name}\n`
    if (document.description) {
      content += ` * ${document.description}\n`
    }
    content += ` * Generated from Trokky schema\n */\n\n`

    // Add imports
    content += `import type { ${imports.join(', ')} } from '@trokky/client'\n\n`

    // Generate field interfaces if needed
    const complexFields = document.fields.filter(field => 
      field.type === 'object' || field.type === 'array' || field.type === 'reference'
    )

    for (const field of complexFields) {
      content += this.generateFieldInterface(field, document.name)
      content += '\n\n'
    }

    // Generate main document interface
    content += `export interface ${interfaceName} extends BaseDocument {\n`
    content += `  _type: '${document.name}'\n`

    for (const field of document.fields) {
      const fieldType = this.mapFieldType(field, document.name)
      const optional = field.required ? '' : '?'
      
      content += `  ${field.name}${optional}: ${fieldType}\n`
    }

    content += '}\n'

    // Generate validation schema if requested
    if (this.options.includeValidation) {
      content += '\n'
      content += this.generateValidationSchema(document)
    }

    return content
  }

  /**
   * Generate TypeScript interface for complex field types
   */
  private generateFieldInterface(field: FieldSchema, documentName: string): string {
    const interfaceName = `${documentName}${this.capitalize(field.name)}`
    
    let content = `export interface ${interfaceName} {\n`
    
    if (field.type === 'object') {
      // Updated to handle new object format: field.fields instead of field.options?.fields
      const objectFields = (field as any).fields || field.options?.fields
      if (objectFields) {
        for (const subField of objectFields) {
          const fieldType = this.mapFieldType(subField, documentName)
          const optional = subField.required ? '' : '?'
          content += `  ${subField.name}${optional}: ${fieldType}\n`
        }
      }
    } else if (field.type === 'reference') {
      content += `  _ref: string\n`
      // Updated to handle new reference format: field.to instead of field.options?.to
      const refType = (field as any).to || field.options?.to || 'reference'
      content += `  _type: '${refType}'\n`
    }
    
    content += '}'
    return content
  }

  /**
   * Map field type to TypeScript type
   */
  private mapFieldType(field: FieldSchema, documentName: string): string {
    switch (field.type) {
      case 'string':
      case 'text':
      case 'slug':
      case 'email':
      case 'url':
        return 'string'
      
      case 'number':
        return 'number'
      
      case 'boolean':
        return 'boolean'
      
      case 'date':
      case 'datetime':
        return 'string | Date'
      
      case 'array':
        // Support both legacy format (items) and new format (of)
        const arrayItemDef = (field as any).of || (field as any).items
        const itemType = arrayItemDef ? this.mapFieldType(arrayItemDef, documentName) : 'any'
        return `${itemType}[]`
      
      case 'object':
        return `${documentName}${this.capitalize(field.name)}`
      
      case 'reference':
        // Updated to handle new reference format: field.to instead of field.options?.to
        const refType = (field as any).to || field.options?.to || 'any'
        return `string | ${refType}Document`
      
      case 'image':
      case 'file':
        return 'string | { _ref: string; url?: string; metadata?: Record<string, any> }'
      
      case 'portableText':
        return 'any[] // Portable Text blocks'
      
      case 'richText':
        return 'any[] // Rich text blocks'
      
      default:
        return 'any'
    }
  }

  /**
   * Generate validation schema
   */
  private generateValidationSchema(document: DocumentSchema): string {
    const schemaName = `${document.name}ValidationSchema`
    
    let content = `export const ${schemaName} = {\n`
    content += `  type: '${document.name}',\n`
    content += `  fields: {\n`

    for (const field of document.fields) {
      content += `    ${field.name}: {\n`
      content += `      type: '${field.type}',\n`
      
      if (field.required) {
        content += `      required: true,\n`
      }
      
      if (field.validation) {
        for (const [key, value] of Object.entries(field.validation)) {
          content += `      ${key}: ${JSON.stringify(value)},\n`
        }
      }
      
      content += `    },\n`
    }

    content += '  }\n'
    content += '}'

    return content
  }

  /**
   * Generate index file
   */
  private generateIndex(documents: DocumentSchema[]): string {
    let content = `/**\n * Generated TypeScript types for Trokky CMS\n * Auto-generated - do not edit manually\n */\n\n`

    // Export document types
    for (const document of documents) {
      const filename = this.camelToKebab(document.name)
      content += `export * from './${filename}'\n`
    }

    // Export utility types
    content += '\n// Utility types\n'
    content += 'export type DocumentTypes = \n'
    content += documents.map(doc => `  | '${doc.name}'`).join('\n')
    content += '\n\n'

    content += 'export type AllDocuments = \n'
    content += documents.map(doc => `  | ${doc.name}Document`).join('\n')
    content += '\n'

    return content
  }

  /**
   * Utility functions
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  }
}

/**
 * CLI function for generating types
 */
export async function generateTypes(options: TypeGeneratorOptions): Promise<void> {
  const generator = new TypeGenerator(options)
  await generator.generateFromUrl()
}

/**
 * Generate types from schema object
 */
export async function generateTypesFromSchema(
  schema: ProjectSchema, 
  options: Omit<TypeGeneratorOptions, 'schemaUrl'>
): Promise<void> {
  const generator = new TypeGenerator({
    ...options,
    schemaUrl: '' // Not used when generating from schema object
  })
  await generator.generateFromSchema(schema)
}

// Document generation exports (development only)
export { DocumentGenerator, generateDocuments } from './document-generator.js'