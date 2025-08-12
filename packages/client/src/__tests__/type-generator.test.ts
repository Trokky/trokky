/**
 * Type Generator Tests
 */

import { TypeGenerator, generateTypesFromSchema } from '../generator'
import type { ProjectSchema, DocumentSchema } from '../generator'

// Mock fs/promises
const mockWriteFile = jest.fn()
const mockMkdir = jest.fn()
jest.mock('fs/promises', () => ({
  writeFile: mockWriteFile,
  mkdir: mockMkdir
}))

// Mock path
jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/')
}))

describe('TypeGenerator', () => {
  let generator: TypeGenerator
  let mockSchema: ProjectSchema

  beforeEach(() => {
    generator = new TypeGenerator({
      outputDir: './generated',
      schemaUrl: 'https://api.example.com/schema'
    })

    mockSchema = {
      name: 'test-project',
      version: '1.0.0',
      documents: [
        {
          name: 'post',
          title: 'Blog Post',
          description: 'A blog post document',
          fields: [
            {
              type: 'string',
              name: 'title',
              title: 'Title',
              required: true
            },
            {
              type: 'text',
              name: 'content',
              title: 'Content',
              required: true
            },
            {
              type: 'string',
              name: 'slug',
              title: 'Slug',
              required: true,
              validation: { pattern: '^[a-z0-9-]+$' }
            },
            {
              type: 'boolean',
              name: 'published',
              title: 'Published',
              required: false
            },
            {
              type: 'date',
              name: 'publishedAt',
              title: 'Published At',
              required: false
            },
            {
              type: 'array',
              name: 'tags',
              title: 'Tags',
              of: { type: 'string' }
            },
            {
              type: 'reference',
              name: 'author',
              title: 'Author',
              options: {
                to: 'user'
              }
            }
          ]
        },
        {
          name: 'user',
          title: 'User',
          fields: [
            {
              type: 'string',
              name: 'name',
              title: 'Name',
              required: true
            },
            {
              type: 'email',
              name: 'email',
              title: 'Email',
              required: true
            }
          ]
        }
      ]
    }

    // Reset mocks
    mockWriteFile.mockClear()
    mockMkdir.mockClear()
  })

  describe('generateFromSchema', () => {
    it('should generate TypeScript interfaces for documents', async () => {
      await generator.generateFromSchema(mockSchema)

      expect(mockMkdir).toHaveBeenCalledWith('./generated', { recursive: true })
      expect(mockWriteFile).toHaveBeenCalledTimes(3) // 2 documents + 1 index file

      // Check post document generation
      const postCall = mockWriteFile.mock.calls.find(call => call[0].endsWith('post.ts'))
      expect(postCall).toBeTruthy()
      
      const postContent = postCall[1]
      expect(postContent).toContain('export interface postDocument extends BaseDocument')
      expect(postContent).toContain("_type: 'post'")
      expect(postContent).toContain('title: string')
      expect(postContent).toContain('content: string')
      expect(postContent).toContain('published?: boolean')
      expect(postContent).toContain('tags?: string[]')
      expect(postContent).toContain('author?: string | userDocument')
    })

    it('should generate validation schemas when enabled', async () => {
      await generator.generateFromSchema(mockSchema)

      const postCall = mockWriteFile.mock.calls.find(call => call[0].endsWith('post.ts'))
      const postContent = postCall[1]
      
      expect(postContent).toContain('export const postValidationSchema')
      expect(postContent).toContain("type: 'post'")
      expect(postContent).toContain('required: true')
      expect(postContent).toContain('pattern: "^[a-z0-9-]+$"')
    })

    it('should generate index file with exports', async () => {
      await generator.generateFromSchema(mockSchema)

      const indexCall = mockWriteFile.mock.calls.find(call => call[0].endsWith('index.ts'))
      expect(indexCall).toBeTruthy()
      
      const indexContent = indexCall[1]
      expect(indexContent).toContain("export * from './post'")
      expect(indexContent).toContain("export * from './user'")
      expect(indexContent).toContain('export type DocumentTypes =')
      expect(indexContent).toContain("| 'post'")
      expect(indexContent).toContain("| 'user'")
      expect(indexContent).toContain('export type AllDocuments =')
      expect(indexContent).toContain('| postDocument')
      expect(indexContent).toContain('| userDocument')
    })

    it('should handle complex field types', async () => {
      const complexSchema: ProjectSchema = {
        name: 'complex-project',
        version: '1.0.0',
        documents: [
          {
            name: 'product',
            fields: [
              {
                type: 'object',
                name: 'dimensions',
                options: {
                  fields: [
                    { type: 'number', name: 'width', required: true },
                    { type: 'number', name: 'height', required: true },
                    { type: 'number', name: 'depth', required: false }
                  ]
                }
              },
              {
                type: 'image',
                name: 'featuredImage'
              },
              {
                type: 'portableText',
                name: 'description'
              }
            ]
          }
        ]
      }

      await generator.generateFromSchema(complexSchema)

      const productCall = mockWriteFile.mock.calls.find(call => call[0].endsWith('product.ts'))
      const productContent = productCall[1]
      
      expect(productContent).toContain('export interface productDimensions')
      expect(productContent).toContain('width: number')
      expect(productContent).toContain('height: number')
      expect(productContent).toContain('depth?: number')
      expect(productContent).toContain('dimensions?: productDimensions')
      expect(productContent).toContain('featuredImage?: string | { _ref: string; url?: string; metadata?: Record<string, any> }')
      expect(productContent).toContain('description?: any[] // Portable Text blocks')
    })

    it('should skip validation schemas when disabled', async () => {
      const generatorNoValidation = new TypeGenerator({
        outputDir: './generated',
        schemaUrl: 'https://api.example.com/schema',
        includeValidation: false
      })

      await generatorNoValidation.generateFromSchema(mockSchema)

      const postCall = mockWriteFile.mock.calls.find(call => call[0].endsWith('post.ts'))
      const postContent = postCall[1]
      
      expect(postContent).not.toContain('ValidationSchema')
    })

    it('should use custom namespace', async () => {
      const customGenerator = new TypeGenerator({
        outputDir: './generated',
        schemaUrl: 'https://api.example.com/schema',
        namespace: 'MyApp'
      })

      await customGenerator.generateFromSchema(mockSchema)

      // The namespace is currently used in imports and comments
      const postCall = mockWriteFile.mock.calls.find(call => call[0].endsWith('post.ts'))
      const postContent = postCall[1]
      
      expect(postContent).toContain('Generated from Trokky schema')
    })

    it('should generate .d.ts files when specified', async () => {
      const dtsGenerator = new TypeGenerator({
        outputDir: './generated',
        schemaUrl: 'https://api.example.com/schema',
        fileExtension: 'd.ts'
      })

      await dtsGenerator.generateFromSchema(mockSchema)

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('post.d.ts'),
        expect.any(String),
        'utf8'
      )
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('index.d.ts'),
        expect.any(String),
        'utf8'
      )
    })
  })

  describe('utility functions', () => {
    it('should convert camelCase to kebab-case', async () => {
      const schema: ProjectSchema = {
        name: 'test',
        version: '1.0.0',
        documents: [
          {
            name: 'blogPost',
            fields: [{ type: 'string', name: 'title' }]
          }
        ]
      }

      await generator.generateFromSchema(schema)

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('blog-post.ts'),
        expect.any(String),
        'utf8'
      )
    })
  })

  describe('generateTypesFromSchema helper function', () => {
    it('should work with the helper function', async () => {
      await generateTypesFromSchema(mockSchema, {
        outputDir: './generated'
      })

      expect(mockWriteFile).toHaveBeenCalled()
      expect(mockMkdir).toHaveBeenCalledWith('./generated', { recursive: true })
    })
  })
})