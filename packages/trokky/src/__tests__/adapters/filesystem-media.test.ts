import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FilesystemMediaAdapter } from '../../adapters/filesystem-media/filesystem-media-adapter.js'
import { generateUUID } from '../../core/utils/universal-crypto.js'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

describe('FilesystemMediaAdapter', () => {
  let adapter: FilesystemMediaAdapter
  let tempDir: string
  let mediaDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-media-test-'))
    mediaDir = path.join(tempDir, 'media')
    await fs.ensureDir(mediaDir)
    await fs.ensureDir(path.join(mediaDir, 'files'))
    await fs.ensureDir(path.join(mediaDir, 'metadata'))
    await fs.ensureDir(path.join(mediaDir, 'variants'))

    adapter = new FilesystemMediaAdapter({ mediaDir })
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  describe('healthCheck', () => {
    it('should return true when dirs exist', async () => {
      const result = await adapter.healthCheck()
      expect(result).toBe(true)
    })
  })

  describe('file upload and retrieval', () => {
    it('should upload a file and return metadata', async () => {
      const fileContent = Buffer.from('fake image content')
      const file = new File([fileContent], 'photo.jpg', { type: 'image/jpeg' })
      const id = generateUUID()

      const result = await adapter.uploadFile(file, {
        id: id,
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        extension: 'jpg',
        size: fileContent.length,
      })

      expect(result).toBeDefined()
      expect(result.id).toBe(id)
      expect(result.filename).toBe('photo.jpg')
      expect(result.contentType).toBe('image/jpeg')
    })

    it('should retrieve uploaded file metadata', async () => {
      const fileContent = Buffer.from('test content')
      const file = new File([fileContent], 'doc.pdf', { type: 'application/pdf' })
      const id = generateUUID()

      await adapter.uploadFile(file, {
        id: id,
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        extension: 'pdf',
        size: fileContent.length,
      })

      const retrieved = await adapter.getFile(id)
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(id)
      expect(retrieved!.filename).toBe('doc.pdf')
    })

    it('should return null for non-existent file', async () => {
      const result = await adapter.getFile('nonexistent-id')
      expect(result).toBeNull()
    })

    it('should retrieve file content as ArrayBuffer', async () => {
      const originalContent = 'Hello, this is file content!'
      const fileContent = Buffer.from(originalContent)
      const file = new File([fileContent], 'text.txt', { type: 'text/plain' })
      const id = generateUUID()

      await adapter.uploadFile(file, {
        id: id,
        filename: 'text.txt',
        contentType: 'text/plain',
        extension: 'txt',
        size: fileContent.length,
      })

      const content = await adapter.getFileContent(id)
      expect(content).toBeDefined()
      expect(content).toBeInstanceOf(ArrayBuffer)

      const text = Buffer.from(content!).toString('utf-8')
      expect(text).toBe(originalContent)
    })
  })

  describe('file listing', () => {
    it('should list uploaded files', async () => {
      for (let i = 0; i < 3; i++) {
        const file = new File([Buffer.from(`content-${i}`)], `file-${i}.txt`, { type: 'text/plain' })
        await adapter.uploadFile(file, {
          id: generateUUID(),
          filename: `file-${i}.txt`,
          contentType: 'text/plain',
        extension: 'txt',
          size: 10,
        })
      }

      const result = await adapter.listMedia()
      expect(result.items.length).toBe(3)
      expect(result.total).toBe(3)
    })

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        const file = new File([Buffer.from(`c-${i}`)], `f-${i}.txt`, { type: 'text/plain' })
        await adapter.uploadFile(file, {
          id: generateUUID(),
          filename: `f-${i}.txt`,
          contentType: 'text/plain',
        extension: 'txt',
          size: 5,
        })
      }

      const page1 = await adapter.listMedia({ limit: 2 })
      expect(page1.items.length).toBe(2)
    })

    it('should return empty list when no files exist', async () => {
      const result = await adapter.listMedia()
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('file deletion', () => {
    it('should delete an uploaded file', async () => {
      const file = new File([Buffer.from('to delete')], 'delete-me.txt', { type: 'text/plain' })
      const id = generateUUID()

      await adapter.uploadFile(file, {
        id: id,
        filename: 'delete-me.txt',
        contentType: 'text/plain',
        extension: 'txt',
        size: 9,
      })

      await adapter.deleteFile(id)

      const result = await adapter.getFile(id)
      expect(result).toBeNull()
    })
  })

  describe('file metadata update', () => {
    it.skip('should update file metadata', async () => {
      const file = new File([Buffer.from('content')], 'original.txt', { type: 'text/plain' })
      const id = generateUUID()

      await adapter.uploadFile(file, {
        id: id,
        filename: 'original.txt',
        contentType: 'text/plain',
        extension: 'txt',
        size: 7,
      })

      const updated = await adapter.updateFile(id, {
        alt: 'Updated alt text',
      })

      expect(updated.metadata?.alt || (updated as any).alt).toBe('Updated alt text')
    })
  })

  describe('variants', () => {
    it.skip('should save and retrieve variant content', async () => {
      const file = new File([Buffer.from('image data')], 'photo.jpg', { type: 'image/jpeg' })
      const id = generateUUID()

      await adapter.uploadFile(file, {
        id: id,
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        extension: 'jpg',
        size: 10,
      })

      const variantData = Buffer.from('thumbnail data')
      const variantPath = await adapter.saveVariantFile(id, 'thumbnail', variantData, 'webp')
      expect(variantPath).toBeDefined()

      const content = await adapter.getVariantContent(id, 'thumbnail')
      expect(content).toBeDefined()
      expect(Buffer.from(content!).toString()).toBe('thumbnail data')
    })

    it('should return null for non-existent variant', async () => {
      const content = await adapter.getVariantContent('nonexistent', 'thumbnail')
      expect(content).toBeNull()
    })
  })
})
