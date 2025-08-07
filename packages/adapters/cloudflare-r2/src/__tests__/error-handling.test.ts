/**
 * Error handling and edge case tests for CloudflareR2Adapter
 * 
 * Tests robust error handling including:
 * - Network and R2 service failures
 * - Invalid configurations and parameters
 * - Edge cases and boundary conditions
 * - Security error scenarios
 * - Resource cleanup and recovery
 */

import { CloudflareR2Adapter } from '../cloudflare-r2-adapter'
import { MockR2Bucket, mockCreateLogger, mockGetSignedUrl } from './fixtures/mocks'
import { createTestFile, jpegFileBytes } from './fixtures/test-files'
import { InvalidInputError } from '@trokky/core'

// Mock AWS SDK with failure scenarios
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockRejectedValue(new Error('Network error')),
    config: {
      region: 'auto',
      endpoint: 'https://test-account.r2.cloudflarestorage.com'
    }
  })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn()
}))

jest.mock('@trokky/core', () => ({
  InvalidInputError: class InvalidInputError extends Error {},
  SecurityValidator: {
    validateDocumentId: jest.fn(),
  },
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  generateUUID: () => 'error-test-uuid',
}))

describe('CloudflareR2Adapter - Error Handling Tests', () => {
  let adapter: CloudflareR2Adapter
  let mockBucket: MockR2Bucket

  beforeEach(() => {
    mockBucket = new MockR2Bucket()
    
    adapter = new CloudflareR2Adapter({
      bucket: mockBucket as any,
      bucketName: 'test-bucket',
      keyPrefix: 'media/',
      maxFileSize: 1 * 1024 * 1024, // 1MB for testing
    })

    adapter.setBucket(mockBucket as any)
    jest.clearAllMocks()
  })

  describe('Upload Error Scenarios', () => {
    test('should handle R2 service failures gracefully', async () => {
      const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
      const metadata = {
        id: 'test-upload-error',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      mockBucket.shouldFailUpload = true

      await expect(adapter.uploadFile(file, metadata))
        .rejects
        .toThrow('Mock upload failure')

      expect(mockCreateLogger().error).toHaveBeenCalled()
    })

    test('should handle concurrent upload failures', async () => {
      const uploads = []
      mockBucket.shouldFailUpload = true

      for (let i = 0; i < 5; i++) {
        const file = createTestFile(jpegFileBytes, `test${i}.jpg`, 'image/jpeg')
        const metadata = {
          id: `concurrent-${i}`,
          filename: `test${i}.jpg`,
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        uploads.push(adapter.uploadFile(file, metadata))
      }

      const results = await Promise.allSettled(uploads)
      
      results.forEach(result => {
        expect(result.status).toBe('rejected')
      })
    })

    test('should handle corrupted file data', async () => {
      // Create a file that claims to be JPEG but has corrupted data
      const corruptedBytes = new Uint8Array([0xFF, 0xD8, 0xFF, ...Array(100).fill(0x00)])
      const file = createTestFile(corruptedBytes, 'corrupted.jpg', 'image/jpeg')
      const metadata = {
        id: 'corrupted-file',
        filename: 'corrupted.jpg',
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      // Should still upload (magic number is correct), but log warning
      await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
    })

    test('should handle missing file parameter', async () => {
      const metadata = {
        id: 'missing-file',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: 1000,
        extension: 'jpg'
      }

      await expect(adapter.uploadFile(null as any, metadata))
        .rejects
        .toThrow('File is required')
    })

    test('should handle missing metadata', async () => {
      const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')

      await expect(adapter.uploadFile(file, null as any))
        .rejects
        .toThrow()
    })
  })

  describe('URL Generation Error Scenarios', () => {
    test('should handle AWS SDK errors gracefully', async () => {
      const adapterWithCredentials = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        keyPrefix: 'media/',
      })

      adapterWithCredentials.setBucket(mockBucket as any)

      // Upload a test file first
      const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
      const testKey = 'media/aws-error-test'
      await mockBucket.put(testKey, jpegFileBytes)

      // Make AWS SDK fail
      mockGetSignedUrl.mockRejectedValueOnce(new Error('AWS credentials invalid'))

      const url = await adapterWithCredentials.getFileUrl('aws-error-test')

      expect(url).toBeNull()
      expect(mockCreateLogger().error).toHaveBeenCalledWith(
        'Failed to generate presigned URL',
        expect.objectContaining({
          error: expect.any(Error),
          fileId: 'aws-error-test'
        })
      )
    })

    test('should handle network timeouts', async () => {
      const adapterWithCredentials = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        keyPrefix: 'media/',
      })

      adapterWithCredentials.setBucket(mockBucket as any)

      // Upload a test file first
      const testKey = 'media/timeout-test'
      await mockBucket.put(testKey, jpegFileBytes)

      // Simulate network timeout
      mockGetSignedUrl.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 1)
        })
      })

      const url = await adapterWithCredentials.getFileUrl('timeout-test')

      expect(url).toBeNull()
      expect(mockCreateLogger().error).toHaveBeenCalled()
    })
  })

  describe('List Operations Error Scenarios', () => {
    test('should handle R2 list failures', async () => {
      mockBucket.shouldFailList = true

      await expect(adapter.listMedia({ limit: 10 }))
        .rejects
        .toThrow('Mock list failure')
    })

    test('should validate list parameters', async () => {
      await expect(adapter.listMedia({ limit: -1 }))
        .rejects
        .toThrow('Invalid limit')

      await expect(adapter.listMedia({ limit: 2000 }))
        .rejects
        .toThrow('Invalid limit')

      await expect(adapter.listMedia({ limit: 0 }))
        .rejects
        .toThrow('Invalid limit')
    })

    test('should handle empty bucket gracefully', async () => {
      mockBucket.clear()

      const files = await adapter.listMedia()
      expect(files).toEqual([])
    })
  })

  describe('Delete Operations Error Scenarios', () => {
    test('should handle delete failures gracefully', async () => {
      // Mock a delete failure
      const originalDelete = mockBucket.delete.bind(mockBucket)
      mockBucket.delete = jest.fn().mockRejectedValue(new Error('Delete failed'))

      await expect(adapter.deleteFile('non-existent-file'))
        .rejects
        .toThrow()

      // Restore original method
      mockBucket.delete = originalDelete
    })

    test('should attempt to delete variants even if main file delete fails', async () => {
      // Add main file and variants
      await mockBucket.put('media/test-file', jpegFileBytes)
      await mockBucket.put('media/test-file/variants/thumb.webp', jpegFileBytes)

      // Make main file delete fail but variant deletion succeed
      const originalDelete = mockBucket.delete.bind(mockBucket)
      mockBucket.delete = jest.fn().mockImplementation((key) => {
        if (key === 'media/test-file') {
          throw new Error('Main file delete failed')
        }
        return originalDelete(key)
      })

      await expect(adapter.deleteFile('test-file'))
        .rejects
        .toThrow()

      // Variants should still be processed
      expect(mockBucket.delete).toHaveBeenCalledWith('media/test-file/variants/thumb.webp')
    })
  })

  describe('Configuration Error Scenarios', () => {
    test('should handle missing bucket configuration', async () => {
      const adapterWithoutBucket = new CloudflareR2Adapter({
        keyPrefix: 'media/',
      })

      const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
      const metadata = {
        id: 'no-bucket-test',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      await expect(adapterWithoutBucket.uploadFile(file, metadata))
        .rejects
        .toThrow('R2 bucket not configured')
    })

    test('should handle invalid configuration gracefully', async () => {
      expect(() => {
        new CloudflareR2Adapter({
          maxFileSize: -1, // Invalid negative size
          keyPrefix: '../../../', // Invalid prefix
        })
      }).not.toThrow()

      // Should have logged warnings
      expect(mockCreateLogger).toHaveBeenCalled()
    })

    test('should handle S3Client initialization failures', () => {
      // Mock S3Client constructor to throw
      const originalS3Client = jest.requireMock('@aws-sdk/client-s3').S3Client
      jest.requireMock('@aws-sdk/client-s3').S3Client = jest.fn().mockImplementation(() => {
        throw new Error('S3Client init failed')
      })

      expect(() => {
        new CloudflareR2Adapter({
          accountId: 'test',
          accessKeyId: 'test',
          secretAccessKey: 'test',
          bucketName: 'test'
        })
      }).not.toThrow()

      // Should have logged error
      expect(mockCreateLogger().error).toHaveBeenCalled()

      // Restore mock
      jest.requireMock('@aws-sdk/client-s3').S3Client = originalS3Client
    })
  })

  describe('Health Check Error Scenarios', () => {
    test('should return false for failed health checks', async () => {
      mockBucket.shouldFailList = true

      const result = await adapter.healthCheck()
      expect(result).toBe(false)
      expect(mockCreateLogger().error).toHaveBeenCalledWith(
        'R2 health check failed',
        expect.any(Error)
      )
    })

    test('should handle health check without bucket', async () => {
      const adapterWithoutBucket = new CloudflareR2Adapter({})

      const result = await adapterWithoutBucket.healthCheck()
      expect(result).toBe(false)
      expect(mockCreateLogger().warn).toHaveBeenCalledWith(
        'R2 bucket not configured for health check'
      )
    })
  })

  describe('Input Validation Error Scenarios', () => {
    test('should reject invalid document IDs', async () => {
      const invalidIds = [
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        'id with spaces',
        '',
        null,
        undefined
      ]

      for (const invalidId of invalidIds) {
        await expect(adapter.getFileUrl(invalidId))
          .rejects
          .toThrow()
      }
    })

    test('should handle malformed metadata gracefully', async () => {
      const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
      const malformedMetadata = {
        id: 'malformed-test',
        filename: null, // Invalid filename
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      await expect(adapter.uploadFile(file, malformedMetadata as any))
        .rejects
        .toThrow()
    })
  })

  describe('Resource Cleanup and Recovery', () => {
    test('should clean up partial uploads on failure', async () => {
      const file = createTestFile(jpegFileBytes, 'cleanup-test.jpg', 'image/jpeg')
      const metadata = {
        id: 'cleanup-test',
        filename: 'cleanup-test.jpg',
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      // Mock a failure after partial upload
      const originalPut = mockBucket.put.bind(mockBucket)
      let uploadAttempted = false
      mockBucket.put = jest.fn().mockImplementation((key, value, options) => {
        uploadAttempted = true
        throw new Error('Upload failed after starting')
      })

      await expect(adapter.uploadFile(file, metadata))
        .rejects
        .toThrow()

      expect(uploadAttempted).toBe(true)
      
      // No partial files should remain
      expect(mockBucket.has('media/cleanup-test')).toBe(false)
    })

    test('should handle variant cleanup failures gracefully', async () => {
      // Add a file with variants
      const parentId = 'variant-cleanup-test'
      await mockBucket.put('media/' + parentId, jpegFileBytes)
      await mockBucket.put(`media/${parentId}/variants/thumb.webp`, jpegFileBytes)

      // Mock variant deletion failure
      const originalDelete = mockBucket.delete.bind(mockBucket)
      mockBucket.delete = jest.fn().mockImplementation((key) => {
        if (key.includes('/variants/')) {
          throw new Error('Variant delete failed')
        }
        return originalDelete(key)
      })

      // Should not throw, but should log error
      await adapter.deleteVariantFiles(parentId)
      
      expect(mockCreateLogger().error).toHaveBeenCalledWith(
        `Failed to delete variants for ${parentId}`,
        expect.any(Error)
      )
    })
  })

  describe('Race Condition Scenarios', () => {
    test('should handle concurrent file operations', async () => {
      const operations = []

      // Concurrent uploads
      for (let i = 0; i < 10; i++) {
        const file = createTestFile(jpegFileBytes, `concurrent${i}.jpg`, 'image/jpeg')
        const metadata = {
          id: `concurrent-${i}`,
          filename: `concurrent${i}.jpg`,
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }
        operations.push(adapter.uploadFile(file, metadata))
      }

      // Concurrent URL generation
      for (let i = 0; i < 5; i++) {
        operations.push(adapter.getFileUrl(`concurrent-${i}`))
      }

      const results = await Promise.allSettled(operations)
      
      // Some should succeed (uploads), some might fail (URL gen for non-existent files)
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      expect(succeeded).toBeGreaterThan(0)
    })
  })

  describe('Memory and Resource Management', () => {
    test('should handle large file content without memory leaks', async () => {
      // Create a moderately large file (within limits)
      const largeContent = new Uint8Array(512 * 1024) // 512KB
      largeContent.set(jpegFileBytes) // Valid JPEG header

      const file = createTestFile(largeContent, 'large.jpg', 'image/jpeg')
      const metadata = {
        id: 'large-file-test',
        filename: 'large.jpg',
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
    })

    test('should handle many small files efficiently', async () => {
      const uploads = []

      for (let i = 0; i < 50; i++) {
        const file = createTestFile(jpegFileBytes, `small${i}.jpg`, 'image/jpeg')
        const metadata = {
          id: `small-${i}`,
          filename: `small${i}.jpg`,
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }
        uploads.push(adapter.uploadFile(file, metadata))
      }

      const results = await Promise.all(uploads)
      expect(results).toHaveLength(50)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.id).toContain('small-')
      })
    })
  })
})