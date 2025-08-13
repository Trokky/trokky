/**
 * Mock implementations for testing
 */

import type { R2Bucket } from '@cloudflare/workers-types'

// Mock R2Bucket implementation
export class MockR2Bucket implements Partial<R2Bucket> {
  private storage = new Map<string, any>()
  public shouldFailHealthCheck = false
  public shouldFailUpload = false
  public shouldFailList = false

  async put(key: string, value: any, options?: any): Promise<any> {
    if (this.shouldFailUpload) {
      throw new Error('Mock upload failure')
    }

    this.storage.set(key, {
      key,
      value,
      options,
      size: value?.byteLength || value?.length || 0,
      uploaded: new Date(),
      customMetadata: options?.metadata || {},
      httpMetadata: {
        contentType: options?.contentType || 'application/octet-stream'
      }
    })

    return {
      key,
      size: value?.byteLength || value?.length || 0,
      etag: 'mock-etag',
      httpMetadata: {
        contentType: options?.contentType || 'application/octet-stream'
      },
      customMetadata: options?.metadata || {},
      uploaded: new Date()
    }
  }

  async get(key: string): Promise<any> {
    const item = this.storage.get(key)
    if (!item) return null

    return {
      ...item,
      arrayBuffer: () => Promise.resolve(item.value),
      text: () => Promise.resolve(new TextDecoder().decode(item.value)),
      blob: () => Promise.resolve(new Blob([item.value]))
    }
  }

  async head(key: string): Promise<any> {
    const item = this.storage.get(key)
    if (!item) return null

    return {
      key: item.key,
      size: item.size,
      etag: 'mock-etag',
      httpMetadata: item.httpMetadata,
      customMetadata: item.customMetadata,
      uploaded: item.uploaded
    }
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<any> {
    if (this.shouldFailList) {
      throw new Error('Mock list failure')
    }

    const prefix = options?.prefix || ''
    const limit = options?.limit || 1000

    const objects = Array.from(this.storage.values())
      .filter(item => item.key.startsWith(prefix))
      .slice(0, limit)

    return {
      objects: objects.map(item => ({
        key: item.key,
        size: item.size,
        etag: 'mock-etag',
        httpMetadata: item.httpMetadata,
        customMetadata: item.customMetadata,
        uploaded: item.uploaded
      })),
      truncated: false,
      cursor: undefined
    }
  }

  // Helper methods for testing
  clear(): void {
    this.storage.clear()
  }

  has(key: string): boolean {
    return this.storage.has(key)
  }

  size(): number {
    return this.storage.size
  }
}

// Mock S3Client for presigned URL testing
export const mockS3Client = {
  send: jest.fn(),
  config: {
    region: 'auto',
    endpoint: 'https://test-account.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key'
    }
  }
}

// Mock getSignedUrl function
export const mockGetSignedUrl = jest.fn()

// Mock successful presigned URL generation
mockGetSignedUrl.mockImplementation(async (client, command, options) => {
  const bucket = command.input.Bucket
  const key = command.input.Key
  const expiresIn = options?.expiresIn || 3600
  
  // Simulate AWS SDK behavior
  return `https://${bucket}.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test&X-Amz-Date=20241201T000000Z&X-Amz-Expires=${expiresIn}&X-Amz-Signature=mockSignature`
})

// Mock logger to capture log messages
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Create mock createLogger function
export const mockCreateLogger = jest.fn().mockReturnValue(mockLogger)

// Mock generateUUID function
export const mockGenerateUUID = jest.fn().mockReturnValue('mock-uuid-12345')

export default {
  MockR2Bucket,
  mockS3Client,
  mockGetSignedUrl,
  mockLogger,
  mockCreateLogger,
  mockGenerateUUID,
}