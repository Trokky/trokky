// Mock @trokky/core before importing slug-processor
jest.mock('@trokky/core', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}))

import {
  defaultSlugify,
  getSourceValue,
  findAutoGenerateSlugFields,
  processSlugFields,
  SlugFieldConfig
} from '../slug-processor'

// Define ContentSchema interface for tests (matches @trokky/core)
interface ContentSchema {
  name: string
  type: string
  fields?: Record<string, any>
}

// Define TrokkyCore interface for mocking
interface TrokkyCore {
  getSchema: (collection: string) => ContentSchema | null
  listDocuments: (collection: string, options?: any) => Promise<any[]>
}

describe('slug-processor', () => {
  describe('defaultSlugify', () => {
    it('should convert basic string to slug', () => {
      expect(defaultSlugify('Hello World')).toBe('hello-world')
    })

    it('should handle empty input', () => {
      expect(defaultSlugify('')).toBe('')
      expect(defaultSlugify(null as any)).toBe('')
      expect(defaultSlugify(undefined as any)).toBe('')
    })

    it('should remove diacritical marks', () => {
      expect(defaultSlugify('Café Résumé')).toBe('cafe-resume')
      expect(defaultSlugify('Niño')).toBe('nino')
      expect(defaultSlugify('Über')).toBe('uber')
    })

    it('should convert to lowercase by default', () => {
      expect(defaultSlugify('HELLO WORLD')).toBe('hello-world')
    })

    it('should preserve case when option is set', () => {
      expect(defaultSlugify('Hello World', { preserveCase: true })).toBe('Hello-World')
    })

    it('should remove invalid characters', () => {
      expect(defaultSlugify('Hello! @World#')).toBe('hello-world')
      expect(defaultSlugify('Hello & World')).toBe('hello-world')
    })

    it('should handle multiple spaces', () => {
      expect(defaultSlugify('Hello    World')).toBe('hello-world')
    })

    it('should handle multiple hyphens', () => {
      expect(defaultSlugify('Hello---World')).toBe('hello-world')
    })

    it('should remove leading and trailing hyphens', () => {
      expect(defaultSlugify('-Hello World-')).toBe('hello-world')
    })

    it('should allow slashes by default', () => {
      expect(defaultSlugify('category/subcategory')).toBe('category/subcategory')
    })

    it('should remove slashes when allowSlashes is false', () => {
      expect(defaultSlugify('category/subcategory', { allowSlashes: false })).toBe('categorysubcategory')
    })

    it('should allow additional characters', () => {
      expect(defaultSlugify('Hello_World', { allowedChars: '_' })).toBe('hello_world')
    })

    it('should add prefix', () => {
      expect(defaultSlugify('hello world', { prefix: 'blog' })).toBe('blog-hello-world')
    })

    it('should add suffix', () => {
      expect(defaultSlugify('hello world', { suffix: '2024' })).toBe('hello-world-2024')
    })

    it('should handle prefix ending with separator', () => {
      expect(defaultSlugify('hello world', { prefix: 'blog/' })).toBe('blog/hello-world')
      expect(defaultSlugify('hello world', { prefix: 'blog-' })).toBe('blog-hello-world')
    })

    it('should handle suffix starting with separator', () => {
      expect(defaultSlugify('hello world', { suffix: '/page' })).toBe('hello-world/page')
      expect(defaultSlugify('hello world', { suffix: '-page' })).toBe('hello-world-page')
    })

    it('should combine multiple options', () => {
      expect(defaultSlugify('Hello World', {
        preserveCase: true,
        prefix: 'blog',
        suffix: '2024'
      })).toBe('blog-Hello-World-2024')
    })
  })

  describe('getSourceValue', () => {
    it('should get value from single source field', () => {
      const doc = { title: 'Hello World', content: 'Some content' }
      expect(getSourceValue('title', doc)).toBe('Hello World')
    })

    it('should get value from array of source fields (first non-empty)', () => {
      const doc = { title: '', subtitle: 'My Subtitle' }
      expect(getSourceValue(['title', 'subtitle'], doc)).toBe('My Subtitle')
    })

    it('should return empty string when no source value found', () => {
      const doc = { content: 'Some content' }
      expect(getSourceValue('title', doc)).toBe('')
    })

    it('should handle nested paths', () => {
      const doc = { metadata: { title: 'Nested Title' } }
      expect(getSourceValue('metadata.title', doc)).toBe('Nested Title')
    })

    it('should handle empty/null source', () => {
      const doc = { title: 'Test' }
      expect(getSourceValue('', doc)).toBe('')
      expect(getSourceValue(null as any, doc)).toBe('')
    })

    it('should trim whitespace', () => {
      const doc = { title: '  Hello World  ' }
      expect(getSourceValue('title', doc)).toBe('Hello World')
    })

    it('should skip non-string values', () => {
      const doc = { title: 123, subtitle: 'Fallback' }
      expect(getSourceValue(['title', 'subtitle'], doc)).toBe('Fallback')
    })
  })

  describe('findAutoGenerateSlugFields', () => {
    it('should find slug fields with auto-generate enabled', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: {
            type: 'slug',
            source: 'title',
            unique: true
          }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(1)
      expect(result[0].fieldName).toBe('slug')
      expect(result[0].source).toBe('title')
      expect(result[0].unique).toBe(true)
    })

    it('should not include slug fields without source', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          slug: { type: 'slug' }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(0)
    })

    it('should not include slug fields with autoGenerate: false', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          slug: {
            type: 'slug',
            source: 'title',
            autoGenerate: false
          }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(0)
    })

    it('should use default values for optional properties', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          slug: {
            type: 'slug',
            source: 'title'
          }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(1)
      expect(result[0].autoGenerate).toBe(true)
      expect(result[0].unique).toBe(true)
      expect(result[0].maxLength).toBe(200)
      expect(result[0].minLength).toBe(1)
      expect(result[0].preserveCase).toBe(false)
      expect(result[0].allowSlashes).toBe(true)
    })

    it('should return empty array for schema without fields', () => {
      const schema = { name: 'post', type: 'document' } as ContentSchema
      expect(findAutoGenerateSlugFields(schema)).toHaveLength(0)
    })

    it('should find multiple slug fields', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          slug: { type: 'slug', source: 'title' },
          categorySlug: { type: 'slug', source: 'category' }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(2)
    })

    it('should find slug field with source in options', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: {
            type: 'slug',
            options: { source: 'title' }
          }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(1)
      expect(result[0].fieldName).toBe('slug')
      expect(result[0].source).toBe('title')
    })

    it('should prefer field-level source over options.source', () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          slug: {
            type: 'slug',
            source: 'title',
            options: { source: 'subtitle' }
          }
        }
      }

      const result = findAutoGenerateSlugFields(schema)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('title')
    })
  })

  describe('processSlugFields', () => {
    const createMockCore = (schema: ContentSchema | null, existingDocs: any[] = []) => {
      return {
        getSchema: jest.fn().mockReturnValue(schema),
        listDocuments: jest.fn().mockImplementation(async (collection, options) => {
          if (options?.filter?.slug) {
            return existingDocs.filter(doc => doc.slug === options.filter.slug)
          }
          return existingDocs
        })
      } as unknown as TrokkyCore
    }

    it('should auto-generate slug from source field', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title' }
        }
      }
      const core = createMockCore(schema)

      const data = { title: 'Hello World' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug).toBe('hello-world')
      expect(result.title).toBe('Hello World')
    })

    it('should not overwrite existing slug', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title' }
        }
      }
      const core = createMockCore(schema)

      const data = { title: 'Hello World', slug: 'custom-slug' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug).toBe('custom-slug')
    })

    it('should return data as-is when no schema found', async () => {
      const core = createMockCore(null)

      const data = { title: 'Hello World' }
      const result = await processSlugFields(core, 'post', data)

      expect(result).toEqual(data)
    })

    it('should return data as-is when no slug fields', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' }
        }
      }
      const core = createMockCore(schema)

      const data = { title: 'Hello World' }
      const result = await processSlugFields(core, 'post', data)

      expect(result).toEqual(data)
    })

    it('should not generate slug when source field is empty', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title' }
        }
      }
      const core = createMockCore(schema)

      const data = { title: '' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug).toBeUndefined()
    })

    it('should generate unique slug when conflict exists', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title', unique: true }
        }
      }
      const existingDocs = [{ _id: 'existing-1', slug: 'hello-world' }]
      const core = createMockCore(schema, existingDocs)

      const data = { title: 'Hello World' }
      const result = await processSlugFields(core, 'post', data)

      // Should find next available number (2, since 1 is taken by base slug)
      expect(result.slug).toBe('hello-world-2')
    })

    it('should exclude current document when checking uniqueness on update', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title', unique: true }
        }
      }
      const existingDocs = [{ _id: 'doc-1', slug: 'hello-world' }]
      const core = createMockCore(schema, existingDocs)

      const data = { title: 'Hello World', slug: 'hello-world' }
      const result = await processSlugFields(core, 'post', data, 'doc-1')

      // Should keep the same slug since it's the same document
      expect(result.slug).toBe('hello-world')
    })

    it('should apply prefix and suffix from schema', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: {
            type: 'slug',
            source: 'title',
            prefix: 'blog',
            suffix: '2024'
          }
        }
      }
      const core = createMockCore(schema)

      const data = { title: 'Hello World' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug).toBe('blog-hello-world-2024')
    })

    it('should respect maxLength limit', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: {
            type: 'slug',
            source: 'title',
            maxLength: 10
          }
        }
      }
      const core = createMockCore(schema)

      const data = { title: 'This is a very long title that should be truncated' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug.length).toBeLessThanOrEqual(10)
    })

    it('should handle array source (multiple fields)', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          slug: { type: 'slug', source: ['title', 'subtitle'] }
        }
      }
      const core = createMockCore(schema)

      // When title is empty, should use subtitle
      const data = { title: '', subtitle: 'My Subtitle' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug).toBe('my-subtitle')
    })

    it('should ensure unique even when provided slug conflicts', async () => {
      const schema: ContentSchema = {
        name: 'post',
        type: 'document',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title', unique: true }
        }
      }
      const existingDocs = [{ _id: 'existing-1', slug: 'custom-slug' }]
      const core = createMockCore(schema, existingDocs)

      const data = { title: 'Hello World', slug: 'custom-slug' }
      const result = await processSlugFields(core, 'post', data)

      expect(result.slug).toBe('custom-slug-2')
    })
  })
})
