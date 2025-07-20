import { TrokkyCore } from '../../core/engine.js'
import { MemoryStorageAdapter } from '../fixtures/memory-storage.js'
import { testSchemas, sampleBlogPost, sampleUser, invalidBlogPost } from '../fixtures/test-schemas.js'
import { 
  SchemaNotFoundError, 
  DocumentNotFoundError, 
  ValidationError,
  InvalidInputError,
  RateLimitError
} from '../../errors/index.js'
import { TrokkyConfig } from '../../types/index.js'

describe('TrokkyCore', () => {
  let core: TrokkyCore
  let storage: MemoryStorageAdapter
  let config: TrokkyConfig

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
    config = {
      storage: {
        adapter: 'memory',
        options: {}
      },
      schemas: testSchemas,
      security: {
        validateInput: true,
        rateLimitEnabled: false
      }
    }
    core = new TrokkyCore(config, storage)
  })

  afterEach(() => {
    storage.clear()
  })

  describe('Document Operations', () => {
    describe('saveDocument', () => {
      test('should save valid document', async () => {
        const savedDoc = await core.saveDocument('posts', sampleBlogPost)

        expect(savedDoc).toMatchObject({
          id: expect.any(String),
          title: sampleBlogPost.title,
          content: sampleBlogPost.content,
          author: sampleBlogPost.author,
          _collection: 'posts',
          _createdAt: expect.any(Date),
          _updatedAt: expect.any(Date)
        })
      })

      test('should save document with custom ID', async () => {
        const customId = 'custom-post-id'
        const savedDoc = await core.saveDocument('posts', { 
          ...sampleBlogPost, 
          id: customId 
        })

        expect(savedDoc.id).toBe(customId)
      })

      test('should validate document against schema', async () => {
        await expect(core.saveDocument('posts', invalidBlogPost))
          .rejects.toThrow(ValidationError)
      })

      test('should reject unknown collection', async () => {
        await expect(core.saveDocument('unknown', sampleBlogPost))
          .rejects.toThrow(SchemaNotFoundError)
      })

      test('should sanitize collection name', async () => {
        await expect(core.saveDocument('posts with spaces', sampleBlogPost))
          .rejects.toThrow(InvalidInputError)
      })

      test('should sanitize document ID', async () => {
        await expect(core.saveDocument('posts', { 
          ...sampleBlogPost, 
          id: 'invalid id with spaces' 
        }))
          .rejects.toThrow(InvalidInputError)
      })

      test('should update existing document', async () => {
        const savedDoc = await core.saveDocument('posts', sampleBlogPost)
        
        // Wait a small amount to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10))
        
        const updatedData = { ...sampleBlogPost, title: 'Updated Title', id: savedDoc.id }
        const updatedDoc = await core.saveDocument('posts', updatedData)

        expect(updatedDoc.title).toBe('Updated Title')
        expect(updatedDoc._updatedAt.getTime()).toBeGreaterThan(savedDoc._updatedAt.getTime())
      })

      test('should preserve type safety with generics', async () => {
        interface BlogPost {
          title: string
          content: string
          author: string
        }

        const savedDoc = await core.saveDocument<BlogPost>('posts', sampleBlogPost)
        
        // TypeScript should infer the correct type
        expect(savedDoc.title).toBe(sampleBlogPost.title)
        expect(savedDoc.content).toBe(sampleBlogPost.content)
      })
    })

    describe('getDocument', () => {
      test('should retrieve existing document', async () => {
        const savedDoc = await core.saveDocument('posts', sampleBlogPost)
        const retrievedDoc = await core.getDocument('posts', savedDoc.id)

        expect(retrievedDoc).toEqual(savedDoc)
      })

      test('should return null for non-existent document', async () => {
        const result = await core.getDocument('posts', 'non-existent')
        expect(result).toBeNull()
      })

      test('should reject unknown collection', async () => {
        await expect(core.getDocument('unknown', 'some-id'))
          .rejects.toThrow(SchemaNotFoundError)
      })

      test('should sanitize inputs', async () => {
        await expect(core.getDocument('invalid collection', 'some-id'))
          .rejects.toThrow(InvalidInputError)

        await expect(core.getDocument('posts', 'invalid id with spaces'))
          .rejects.toThrow(InvalidInputError)
      })
    })

    describe('listDocuments', () => {
      beforeEach(async () => {
        // Create test documents
        await core.saveDocument('posts', { ...sampleBlogPost, title: 'Post 1' })
        await core.saveDocument('posts', { ...sampleBlogPost, title: 'Post 2' })
        await core.saveDocument('posts', { ...sampleBlogPost, title: 'Post 3' })
      })

      test('should list all documents', async () => {
        const docs = await core.listDocuments('posts')
        expect(docs).toHaveLength(3)
      })

      test('should apply limit and offset', async () => {
        const docs = await core.listDocuments('posts', { limit: 2, offset: 1 })
        expect(docs).toHaveLength(2)
      })

      test('should apply filters', async () => {
        const docs = await core.listDocuments('posts', { 
          filter: { title: 'Post 1' }
        })
        expect(docs).toHaveLength(1)
        expect(docs[0].title).toBe('Post 1')
      })

      test('should apply sorting', async () => {
        const docs = await core.listDocuments('posts', { 
          sort: 'title.desc' 
        })
        expect(docs[0].title).toBe('Post 3')
        expect(docs[2].title).toBe('Post 1')
      })

      test('should sanitize list options', async () => {
        // Invalid limit should be corrected to minimum 1, but we only have 3 docs, so expect 1 (first doc)
        const result1 = await core.listDocuments('posts', { 
          limit: -5, // invalid, should be corrected to 1
          offset: 0
        })
        expect(result1).toHaveLength(1) // corrected to minimum limit of 1

        // Test that all docs are accessible with proper limit
        const result2 = await core.listDocuments('posts', { 
          limit: 10 // valid high limit
        })
        expect(result2).toHaveLength(3) // all 3 documents

        await expect(core.listDocuments('posts', { 
          sort: 'invalid.direction' 
        }))
          .rejects.toThrow(InvalidInputError)
      })

      test('should reject unknown collection', async () => {
        await expect(core.listDocuments('unknown'))
          .rejects.toThrow(SchemaNotFoundError)
      })
    })

    describe('deleteDocument', () => {
      test('should delete existing document', async () => {
        const savedDoc = await core.saveDocument('posts', sampleBlogPost)
        
        await core.deleteDocument('posts', savedDoc.id)
        
        const retrievedDoc = await core.getDocument('posts', savedDoc.id)
        expect(retrievedDoc).toBeNull()
      })

      test('should throw error for non-existent document', async () => {
        await expect(core.deleteDocument('posts', 'non-existent'))
          .rejects.toThrow(DocumentNotFoundError)
      })

      test('should reject unknown collection', async () => {
        await expect(core.deleteDocument('unknown', 'some-id'))
          .rejects.toThrow(SchemaNotFoundError)
      })

      test('should sanitize inputs', async () => {
        await expect(core.deleteDocument('invalid collection', 'some-id'))
          .rejects.toThrow(InvalidInputError)
      })
    })
  })

  describe('Media Operations', () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      // Create content that matches the expected size
      const content = 'x'.repeat(size)
      return new File([content], name, { type }) as any
    }

    describe('uploadMedia', () => {
      test('should upload valid media file', async () => {
        const file = createMockFile('test.jpg', 'image/jpeg', 1024)
        const mediaFile = await core.uploadMedia(file)

        expect(mediaFile).toMatchObject({
          id: expect.any(String),
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 1024,
          url: expect.stringMatching(/\.jpg$/),
          _createdAt: expect.any(Date)
        })
      })

      test('should reject invalid file types', async () => {
        const file = createMockFile('script.exe', 'application/exe', 1024)
        
        await expect(core.uploadMedia(file))
          .rejects.toThrow(InvalidInputError)
      })

      test('should reject files that are too large', async () => {
        const file = createMockFile('huge.jpg', 'image/jpeg', 200 * 1024 * 1024) // 200MB
        
        await expect(core.uploadMedia(file))
          .rejects.toThrow(InvalidInputError)
      })

      test('should reject files with invalid names', async () => {
        const file = createMockFile('file with spaces.jpg', 'image/jpeg', 1024)
        
        await expect(core.uploadMedia(file))
          .rejects.toThrow(InvalidInputError)
      })
    })

    describe('getMedia', () => {
      test('should retrieve uploaded media', async () => {
        const file = createMockFile('test.jpg', 'image/jpeg', 1024)
        const uploadedMedia = await core.uploadMedia(file)
        
        const retrievedMedia = await core.getMedia(uploadedMedia.id)
        expect(retrievedMedia).toEqual(uploadedMedia)
      })

      test('should return null for non-existent media', async () => {
        const result = await core.getMedia('non-existent')
        expect(result).toBeNull()
      })

      test('should sanitize media ID', async () => {
        await expect(core.getMedia('invalid id with spaces'))
          .rejects.toThrow(InvalidInputError)
      })
    })

    describe('deleteMedia', () => {
      test('should delete existing media', async () => {
        const file = createMockFile('test.jpg', 'image/jpeg', 1024)
        const uploadedMedia = await core.uploadMedia(file)
        
        await core.deleteMedia(uploadedMedia.id)
        
        const retrievedMedia = await core.getMedia(uploadedMedia.id)
        expect(retrievedMedia).toBeNull()
      })

      test('should throw error for non-existent media', async () => {
        await expect(core.deleteMedia('non-existent'))
          .rejects.toThrow(DocumentNotFoundError)
      })
    })
  })

  describe('Schema Operations', () => {
    test('should get schema by name', () => {
      const schema = core.getSchema('posts')
      expect(schema).toBeTruthy()
      expect(schema?.name).toBe('posts')
    })

    test('should return null for unknown schema', () => {
      const schema = core.getSchema('unknown')
      expect(schema).toBeNull()
    })

    test('should get all schemas', () => {
      const schemas = core.getAllSchemas()
      expect(schemas).toHaveLength(testSchemas.length)
    })

    test('should validate document against schema', () => {
      const result = core.validateDocument('posts', sampleBlogPost)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should return validation errors for invalid document', () => {
      const result = core.validateDocument('posts', invalidBlogPost)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Enable rate limiting for these tests
      const rateLimitConfig = {
        ...config,
        security: {
          validateInput: true,
          rateLimitEnabled: true
        },
        api: {
          rateLimit: {
            windowMs: 60000,
            maxRequests: 3
          }
        }
      }
      core = new TrokkyCore(rateLimitConfig, storage)
    })

    test('should allow requests within limit', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(core.getDocument('posts', 'test-id'))
          .resolves.toBeNull() // document doesn't exist, but request succeeds
      }
    })

    test('should block requests exceeding limit', async () => {
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        await core.getDocument('posts', 'test-id').catch(() => {}) // ignore not found errors
      }

      // Next request should be rate limited
      await expect(core.getDocument('posts', 'test-id'))
        .rejects.toThrow(RateLimitError)
    })

    test('should rate limit different operations separately', async () => {
      // Use up limit for getDocument
      for (let i = 0; i < 3; i++) {
        await core.getDocument('posts', 'test-id').catch(() => {})
      }

      // saveDocument should still work (different operation)
      await expect(core.saveDocument('posts', sampleBlogPost))
        .resolves.toBeTruthy()
    })
  })

  describe('Health Check', () => {
    test('should return true when healthy', async () => {
      const healthy = await core.healthCheck()
      expect(healthy).toBe(true)
    })

    test('should return false when storage is unhealthy', async () => {
      storage.setHealthy(false)
      const healthy = await core.healthCheck()
      expect(healthy).toBe(false)
    })

    test('should return false when no schemas are loaded', async () => {
      const emptyConfig = {
        ...config,
        schemas: []
      }
      const emptyCore = new TrokkyCore(emptyConfig, storage)
      
      const healthy = await emptyCore.healthCheck()
      expect(healthy).toBe(false)
    })
  })

  describe('Security Configuration', () => {
    test('should allow disabling security validation', async () => {
      const unsecureConfig = {
        ...config,
        security: {
          validateInput: false,
          rateLimitEnabled: false
        }
      }
      const unsecureCore = new TrokkyCore(unsecureConfig, storage, {
        enableSecurity: false
      })

      // Should allow invalid collection name when security is disabled
      // Note: This is not recommended for production!
      await expect(unsecureCore.saveDocument('invalid collection', sampleBlogPost))
        .rejects.toThrow(SchemaNotFoundError) // Still fails on schema, not security
    })

    test('should enable security by default', async () => {
      const defaultConfig = {
        storage: {
          adapter: 'memory',
          options: {}
        },
        schemas: testSchemas
      }
      const secureCore = new TrokkyCore(defaultConfig, storage)

      await expect(secureCore.saveDocument('invalid collection', sampleBlogPost))
        .rejects.toThrow(InvalidInputError)
    })
  })

  describe('Cleanup', () => {
    test('should cleanup rate limiter when available', () => {
      const rateLimitConfig = {
        ...config,
        security: {
          validateInput: true,
          rateLimitEnabled: true
        }
      }
      const rateLimitedCore = new TrokkyCore(rateLimitConfig, storage)

      // Should not throw
      expect(() => rateLimitedCore.cleanup()).not.toThrow()
    })

    test('should handle cleanup when no rate limiter', () => {
      // Should not throw
      expect(() => core.cleanup()).not.toThrow()
    })
  })
})