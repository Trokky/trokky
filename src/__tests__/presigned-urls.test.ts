/**
 * Presigned URL security tests for CloudflareR2Adapter
 * 
 * Tests secure URL generation including:
 * - Proper presigned URL generation with AWS SDK
 * - Expiration time validation and limits
 * - Fallback to public URLs with security warnings
 * - Credential handling and error scenarios
 * - URL format validation and security
 */

import { CloudflareR2Adapter } from '../cloudflare-r2-adapter.js'
import { MockR2Bucket, mockCreateLogger, mockGetSignedUrl } from './fixtures/mocks.js'
import { createTestFile, jpegFileBytes } from './fixtures/test-files.js'

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    config: {
      region: 'auto',
      endpoint: 'https://test-account.r2.cloudflarestorage.com'
    }
  })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}))

jest.mock('@trokky/core', () => ({
  ...jest.requireActual('@trokky/core'),
  createLogger: mockCreateLogger,
  generateUUID: () => 'test-uuid-12345',
}))

describe('CloudflareR2Adapter - Presigned URL Tests', () => {
  let adapter: CloudflareR2Adapter
  let mockBucket: MockR2Bucket

  beforeEach(() => {
    mockBucket = new MockR2Bucket()
    
    // First upload a test file
    const testFile = createTestFile(jpegFileBytes, 'test.jpg', 'image/jpeg')
    const testKey = 'media/test-file-id'
    mockBucket.put(testKey, jpegFileBytes, {
      contentType: 'image/jpeg',
      metadata: { originalFilename: 'test.jpg' }
    })

    jest.clearAllMocks()
    mockGetSignedUrl.mockClear()
  })

  describe('Presigned URL Generation', () => {
    test('should generate presigned URL with complete configuration', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
        defaultUrlExpiry: 3600, // 1 hour
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test-file-id?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600'
      )

      const url = await adapter.getFileUrl('test-file-id')

      expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256')
      expect(url).toContain('X-Amz-Expires=3600')
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // S3Client
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'media/test-file-id'
          }
        }),
        { expiresIn: 3600 }
      )
    })

    test('should use custom expiration time', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test-file-id?X-Amz-Expires=7200'
      )

      const url = await adapter.getFileUrl('test-file-id', { expiresIn: 7200 }) // 2 hours

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 7200 }
      )
    })

    test('should enforce minimum expiration time', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test-file-id?X-Amz-Expires=60'
      )

      const url = await adapter.getFileUrl('test-file-id', { expiresIn: 30 }) // Below 60s minimum

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 60 } // Should be capped to minimum
      )
    })

    test('should enforce maximum expiration time', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
        maxUrlExpiry: 3600, // 1 hour max
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test-file-id?X-Amz-Expires=3600'
      )

      const url = await adapter.getFileUrl('test-file-id', { expiresIn: 7200 }) // 2 hours, above max

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 } // Should be capped to maximum
      )
    })

    test('should validate expiration parameter types', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
        defaultUrlExpiry: 1800, // 30 minutes
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test-file-id?X-Amz-Expires=1800'
      )

      // Should fall back to default for invalid expiration
      const url = await adapter.getFileUrl('test-file-id', { expiresIn: 'invalid' as any })

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 1800 } // Should use default
      )
    })
  })

  describe('Fallback to Public URLs', () => {
    test('should fall back to public URL when presigned fails', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
        allowPublicUrls: true,
        customDomain: 'media.example.com'
      })

      adapter.setBucket(mockBucket as any)

      // Make presigned URL generation fail
      mockGetSignedUrl.mockRejectedValueOnce(new Error('AWS SDK error'))

      const url = await adapter.getFileUrl('test-file-id')

      expect(url).toBe('https://media.example.com/media/test-file-id')
      expect(mockCreateLogger().warn).toHaveBeenCalledWith(
        'Using public URL fallback - reduced security',
        { fileId: 'test-file-id' }
      )
    })

    test('should require both allowPublicUrls and customDomain for public URLs', async () => {
      // Only allowPublicUrls, no customDomain
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
        allowPublicUrls: true,
        // customDomain missing
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockRejectedValueOnce(new Error('AWS SDK error'))

      const url = await adapter.getFileUrl('test-file-id')

      expect(url).toBeNull()
      expect(mockCreateLogger().error).toHaveBeenCalledWith(
        'No URL generation method available',
        expect.objectContaining({
          fileId: 'test-file-id',
          allowPublicUrls: true,
          hasCustomDomain: false
        })
      )
    })

    test('should warn about security implications of public URLs', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        allowPublicUrls: true,
        customDomain: 'cdn.example.com',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      const url = await adapter.getFileUrl('test-file-id')

      expect(url).toBe('https://cdn.example.com/media/test-file-id')
      expect(mockCreateLogger().warn).toHaveBeenCalledWith(
        'Using public URL fallback - reduced security',
        { fileId: 'test-file-id' }
      )
    })
  })

  describe('Configuration Security', () => {
    test('should not generate URLs without proper configuration', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        keyPrefix: 'media/',
        // No credentials or public URL config
      })

      adapter.setBucket(mockBucket as any)

      const url = await adapter.getFileUrl('test-file-id')

      expect(url).toBeNull()
      expect(mockCreateLogger().error).toHaveBeenCalledWith(
        'No URL generation method available',
        expect.objectContaining({
          hasS3Client: false,
          allowPublicUrls: undefined,
          hasCustomDomain: false
        })
      )
    })

    test('should warn about missing configuration at initialization', () => {
      new CloudflareR2Adapter({
        bucket: mockBucket as any,
        // Missing presigned URL credentials and public URL config
      })

      expect(mockCreateLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining('No S3Client configured and public URLs disabled')
      )
    })

    test('should require complete credentials for S3Client', () => {
      // Missing bucketName
      new CloudflareR2Adapter({
        bucket: mockBucket as any,
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        // bucketName missing
      })

      // Should not initialize S3Client without complete credentials
      expect(mockCreateLogger().warn).toHaveBeenCalled()
    })
  })

  describe('File Existence Check', () => {
    test('should return null for non-existent files', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      const url = await adapter.getFileUrl('non-existent-file')

      expect(url).toBeNull()
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    test('should check file existence before generating presigned URL', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test-file-id?signature=valid'
      )

      const url = await adapter.getFileUrl('test-file-id')

      expect(url).toBeDefined()
      expect(mockGetSignedUrl).toHaveBeenCalled()
    })
  })

  describe('Variant URL Generation', () => {
    beforeEach(() => {
      // Add a variant file
      mockBucket.put('media/parent-id/variants/thumbnail.webp', jpegFileBytes, {
        contentType: 'image/webp'
      })
    })

    test('should generate presigned URLs for variants', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        bucketName: 'test-bucket',
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/parent-id/variants/thumbnail.webp?signature=valid'
      )

      const url = await adapter.getVariantUrl('parent-id', 'thumbnail')

      expect(url).toContain('thumbnail.webp')
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'media/parent-id/variants/thumbnail.webp'
          }
        }),
        { expiresIn: 3600 }
      )
    })

    test('should fall back to public URLs for variants', async () => {
      adapter = new CloudflareR2Adapter({
        bucket: mockBucket as any,
        allowPublicUrls: true,
        customDomain: 'cdn.example.com',
        keyPrefix: 'media/',
      })

      adapter.setBucket(mockBucket as any)

      const url = await adapter.getVariantUrl('parent-id', 'thumbnail')

      expect(url).toBe('https://cdn.example.com/media/parent-id/variants/thumbnail.webp')
    })
  })
})