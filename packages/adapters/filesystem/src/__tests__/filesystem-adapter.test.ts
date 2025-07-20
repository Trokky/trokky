import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { FilesystemAdapter } from '../filesystem-adapter.js'
import { sampleBlogPost, sampleUser, samplePage, createMockFile, createMockMediaMetadata } from './fixtures/test-data.js'
import { Document, ListOptions } from '@trokky/core'

describe('FilesystemAdapter', () => {
  let adapter: FilesystemAdapter
  let testDir: string
  let contentDir: string
  let mediaDir: string

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-test-'))
    contentDir = path.join(testDir, 'content')
    mediaDir = path.join(testDir, 'media')

    adapter = new FilesystemAdapter({
      contentDir,
      mediaDir,
      createDirs: true,
      prettyJson: true
    })

    // Wait a bit for directories to be created
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.remove(testDir)
    } catch (error) {
      console.warn('Failed to clean up test directory:', error)
    }
  })

  describe('initialization', () => {
    test('should create content and media directories', async () => {
      expect(await fs.pathExists(contentDir)).toBe(true)
      expect(await fs.pathExists(mediaDir)).toBe(true)
      expect(await fs.pathExists(path.join(mediaDir, '.metadata'))).toBe(true)
    })

    test('should use default configuration', () => {
      const defaultAdapter = new FilesystemAdapter()
      expect(defaultAdapter).toBeDefined()
    })

    test('should handle directory creation failure gracefully', async () => {
      // Create adapter with invalid directory permissions
      const invalidDir = path.join(testDir, 'invalid')
      await fs.ensureDir(invalidDir)
      await fs.chmod(invalidDir, 0o000) // No permissions

      expect(() => {
        new FilesystemAdapter({
          contentDir: path.join(invalidDir, 'content'),
          createDirs: true,
          silent: true // Suppress warning logs in tests
        })
      }).not.toThrow() // Constructor should not throw, but operations might fail later
    })
  })

  describe('document operations', () => {
    describe('saveDocument', () => {
      test('should save a new document', async () => {
        const savedDoc = await adapter.saveDocument('posts', 'test-post', sampleBlogPost)

        expect(savedDoc).toMatchObject({
          id: 'test-post',
          title: sampleBlogPost.title,
          content: sampleBlogPost.content,
          _collection: 'posts',
          _createdAt: expect.any(Date),
          _updatedAt: expect.any(Date),
          _revision: 1
        })

        // Check that file was created
        const filePath = path.join(contentDir, 'posts', 'test-post.json')
        expect(await fs.pathExists(filePath)).toBe(true)

        // Check file content structure (raw JSON without date revival)
        const fileContent = await fs.readJSON(filePath)
        expect(fileContent).toMatchObject({
          id: 'test-post',
          collection: 'posts',
          data: {
            ...sampleBlogPost,
            publishedAt: expect.any(String) // Should be ISO string in raw JSON
          },
          metadata: {
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            revision: 1
          }
        })
      })

      test('should update an existing document', async () => {
        // Save initial document
        const initialDoc = await adapter.saveDocument('posts', 'test-post', sampleBlogPost)
        
        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10))

        // Update the document
        const updatedData = { ...sampleBlogPost, title: 'Updated Title' }
        const updatedDoc = await adapter.saveDocument('posts', 'test-post', updatedData)

        expect(updatedDoc.title).toBe('Updated Title')
        expect(updatedDoc._revision).toBe(2)
        expect(updatedDoc._createdAt).toEqual(initialDoc._createdAt)
        expect(updatedDoc._updatedAt.getTime()).toBeGreaterThan(initialDoc._updatedAt.getTime())
      })

      test('should create collection directory if it does not exist', async () => {
        const collectionDir = path.join(contentDir, 'new-collection')
        expect(await fs.pathExists(collectionDir)).toBe(false)

        await adapter.saveDocument('new-collection', 'test-doc', sampleUser)

        expect(await fs.pathExists(collectionDir)).toBe(true)
      })

      test('should handle complex nested data', async () => {
        const complexData = {
          ...sampleBlogPost,
          nested: {
            level1: {
              level2: {
                value: 'deep value',
                array: [1, 2, 3, { nested: true }]
              }
            }
          }
        }

        const savedDoc = await adapter.saveDocument('posts', 'complex-doc', complexData)
        expect(savedDoc.nested).toEqual(complexData.nested)
      })
    })

    describe('getDocument', () => {
      test('should retrieve an existing document', async () => {
        const savedDoc = await adapter.saveDocument('posts', 'test-post', sampleBlogPost)
        const retrievedDoc = await adapter.getDocument('posts', 'test-post')

        expect(retrievedDoc).toEqual(savedDoc)
      })

      test('should return null for non-existent document', async () => {
        const result = await adapter.getDocument('posts', 'non-existent')
        expect(result).toBeNull()
      })

      test('should return null for non-existent collection', async () => {
        const result = await adapter.getDocument('non-existent-collection', 'test-doc')
        expect(result).toBeNull()
      })

      test('should handle corrupted JSON files', async () => {
        // Create a corrupted JSON file
        const collectionDir = path.join(contentDir, 'posts')
        await fs.ensureDir(collectionDir)
        await fs.writeFile(path.join(collectionDir, 'corrupted.json'), 'invalid json content')

        await expect(adapter.getDocument('posts', 'corrupted')).rejects.toThrow()
      })
    })

    describe('listDocuments', () => {
      beforeEach(async () => {
        // Create test documents
        await adapter.saveDocument('posts', 'post-1', { ...sampleBlogPost, title: 'Post 1', score: 10 })
        await adapter.saveDocument('posts', 'post-2', { ...sampleBlogPost, title: 'Post 2', score: 20 })
        await adapter.saveDocument('posts', 'post-3', { ...sampleBlogPost, title: 'Post 3', score: 30 })
        await adapter.saveDocument('users', 'user-1', sampleUser)
      })

      test('should list all documents in a collection', async () => {
        const docs = await adapter.listDocuments('posts')
        expect(docs).toHaveLength(3)
        expect(docs.every(doc => doc._collection === 'posts')).toBe(true)
      })

      test('should return empty array for non-existent collection', async () => {
        const docs = await adapter.listDocuments('non-existent')
        expect(docs).toEqual([])
      })

      test('should apply limit and offset', async () => {
        const options: ListOptions = { limit: 2, offset: 1 }
        const docs = await adapter.listDocuments('posts', options)
        expect(docs).toHaveLength(2)
      })

      test('should apply filtering', async () => {
        const options: ListOptions = { filter: { title: 'Post 1' } }
        const docs = await adapter.listDocuments('posts', options)
        expect(docs).toHaveLength(1)
        expect(docs[0].title).toBe('Post 1')
      })

      test('should apply complex filtering with operators', async () => {
        const options: ListOptions = { 
          filter: { 
            score: { $gte: 20 } 
          } 
        }
        const docs = await adapter.listDocuments('posts', options)
        expect(docs).toHaveLength(2)
        expect(docs.every((doc: any) => doc.score >= 20)).toBe(true)
      })

      test('should apply sorting', async () => {
        const options: ListOptions = { sort: 'title.desc' }
        const docs = await adapter.listDocuments('posts', options)
        expect(docs[0].title).toBe('Post 3')
        expect(docs[2].title).toBe('Post 1')
      })

      test('should apply multiple sort fields', async () => {
        const options: ListOptions = { sort: ['score.desc', 'title.asc'] }
        const docs = await adapter.listDocuments('posts', options)
        expect(docs[0].title).toBe('Post 3') // Highest score
        expect(docs[2].title).toBe('Post 1') // Lowest score
      })

      test('should handle corrupted documents gracefully', async () => {
        // Create a corrupted file
        const collectionDir = path.join(contentDir, 'posts')
        await fs.writeFile(path.join(collectionDir, 'corrupted.json'), 'invalid json')

        // Create a silent adapter to suppress warning logs in tests
        const silentAdapter = new FilesystemAdapter({
          contentDir,
          mediaDir,
          silent: true
        })

        // Should skip corrupted files and return valid ones
        const docs = await silentAdapter.listDocuments('posts')
        expect(docs).toHaveLength(3) // Should still return the 3 valid documents
      })
    })

    describe('deleteDocument', () => {
      test('should delete an existing document', async () => {
        await adapter.saveDocument('posts', 'test-post', sampleBlogPost)
        
        const filePath = path.join(contentDir, 'posts', 'test-post.json')
        expect(await fs.pathExists(filePath)).toBe(true)

        await adapter.deleteDocument('posts', 'test-post')
        
        expect(await fs.pathExists(filePath)).toBe(false)
        expect(await adapter.getDocument('posts', 'test-post')).toBeNull()
      })

      test('should throw error when deleting non-existent document', async () => {
        await expect(adapter.deleteDocument('posts', 'non-existent'))
          .rejects.toThrow('Document posts/non-existent not found')
      })
    })
  })

  describe('media operations', () => {
    describe('uploadFile', () => {
      test('should upload and store a file', async () => {
        const fileContent = 'Test file content'
        const file = createMockFile(fileContent, 'test.txt', 'text/plain')
        const metadata = createMockMediaMetadata('test.txt', 'text/plain', fileContent.length)

        const mediaFile = await adapter.uploadFile(file, metadata)

        expect(mediaFile).toMatchObject({
          id: metadata.id,
          filename: 'test.txt',
          contentType: 'text/plain',
          size: fileContent.length,
          url: expect.stringContaining('file://'),
          _createdAt: expect.any(Date)
        })

        // Check that files were created
        const filePath = path.join(mediaDir, `${metadata.id}.txt`)
        const metadataPath = path.join(mediaDir, '.metadata', `${metadata.id}.json`)
        
        expect(await fs.pathExists(filePath)).toBe(true)
        expect(await fs.pathExists(metadataPath)).toBe(true)

        // Check file content
        const storedContent = await fs.readFile(filePath, 'utf-8')
        expect(storedContent).toBe(fileContent)
      })

      test('should handle binary files', async () => {
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG header
        const file = createMockFile(binaryContent, 'test.png', 'image/png')
        const metadata = createMockMediaMetadata('test.png', 'image/png', binaryContent.length)

        const mediaFile = await adapter.uploadFile(file, metadata)

        expect(mediaFile.contentType).toBe('image/png')
        expect(mediaFile.size).toBe(binaryContent.length)

        // Verify binary content is preserved
        const filePath = path.join(mediaDir, `${metadata.id}.png`)
        const storedContent = await fs.readFile(filePath)
        expect(storedContent).toEqual(binaryContent)
      })
    })

    describe('getFile', () => {
      test('should retrieve an uploaded file', async () => {
        const fileContent = 'Test file content'
        const file = createMockFile(fileContent, 'test.txt', 'text/plain')
        const metadata = createMockMediaMetadata('test.txt', 'text/plain', fileContent.length)

        const uploadedFile = await adapter.uploadFile(file, metadata)
        const retrievedFile = await adapter.getFile(metadata.id)

        expect(retrievedFile).toEqual(uploadedFile)
      })

      test('should return null for non-existent file', async () => {
        const result = await adapter.getFile('non-existent-id')
        expect(result).toBeNull()
      })

      test('should handle missing file with existing metadata', async () => {
        const fileContent = 'Test file content'
        const file = createMockFile(fileContent, 'test.txt', 'text/plain')
        const metadata = createMockMediaMetadata('test.txt', 'text/plain', fileContent.length)

        await adapter.uploadFile(file, metadata)

        // Delete the actual file but leave metadata
        const filePath = path.join(mediaDir, `${metadata.id}.txt`)
        await fs.unlink(filePath)

        await expect(adapter.getFile(metadata.id)).rejects.toThrow('file is missing')
      })
    })

    describe('deleteFile', () => {
      test('should delete an uploaded file and its metadata', async () => {
        const fileContent = 'Test file content'
        const file = createMockFile(fileContent, 'test.txt', 'text/plain')
        const metadata = createMockMediaMetadata('test.txt', 'text/plain', fileContent.length)

        await adapter.uploadFile(file, metadata)

        const filePath = path.join(mediaDir, `${metadata.id}.txt`)
        const metadataPath = path.join(mediaDir, '.metadata', `${metadata.id}.json`)
        
        expect(await fs.pathExists(filePath)).toBe(true)
        expect(await fs.pathExists(metadataPath)).toBe(true)

        await adapter.deleteFile(metadata.id)

        expect(await fs.pathExists(filePath)).toBe(false)
        expect(await fs.pathExists(metadataPath)).toBe(false)
        expect(await adapter.getFile(metadata.id)).toBeNull()
      })

      test('should throw error when deleting non-existent file', async () => {
        await expect(adapter.deleteFile('non-existent-id'))
          .rejects.toThrow('Media file non-existent-id not found')
      })

      test('should handle partially missing files gracefully', async () => {
        const fileContent = 'Test file content'
        const file = createMockFile(fileContent, 'test.txt', 'text/plain')
        const metadata = createMockMediaMetadata('test.txt', 'text/plain', fileContent.length)

        await adapter.uploadFile(file, metadata)

        // Delete just the file, leave metadata
        const filePath = path.join(mediaDir, `${metadata.id}.txt`)
        await fs.unlink(filePath)

        // Should still succeed in cleanup
        await expect(adapter.deleteFile(metadata.id)).resolves.not.toThrow()
      })
    })
  })

  describe('utility operations', () => {
    describe('healthCheck', () => {
      test('should return true for healthy adapter', async () => {
        const healthy = await adapter.healthCheck()
        expect(healthy).toBe(true)
      })

      test('should return false for inaccessible directories', async () => {
        // Create adapter with non-existent directory
        const badAdapter = new FilesystemAdapter({
          contentDir: '/non/existent/path',
          mediaDir: '/non/existent/path',
          createDirs: false
        })

        const healthy = await badAdapter.healthCheck()
        expect(healthy).toBe(false)
      })

      test('should return false for read-only directories', async () => {
        // Make directories read-only
        await fs.chmod(contentDir, 0o444)
        await fs.chmod(mediaDir, 0o444)

        const healthy = await adapter.healthCheck()
        expect(healthy).toBe(false)

        // Restore permissions for cleanup
        await fs.chmod(contentDir, 0o755)
        await fs.chmod(mediaDir, 0o755)
      })
    })

    describe('migrate', () => {
      test('should run migrations in order', async () => {
        const migrationLog: string[] = []
        
        const migrations = [
          {
            version: '1.0.0',
            description: 'First migration',
            up: async () => { migrationLog.push('1.0.0-up') },
            down: async () => { migrationLog.push('1.0.0-down') }
          },
          {
            version: '1.1.0',
            description: 'Second migration',
            up: async () => { migrationLog.push('1.1.0-up') },
            down: async () => { migrationLog.push('1.1.0-down') }
          }
        ]

        await adapter.migrate(migrations)

        expect(migrationLog).toEqual(['1.0.0-up', '1.1.0-up'])

        // Check migration log file
        const logPath = path.join(contentDir, '.migrations.json')
        expect(await fs.pathExists(logPath)).toBe(true)
        
        const appliedMigrations = await fs.readJSON(logPath)
        expect(appliedMigrations).toEqual(['1.0.0', '1.1.0'])
      })

      test('should skip already applied migrations', async () => {
        const migrationLog: string[] = []
        
        const migration = {
          version: '1.0.0',
          description: 'Test migration',
          up: async () => { migrationLog.push('1.0.0-up') },
          down: async () => { migrationLog.push('1.0.0-down') }
        }

        // Run migration twice
        await adapter.migrate([migration])
        await adapter.migrate([migration])

        // Should only run once
        expect(migrationLog).toEqual(['1.0.0-up'])
      })

      test('should rollback on migration failure', async () => {
        const migrationLog: string[] = []
        
        const migration = {
          version: '1.0.0',
          description: 'Failing migration',
          up: async () => { 
            migrationLog.push('1.0.0-up')
            throw new Error('Migration failed')
          },
          down: async () => { migrationLog.push('1.0.0-down') }
        }

        await expect(adapter.migrate([migration])).rejects.toThrow('Migration 1.0.0 failed')
        expect(migrationLog).toEqual(['1.0.0-up', '1.0.0-down'])

        // Migration should not be recorded as applied
        const logPath = path.join(contentDir, '.migrations.json')
        if (await fs.pathExists(logPath)) {
          const appliedMigrations = await fs.readJSON(logPath)
          expect(appliedMigrations).not.toContain('1.0.0')
        }
      })
    })
  })

  describe('configuration options', () => {
    test('should respect prettyJson setting', async () => {
      const uglyAdapter = new FilesystemAdapter({
        contentDir,
        mediaDir,
        prettyJson: false
      })

      await uglyAdapter.saveDocument('posts', 'test-post', sampleBlogPost)

      const filePath = path.join(contentDir, 'posts', 'test-post.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      
      // Should be minified (no indentation)
      expect(fileContent).not.toContain('\n  ')
    })

    test('should respect custom jsonSpaces setting', async () => {
      const spacedAdapter = new FilesystemAdapter({
        contentDir,
        mediaDir,
        prettyJson: true,
        jsonSpaces: 4
      })

      await spacedAdapter.saveDocument('posts', 'test-post', sampleBlogPost)

      const filePath = path.join(contentDir, 'posts', 'test-post.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      
      // Should use 4 spaces for indentation
      expect(fileContent).toContain('\n    ')
    })

    test('should handle custom file permissions', async () => {
      const customAdapter = new FilesystemAdapter({
        contentDir,
        mediaDir,
        fileMode: 0o600, // Owner read/write only
        dirMode: 0o700   // Owner access only
      })

      await customAdapter.saveDocument('posts', 'test-post', sampleBlogPost)

      const filePath = path.join(contentDir, 'posts', 'test-post.json')
      const stats = await fs.stat(filePath)
      
      // Check file permissions (may vary by system)
      expect(stats.mode & 0o777).toBe(0o600)
    })
  })

  describe('error handling', () => {
    test('should provide meaningful error messages', async () => {
      // Try to save to a location that will fail
      const badAdapter = new FilesystemAdapter({
        contentDir: '/root/forbidden', // Typically inaccessible
        createDirs: false
      })

      await expect(badAdapter.saveDocument('posts', 'test', sampleBlogPost))
        .rejects.toThrow(/Failed to save document/)
    })

    test('should handle filesystem errors gracefully', async () => {
      await adapter.saveDocument('posts', 'test-post', sampleBlogPost)

      // Make the file read-only then try to update
      const filePath = path.join(contentDir, 'posts', 'test-post.json')
      await fs.chmod(filePath, 0o444)

      await expect(adapter.saveDocument('posts', 'test-post', { ...sampleBlogPost, title: 'Updated' }))
        .rejects.toThrow(/Failed to save document/)

      // Restore permissions for cleanup
      await fs.chmod(filePath, 0o644)
    })
  })
})