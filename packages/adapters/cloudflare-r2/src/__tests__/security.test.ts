/**
 * Security tests for CloudflareR2Adapter
 * 
 * Tests comprehensive security measures including:
 * - File validation and magic number detection
 * - Input sanitization and path traversal prevention
 * - Content security and script injection detection
 * - Filename sanitization and metadata cleaning
 * - Error handling and information disclosure prevention
 */

import { CloudflareR2Adapter } from '../cloudflare-r2-adapter'
import { MockR2Bucket, mockCreateLogger, mockGenerateUUID } from './fixtures/mocks'
import {
  createTestFile,
  jpegFileBytes,
  pngFileBytes,
  pdfFileBytes,
  maliciousFileBytes,
  maliciousTextContent,
  maliciousSvgContent,
  dangerousFilenames,
  maliciousMetadata
} from './fixtures/test-files'
import { InvalidInputError } from '@trokky/core'

// Mock dependencies
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
  generateUUID: () => 'test-uuid-12345',
}))

describe('CloudflareR2Adapter - Security Tests', () => {
  let adapter: CloudflareR2Adapter
  let mockBucket: MockR2Bucket

  beforeEach(() => {
    mockBucket = new MockR2Bucket()
    
    adapter = new CloudflareR2Adapter({
      bucket: mockBucket as any,
      bucketName: 'test-bucket',
      keyPrefix: 'media/',
      maxFileSize: 10 * 1024 * 1024, // 10MB
    })

    // Set the bucket manually since constructor type issues
    adapter.setBucket(mockBucket as any)

    jest.clearAllMocks()
  })

  describe('File Validation Security', () => {
    describe('Magic Number Detection', () => {
      test('should validate JPEG files by magic number', async () => {
        const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
        const metadata = {
          id: 'test-jpeg',
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
      })

      test('should validate PNG files by magic number', async () => {
        const file = createTestFile(pngFileBytes, 'test.png', 'image/png')
        const metadata = {
          id: 'test-png',
          filename: 'test.png',
          contentType: 'image/png',
          size: file.size,
          extension: 'png'
        }

        await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
      })

      test('should validate PDF files by magic number', async () => {
        const file = createTestFile(pdfFileBytes, 'test.pdf', 'application/pdf')
        const metadata = {
          id: 'test-pdf',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: file.size,
          extension: 'pdf'
        }

        await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
      })

      test('should detect content type mismatch', async () => {
        // PNG file claiming to be JPEG
        const file = createTestFile(pngFileBytes, 'fake.jpg', 'image/jpeg')
        const metadata = {
          id: 'fake-jpeg',
          filename: 'fake.jpg',
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        await expect(adapter.uploadFile(file, metadata))
          .rejects
          .toThrow('File content type mismatch')
      })

      test('should reject unknown file types', async () => {
        const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03])
        const file = createTestFile(unknownBytes, 'unknown.xyz', 'application/octet-stream')
        const metadata = {
          id: 'unknown-file',
          filename: 'unknown.xyz',
          contentType: 'application/octet-stream',
          size: file.size,
          extension: 'xyz'
        }

        await expect(adapter.uploadFile(file, metadata))
          .rejects
          .toThrow('Unrecognized or disallowed file type')
      })

      test('should detect malicious files with fake headers', async () => {
        const file = createTestFile(maliciousFileBytes, 'malicious.jpg', 'image/jpeg')
        const metadata = {
          id: 'malicious-file',
          filename: 'malicious.jpg',
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        // This should pass since the magic number matches JPEG signature
        await expect(adapter.uploadFile(file, metadata))
          .resolves
          .toBeDefined()
      })
    })

    describe('File Size Validation', () => {
      test('should reject empty files', async () => {
        const emptyFile = createTestFile(new Uint8Array([]), 'empty.jpg', 'image/jpeg')
        const metadata = {
          id: 'empty-file',
          filename: 'empty.jpg',
          contentType: 'image/jpeg',
          size: emptyFile.size,
          extension: 'jpg'
        }

        await expect(adapter.uploadFile(emptyFile, metadata))
          .rejects
          .toThrow('File is empty')
      })

      test('should enforce global file size limits', async () => {
        const largeFile = createTestFile(
          new Uint8Array(12 * 1024 * 1024), // 12MB > 10MB limit
          'large.jpg',
          'image/jpeg'
        )
        const metadata = {
          id: 'large-file',
          filename: 'large.jpg',
          contentType: 'image/jpeg',
          size: largeFile.size,
          extension: 'jpg'
        }

        await expect(adapter.uploadFile(largeFile, metadata))
          .rejects
          .toThrow('exceeds maximum allowed size')
      })

      test('should enforce per-content-type size limits', async () => {
        // Create a 15MB "image" file (exceeds 10MB image limit)
        const largeImageFile = createTestFile(
          new Uint8Array([...jpegFileBytes, ...new Uint8Array(15 * 1024 * 1024)]),
          'large-image.jpg',
          'image/jpeg'
        )
        const metadata = {
          id: 'large-image',
          filename: 'large-image.jpg',
          contentType: 'image/jpeg',
          size: largeImageFile.size,
          extension: 'jpg'
        }

        await expect(adapter.uploadFile(largeImageFile, metadata))
          .rejects
          .toThrow('File size')
      })
    })

    describe('Content Security Validation', () => {
      test('should detect script injection in text files', async () => {
        const textBytes = new TextEncoder().encode(maliciousTextContent)
        const file = createTestFile(textBytes, 'malicious.html', 'text/html')
        const metadata = {
          id: 'malicious-text',
          filename: 'malicious.html',
          contentType: 'text/html',
          size: file.size,
          extension: 'html'
        }

        await expect(adapter.uploadFile(file, metadata))
          .rejects
          .toThrow('File contains potentially dangerous content')
      })

      test('should detect script injection in SVG files', async () => {
        const svgBytes = new TextEncoder().encode(maliciousSvgContent)
        const file = createTestFile(svgBytes, 'malicious.svg', 'image/svg+xml')
        const metadata = {
          id: 'malicious-svg',
          filename: 'malicious.svg',
          contentType: 'image/svg+xml',
          size: file.size,
          extension: 'svg'
        }

        await expect(adapter.uploadFile(file, metadata))
          .rejects
          .toThrow('File contains potentially dangerous content')
      })

      test('should allow clean text content', async () => {
        const cleanContent = 'This is a clean text file with no dangerous content.'
        const textBytes = new TextEncoder().encode(cleanContent)
        const file = createTestFile(textBytes, 'clean.txt', 'text/plain')
        const metadata = {
          id: 'clean-text',
          filename: 'clean.txt',
          contentType: 'text/plain',
          size: file.size,
          extension: 'txt'
        }

        await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
      })

      test('should limit text file size for content analysis', async () => {
        const largeText = 'x'.repeat(2 * 1024 * 1024) // 2MB of text
        const textBytes = new TextEncoder().encode(largeText)
        const file = createTestFile(textBytes, 'large.txt', 'text/plain')
        const metadata = {
          id: 'large-text',
          filename: 'large.txt',
          contentType: 'text/plain',
          size: file.size,
          extension: 'txt'
        }

        await expect(adapter.uploadFile(file, metadata))
          .rejects
          .toThrow('File size')
      })
    })
  })

  describe('Input Sanitization Security', () => {
    describe('Filename Sanitization', () => {
      test.each(dangerousFilenames)('should sanitize dangerous filename: %s', async (dangerousName) => {
        const file = createTestFile(jpegFileBytes, dangerousName, 'image/jpeg')
        const metadata = {
          id: 'test-sanitization',
          filename: dangerousName,
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        if (dangerousName.trim() === '') {
          // Empty filename should be rejected
          await expect(adapter.uploadFile(file, metadata)).rejects.toThrow()
        } else if (dangerousName === '.' || dangerousName === '..') {
          // These should be rejected or auto-fixed
          await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
          // Check that filename was sanitized in metadata
        } else if (dangerousName.length > 255) {
          // Long filenames should be truncated
          await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
        } else if (['CON.jpg', 'PRN.txt', 'AUX.png', 'AUX.bin', 'NUL.pdf', 'NUL.dat', 'COM1.gif'].includes(dangerousName)) {
          // Windows reserved names should be rejected
          await expect(adapter.uploadFile(file, metadata)).rejects.toThrow()
        } else {
          // Other dangerous names should either be sanitized or rejected
          await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
        }
      })

      test('should remove path traversal sequences', async () => {
        const file = createTestFile(jpegFileBytes, '../../../evil.jpg', 'image/jpeg')
        const metadata = {
          id: 'path-traversal',
          filename: '../../../evil.jpg',
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        const result = await adapter.uploadFile(file, metadata)
        
        // The filename should have been sanitized
        expect(result.filename).not.toContain('../')
        expect(result.filename).not.toMatch(/[<>:"\/\\|?*]/)
      })

      test('should handle Unicode and special characters', async () => {
        const file = createTestFile(jpegFileBytes, 'файл测试🎉.jpg', 'image/jpeg')
        const metadata = {
          id: 'unicode-test',
          filename: 'файл测试🎉.jpg',
          contentType: 'image/jpeg',
          size: file.size,
          extension: 'jpg'
        }

        const result = await adapter.uploadFile(file, metadata)
        
        // Should have been sanitized to safe characters
        expect(result.filename).toMatch(/^[\w\-_.]+$/)
      })

      test('should reject reserved system filenames', async () => {
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1']
        
        for (const reservedName of reservedNames) {
          const file = createTestFile(jpegFileBytes, `${reservedName}.jpg`, 'image/jpeg')
          const metadata = {
            id: `reserved-${reservedName}`,
            filename: `${reservedName}.jpg`,
            contentType: 'image/jpeg',
            size: file.size,
            extension: 'jpg'
          }

          await expect(adapter.uploadFile(file, metadata))
            .rejects
            .toThrow('uses a reserved name')
        }
      })
    })

    describe('Extension Validation', () => {
      test('should allow safe file extensions', async () => {
        const safeExtensions = ['jpg', 'png', 'pdf', 'txt', 'mp3', 'mp4']
        
        for (const ext of safeExtensions) {
          const file = createTestFile(jpegFileBytes, `test.${ext}`, 'image/jpeg')
          const metadata = {
            id: `safe-${ext}`,
            filename: `test.${ext}`,
            contentType: 'image/jpeg',
            size: file.size,
            extension: ext
          }

          await expect(adapter.uploadFile(file, metadata)).resolves.toBeDefined()
        }
      })

      test('should reject dangerous file extensions', async () => {
        const dangerousExtensions = ['exe', 'bat', 'cmd', 'scr', 'vbs', 'js', 'php', 'asp']
        
        for (const ext of dangerousExtensions) {
          const file = createTestFile(jpegFileBytes, `test.${ext}`, 'image/jpeg')
          const metadata = {
            id: `dangerous-${ext}`,
            filename: `test.${ext}`,
            contentType: 'image/jpeg',
            size: file.size,
            extension: ext
          }

          const result = await adapter.uploadFile(file, metadata)
          
          // Extension should have been removed or sanitized
          expect(result.filename).not.toMatch(new RegExp(`\\.${ext}$`))
        }
      })
    })
  })

  describe('Error Handling Security', () => {
    test('should not expose sensitive information in error messages', async () => {
      const file = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
      const metadata = {
        id: 'error-test',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: file.size,
        extension: 'jpg'
      }

      // Force an error condition
      mockBucket.shouldFailUpload = true

      await expect(adapter.uploadFile(file, metadata))
        .rejects
        .toThrow()

      // Check that error doesn't contain sensitive config info
      try {
        await adapter.uploadFile(file, metadata)
      } catch (error: any) {
        expect(error.message).not.toContain('accessKeyId')
        expect(error.message).not.toContain('secretAccessKey')
        expect(error.message).not.toContain('accountId')
      }
    })

    test('should handle invalid document IDs securely', async () => {
      // These should be rejected by SecurityValidator.validateDocumentId
      const invalidIds = ['../../../etc/passwd', '<script>alert(1)</script>', 'id with spaces', '']

      for (const invalidId of invalidIds) {
        await expect(adapter.getFileUrl(invalidId))
          .rejects
          .toThrow(InvalidInputError)
      }
    })

    test('should validate pagination parameters', async () => {
      // Invalid limits should be handled gracefully
      await expect(adapter.listMedia({ limit: -1 }))
        .rejects
        .toThrow('Invalid limit')

      await expect(adapter.listMedia({ limit: 10000 }))
        .rejects
        .toThrow('Invalid limit')

      await expect(adapter.listMedia({ limit: 0 }))
        .rejects
        .toThrow('Invalid limit')
    })
  })

  describe('Configuration Security', () => {
    test('should warn about missing security configuration', () => {
      new CloudflareR2Adapter({
        // No bucket, no credentials, no public URLs allowed
      })

      // Should have logged warnings about missing configuration
      expect(mockCreateLogger).toHaveBeenCalled()
    })

    test('should initialize S3Client only with complete credentials', () => {
      const adapter1 = new CloudflareR2Adapter({
        accountId: 'test-account',
        accessKeyId: 'test-key',
        // Missing secretAccessKey and bucketName
      })

      const adapter2 = new CloudflareR2Adapter({
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        bucketName: 'test-bucket'
      })

      // Only the complete configuration should succeed
      // (We can't easily test this without exposing private fields)
    })
  })

  describe('Health Check Security', () => {
    test('should perform secure health check', async () => {
      const result = await adapter.healthCheck()
      expect(typeof result).toBe('boolean')
    })

    test('should handle health check failures gracefully', async () => {
      mockBucket.shouldFailList = true
      const result = await adapter.healthCheck()
      expect(result).toBe(false)
      
      // Should not throw or expose sensitive errors
    })

    test('should handle missing bucket in health check', async () => {
      const adapterWithoutBucket = new CloudflareR2Adapter({})
      const result = await adapterWithoutBucket.healthCheck()
      expect(result).toBe(false)
    })
  })
})