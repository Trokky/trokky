import { describe, it, expect } from 'vitest'
import type {
  BaseDocument,
  User,
  MediaAsset,
  HttpRequest,
  HttpResponse,
  ContentSchema,
  SlugifyOptions,
  MailAdapter,
  MailMessage,
  MailResult,
  PasskeyCredential,
  AppToken,
} from '../../types/index.js'

/**
 * Type contract tests
 *
 * These tests verify that key interfaces maintain their expected shape.
 * They catch accidental breaking changes to public API types by ensuring
 * objects conforming to the interface have the required properties.
 *
 * We test at runtime by creating conforming objects and verifying their
 * structure — this catches both type regressions and runtime assumptions.
 */

describe('type contracts', () => {
  describe('BaseDocument', () => {
    it('should accept a valid document with required fields', () => {
      const doc: BaseDocument = {
        id: 'doc-001',
        _type: 'article',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      expect(doc.id).toBe('doc-001')
      expect(doc._type).toBe('article')
      expect(doc.createdAt).toBeDefined()
      expect(doc.updatedAt).toBeDefined()
    })

    it('should allow additional content fields', () => {
      const doc: BaseDocument = {
        id: 'doc-002',
        _type: 'article',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        title: 'My Article',
        body: 'Content here',
        tags: ['news', 'tech'],
      }
      expect((doc as Record<string, unknown>).title).toBe('My Article')
      expect((doc as Record<string, unknown>).tags).toEqual(['news', 'tech'])
    })
  })

  describe('User', () => {
    it('should require essential user fields', () => {
      const user: User = {
        id: 'user-001',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      expect(user.id).toBe('user-001')
      expect(user.username).toBe('admin')
      expect(user.email).toBe('admin@example.com')
      expect(user.role).toBe('admin')
    })

    it('should accept all valid roles', () => {
      const roles: User['role'][] = ['admin', 'editor', 'viewer']
      for (const role of roles) {
        const user: User = {
          id: 'user-001',
          username: 'test',
          email: 'test@example.com',
          role,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }
        expect(user.role).toBe(role)
      }
    })
  })

  describe('MediaAsset', () => {
    it('should require core media fields', () => {
      const asset: MediaAsset = {
        _id: 'media-001',
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 102400,
        createdAt: '2026-01-01T00:00:00Z',
      }
      expect(asset._id).toBe('media-001')
      expect(asset.filename).toBe('photo.jpg')
      expect(asset.mimeType).toBe('image/jpeg')
      expect(asset.size).toBe(102400)
    })
  })

  describe('HttpRequest', () => {
    it('should represent a framework-agnostic request', () => {
      const req: HttpRequest = {
        method: 'GET',
        path: '/api/documents',
        headers: { authorization: 'Bearer token123' },
        query: { page: '1', limit: '10' },
        params: {},
        body: undefined,
      }
      expect(req.method).toBe('GET')
      expect(req.path).toBe('/api/documents')
      expect(req.headers.authorization).toBe('Bearer token123')
      expect(req.query?.page).toBe('1')
    })

    it('should support POST with body', () => {
      const req: HttpRequest = {
        method: 'POST',
        path: '/api/documents',
        headers: { 'content-type': 'application/json' },
        params: { collection: 'article' },
        body: { title: 'New Article', body: 'Content' },
      }
      expect(req.method).toBe('POST')
      expect(req.body.title).toBe('New Article')
      expect(req.params.collection).toBe('article')
    })
  })

  describe('HttpResponse', () => {
    it('should represent a framework-agnostic response', () => {
      const res: HttpResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { data: [{ id: '1', title: 'Doc' }] },
      }
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
    })

    it('should represent error responses', () => {
      const res: HttpResponse = {
        status: 404,
        headers: {},
        body: { error: 'Not found', code: 'NOT_FOUND' },
      }
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not found')
    })
  })

  describe('AppToken', () => {
    it('should represent an API token', () => {
      const token: AppToken = {
        id: 'token-001',
        name: 'CI/CD Pipeline',
        token: 'tky_abc123',
        permissions: ['content:read', 'content:write'],
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'user-001',
      }
      expect(token.id).toBe('token-001')
      expect(token.name).toBe('CI/CD Pipeline')
      expect(token.permissions).toContain('content:read')
    })
  })

  describe('PasskeyCredential', () => {
    it('should represent a WebAuthn credential', () => {
      const cred: PasskeyCredential = {
        credentialId: 'cred-abc123',
        publicKey: 'base64-public-key',
        counter: 0,
        deviceName: 'MacBook Pro',
        createdAt: '2026-01-01T00:00:00Z',
        lastUsedAt: '2026-01-01T00:00:00Z',
        transports: ['internal'],
      }
      expect(cred.credentialId).toBe('cred-abc123')
      expect(cred.counter).toBe(0)
      expect(cred.transports).toContain('internal')
    })
  })

  describe('MailAdapter interface contract', () => {
    it('should define send method', () => {
      // Verify the interface shape by creating a mock implementation
      const mockAdapter: MailAdapter = {
        name: 'test-adapter',
        send: async (message: MailMessage): Promise<MailResult> => {
          return {
            success: true,
            messageId: 'msg-001',
          }
        },
      }
      expect(mockAdapter.name).toBe('test-adapter')
      expect(typeof mockAdapter.send).toBe('function')
    })
  })

  describe('SlugifyOptions', () => {
    it('should define slugification configuration', () => {
      const options: SlugifyOptions = {
        lowercase: true,
        separator: '-',
        maxLength: 100,
        allowedChars: 'a-z0-9',
      }
      expect(options.lowercase).toBe(true)
      expect(options.separator).toBe('-')
      expect(options.maxLength).toBe(100)
    })
  })
})
