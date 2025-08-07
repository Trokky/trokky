/**
 * Basic tests for CloudflareR2Adapter to verify setup
 */

import { CloudflareR2Adapter } from '../cloudflare-r2-adapter'

// Mock all dependencies
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/s3-request-presigner')
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

describe('CloudflareR2Adapter - Basic Tests', () => {
  test('should instantiate without throwing', () => {
    expect(() => {
      new CloudflareR2Adapter({
        keyPrefix: 'test/',
      })
    }).not.toThrow()
  })

  test('should instantiate with full configuration', () => {
    expect(() => {
      new CloudflareR2Adapter({
        bucketName: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        keyPrefix: 'media/',
        maxFileSize: 10 * 1024 * 1024,
        allowPublicUrls: false,
        defaultUrlExpiry: 3600,
        maxUrlExpiry: 86400,
      })
    }).not.toThrow()
  })

  test('should have required methods', () => {
    const adapter = new CloudflareR2Adapter()
    
    expect(typeof adapter.uploadFile).toBe('function')
    expect(typeof adapter.getFile).toBe('function')
    expect(typeof adapter.getFileUrl).toBe('function')
    expect(typeof adapter.listMedia).toBe('function')
    expect(typeof adapter.deleteFile).toBe('function')
    expect(typeof adapter.healthCheck).toBe('function')
    expect(typeof adapter.saveVariantFile).toBe('function')
    expect(typeof adapter.getVariantUrl).toBe('function')
    expect(typeof adapter.deleteVariantFiles).toBe('function')
  })

  test('should handle health check without bucket', async () => {
    const adapter = new CloudflareR2Adapter()
    
    const result = await adapter.healthCheck()
    expect(result).toBe(false)
  })
})