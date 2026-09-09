/**
 * Document Generator with Faker.js Integration
 * Generates realistic test documents based on Trokky schemas
 */

// faker is loaded on demand rather than imported at module load. It is a ~29 MB test-data
// library, and making it a runtime dependency meant every site that installs this SDK merely
// to read content downloaded it too. It is now a devDependency: projects that use
// DocumentGenerator install it themselves, and everyone else pays nothing.
type FakerApi = (typeof import('@faker-js/faker'))['faker']

let faker: FakerApi

async function ensureFaker(): Promise<void> {
  if (faker) return
  try {
    ;({ faker } = await import('@faker-js/faker'))
  } catch {
    throw new Error(
      'DocumentGenerator requires @faker-js/faker, which is not installed. It is an optional ' +
        'peer of @trokky/client so that reading content does not pull in a test-data library. ' +
        'Install it with: npm install -D @faker-js/faker'
    )
  }
}
import type { 
  DocumentGeneratorOptions, 
  DocumentSchema, 
  FieldSchema,
  BaseDocument 
} from '../types/index.js'

export class DocumentGenerator {
  private options: Required<DocumentGeneratorOptions>
  private schemas: DocumentSchema[] = []
  private generatedDocuments: Record<string, BaseDocument[]> = {}

  constructor(options: DocumentGeneratorOptions) {
    this.options = {
      schemaUrl: options.schemaUrl || '',
      schemas: options.schemas || [],
      count: options.count || 10,
      locale: options.locale || 'en',
      seed: options.seed || Math.floor(Math.random() * 10000),
      format: options.format || 'json',
      outputDir: options.outputDir || './generated',
      fieldOverrides: options.fieldOverrides || {},
      generateReferences: options.generateReferences ?? true,
      existingDocuments: options.existingDocuments || {}
    }

    // The seed is applied in generateDocuments, once faker has been loaded.
  }

  /**
   * Generate documents from schema URL
   */
  async generateFromUrl(): Promise<Record<string, BaseDocument[]>> {
    const schemas = await this.fetchSchemas()
    return this.generateDocuments(schemas)
  }

  /**
   * Generate documents from provided schemas
   */
  async generateFromSchemas(schemas: DocumentSchema[]): Promise<Record<string, BaseDocument[]>> {
    return this.generateDocuments(schemas)
  }

  /**
   * Generate documents for all schemas
   */
  private async generateDocuments(schemas: DocumentSchema[]): Promise<Record<string, BaseDocument[]>> {
    await ensureFaker()
    // Seeded here rather than in the constructor so that the same input still produces the
    // same output, now that faker is not available until this point.
    faker.seed(this.options.seed)

    this.schemas = schemas
    this.generatedDocuments = {}

    // First pass: Generate documents without references
    for (const schema of schemas) {
      this.generatedDocuments[schema.name] = []
      
      for (let i = 0; i < this.options.count; i++) {
        const document = this.generateDocument(schema, false)
        this.generatedDocuments[schema.name].push(document)
      }
    }

    // Second pass: Fill in references if enabled
    if (this.options.generateReferences) {
      for (const schema of schemas) {
        for (const document of this.generatedDocuments[schema.name]) {
          this.fillReferences(document, schema)
        }
      }
    }

    // Write to files if outputDir is specified
    if (this.options.outputDir) {
      await this.writeToFiles()
    }

    return this.generatedDocuments
  }

  /**
   * Generate a single document based on schema
   */
  private generateDocument(schema: DocumentSchema, includeReferences = true): BaseDocument {
    const document: BaseDocument = {
      _id: this.generateId(),
      _type: schema.name,
      _createdAt: faker.date.past().toISOString(),
      _updatedAt: faker.date.recent().toISOString(),
      _version: 1
    }

    // Generate field values
    for (const field of schema.fields) {
      if (field.type === 'reference' && !includeReferences) {
        continue // Skip references in first pass
      }

      document[field.name] = this.generateFieldValue(field, schema.name)
    }

    return document
  }

  /**
   * Generate value for a specific field
   */
  private generateFieldValue(field: FieldSchema, schemaName: string): any {
    // Check for custom field override
    if (this.options.fieldOverrides[field.name]) {
      return this.options.fieldOverrides[field.name](faker, field)
    }

    // Handle required vs optional fields
    if (!field.required && faker.datatype.boolean(0.8)) {
      // 20% chance to leave optional fields empty
      return null
    }

    switch (field.type) {
      case 'string':
        return this.generateStringValue(field)
      
      case 'slug':
        return this.generateSlugValue(field)
      
      case 'email':
        return faker.internet.email()
      
      case 'url':
        return faker.internet.url()
      
      case 'number':
        return this.generateNumberValue(field)
      
      case 'boolean':
        return faker.datatype.boolean()
      
      case 'date':
      case 'datetime':
        return faker.date.past().toISOString()
      
      case 'array':
        return this.generateArrayValue(field, schemaName)
      
      case 'object':
        return this.generateObjectValue(field, schemaName)
      
      case 'reference':
        return this.generateReferenceValue(field)
      
      case 'media':
      case 'image':
        return this.generateMediaValue(field)
      
      case 'portableText':
      case 'richText':
        return this.generateRichTextValue()
      
      default:
        return faker.lorem.words(3)
    }
  }

  private generateStringValue(field: FieldSchema): string {
    const validation = field.validation || {}
    const maxLength = validation.maxLength || 100
    const minLength = validation.minLength || 5

    // Generate different types of string content based on field name
    const fieldName = field.name.toLowerCase()
    
    if (fieldName.includes('title') || fieldName.includes('name')) {
      return faker.lorem.words(faker.number.int({ min: 1, max: 4 }))
    }
    
    if (fieldName.includes('description') || fieldName.includes('content')) {
      return faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }))
    }
    
    if (fieldName.includes('phone')) {
      return faker.phone.number()
    }
    
    if (fieldName.includes('address')) {
      return faker.location.streetAddress()
    }

    // Default string generation
    const length = faker.number.int({ min: minLength, max: Math.min(maxLength, 200) })
    return faker.lorem.sentence(Math.ceil(length / 8))
  }

  private generateSlugValue(field: FieldSchema): string {
    const prefix = field.prefix || ''
    const suffix = field.suffix || ''
    
    let slug = faker.lorem.slug(faker.number.int({ min: 2, max: 4 }))
    
    if (prefix) {
      slug = `${prefix}-${slug}`
    }
    
    if (suffix) {
      slug = `${slug}-${suffix}`
    }
    
    return slug
  }

  private generateNumberValue(field: FieldSchema): number {
    const validation = field.validation || {}
    const min = validation.min || 0
    const max = validation.max || 1000
    
    return faker.number.int({ min, max })
  }

  private generateArrayValue(field: FieldSchema, schemaName: string): any[] {
    const itemType = field.options?.of
    if (!itemType) return []

    const length = faker.number.int({ min: 1, max: 5 })
    const items = []

    for (let i = 0; i < length; i++) {
      if (typeof itemType === 'object') {
        items.push(this.generateFieldValue(itemType, schemaName))
      } else {
        // Simple array types
        items.push(this.generateFieldValue({ type: itemType, name: 'item' } as FieldSchema, schemaName))
      }
    }

    return items
  }

  private generateObjectValue(field: FieldSchema, schemaName: string): Record<string, any> {
    const subFields = field.options?.fields || []
    const obj: Record<string, any> = {}

    for (const subField of subFields) {
      obj[subField.name] = this.generateFieldValue(subField, schemaName)
    }

    return obj
  }

  private generateReferenceValue(field: FieldSchema): string | null {
    const referenceTo = field.options?.to
    if (!referenceTo) return null

    // Use existing documents if provided
    const existingIds = this.options.existingDocuments[referenceTo]
    if (existingIds && existingIds.length > 0) {
      return faker.helpers.arrayElement(existingIds)
    }

    // Use generated documents
    const generatedDocs = this.generatedDocuments[referenceTo]
    if (generatedDocs && generatedDocs.length > 0) {
      return faker.helpers.arrayElement(generatedDocs)._id!
    }

    // Generate a fake ID
    return this.generateId()
  }

  private generateMediaValue(field: FieldSchema): any {
    return {
      _type: 'media',
      asset: {
        _ref: this.generateId(),
        _type: 'mediaAsset'
      },
      alt: faker.lorem.sentence(),
      title: faker.lorem.words(3),
      url: faker.image.url({ width: 800, height: 600 }),
      filename: faker.system.fileName(),
      size: faker.number.int({ min: 1000, max: 10000000 }),
      mimeType: faker.helpers.arrayElement(['image/jpeg', 'image/png', 'image/webp'])
    }
  }

  private generateRichTextValue(): any[] {
    const blocks = []
    const numBlocks = faker.number.int({ min: 1, max: 3 })

    for (let i = 0; i < numBlocks; i++) {
      blocks.push({
        _key: this.generateId(),
        _type: 'block',
        style: faker.helpers.arrayElement(['normal', 'h1', 'h2', 'h3']),
        children: [
          {
            _key: this.generateId(),
            _type: 'span',
            text: faker.lorem.paragraph(),
            marks: []
          }
        ]
      })
    }

    return blocks
  }

  private fillReferences(document: BaseDocument, schema: DocumentSchema): void {
    for (const field of schema.fields) {
      if (field.type === 'reference' && !document[field.name]) {
        document[field.name] = this.generateReferenceValue(field)
      }
    }
  }

  private generateId(): string {
    return `doc-${faker.string.uuid()}`
  }

  private async fetchSchemas(): Promise<DocumentSchema[]> {
    if (!this.options.schemaUrl) {
      throw new Error('Schema URL is required when not providing schemas directly')
    }

    const response = await fetch(this.options.schemaUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch schemas: ${response.statusText}`)
    }

    const data = await response.json() as any
    return data.documents || data.schemas || []
  }

  private async writeToFiles(): Promise<void> {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true })

    for (const [schemaName, documents] of Object.entries(this.generatedDocuments)) {
      if (this.options.format === 'json' || this.options.format === 'both') {
        const jsonPath = path.join(this.options.outputDir, `${schemaName}.json`)
        await fs.writeFile(jsonPath, JSON.stringify(documents, null, 2))
      }

      if (this.options.format === 'typescript' || this.options.format === 'both') {
        const tsPath = path.join(this.options.outputDir, `${schemaName}.ts`)
        const tsContent = this.generateTypeScriptFile(schemaName, documents)
        await fs.writeFile(tsPath, tsContent)
      }
    }

    console.log(`Generated ${Object.keys(this.generatedDocuments).length} document collections in ${this.options.outputDir}`)
  }

  private generateTypeScriptFile(schemaName: string, documents: BaseDocument[]): string {
    const interfaceName = `${this.capitalize(schemaName)}Document`
    
    let content = `/**\n * Generated test documents for ${schemaName}\n * Auto-generated with @faker-js/faker\n */\n\n`
    content += `import type { ${interfaceName} } from '../types/index.js'\n\n`
    content += `export const ${schemaName}TestData: ${interfaceName}[] = `
    content += JSON.stringify(documents, null, 2)
    content += ' as const\n\n'
    content += `export default ${schemaName}TestData\n`

    return content
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

/**
 * Convenience function to generate documents
 */
export async function generateDocuments(options: DocumentGeneratorOptions): Promise<Record<string, BaseDocument[]>> {
  const generator = new DocumentGenerator(options)
  
  if (options.schemas) {
    return generator.generateFromSchemas(options.schemas)
  } else {
    return generator.generateFromUrl()
  }
}