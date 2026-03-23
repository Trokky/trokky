/**
 * Mock TrokkyCore for route testing
 *
 * Provides a minimal mock that satisfies TrokkyRoutes constructor
 * with controllable return values for each method.
 */

import { vi } from 'vitest'
import type { TrokkyCore } from '../../core/index.js'

const mockUser = {
  id: 'user-001',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin' as const,
  permissions: ['content:read', 'content:write', 'content:delete', 'media:read', 'media:upload', 'users:read', 'users:write'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockSession = {
  userId: 'user-001',
  username: 'admin',
  role: 'admin' as const,
  permissions: mockUser.permissions,
  loginAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-02T00:00:00Z',
}

const mockDocument = {
  id: 'doc-001',
  _type: 'article',
  title: 'Test Article',
  body: 'Test body',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
}

export function createMockCore(overrides: Record<string, unknown> = {}): TrokkyCore {
  const schemas = [
    {
      name: 'article',
      title: 'Article',
      type: 'document',
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'string' },
        { name: 'published', type: 'boolean' },
      ],
    },
  ]

  const core = {
    // Schema methods
    getSchema: vi.fn((name: string) => schemas.find(s => s.name === name) || null),
    getAllSchemas: vi.fn(() => schemas),
    validateDocument: vi.fn(() => ({ valid: true, errors: [] })),

    // Document CRUD
    getDocument: vi.fn(async () => ({ ...mockDocument })),
    saveDocument: vi.fn(async (_col: string, data: any) => ({
      id: data.id || 'doc-new',
      _type: _col,
      ...data,
      _createdAt: '2026-01-01T00:00:00Z',
      _updatedAt: '2026-01-01T00:00:00Z',
    })),
    listDocuments: vi.fn(async () => [mockDocument]),
    deleteDocument: vi.fn(async () => undefined),

    // Auth
    authenticateUser: vi.fn(async () => ({
      type: 'success',
      user: mockUser,
      token: 'jwt-token-123',
      refreshToken: 'refresh-token-123',
      expiresAt: '2026-01-02T00:00:00Z',
    })),
    verifyAuthToken: vi.fn(async () => mockSession),
    verifyAnyToken: vi.fn(async () => mockSession),
    refreshAuthToken: vi.fn(async () => ({
      token: 'new-jwt-token',
      refreshToken: 'new-refresh-token',
      user: mockUser,
      expiresAt: '2026-01-02T00:00:00Z',
    })),
    generateAuthToken: vi.fn(async () => 'jwt-token-123'),
    hashPassword: vi.fn(async () => '$2b$12$hashedpassword'),
    verifyPassword: vi.fn(async () => true),

    // User management
    getUser: vi.fn(async () => mockUser),
    getUserByUsername: vi.fn(async () => mockUser),
    getUserByEmail: vi.fn(async () => mockUser),
    createUser: vi.fn(async (data: any) => ({ ...mockUser, ...data, id: 'user-new' })),
    updateUser: vi.fn(async (_id: string, data: any) => ({ ...mockUser, ...data })),
    listUsers: vi.fn(async () => [mockUser]),
    deleteUser: vi.fn(async () => undefined),

    // Media
    uploadMedia: vi.fn(async () => ({
      _id: 'media-001',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    })),
    getMedia: vi.fn(async () => ({
      _id: 'media-001',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    })),
    listMedia: vi.fn(async () => ({
      items: [],
      total: 0,
      hasMore: false,
    })),
    deleteMedia: vi.fn(async () => undefined),
    getMediaContent: vi.fn(async () => Buffer.from('fake-content')),
    getImageUrl: vi.fn(() => '/media/media-001'),

    // Events
    events: { emitEvent: vi.fn(async () => 'evt-1') },
    getEventBus: vi.fn(() => ({ emitEvent: vi.fn() })),

    // Security
    checkRateLimit: vi.fn(async () => undefined),
    isCaptchaConfigured: vi.fn(() => false),
    isCaptchaRequiredFor: vi.fn(() => false),
    isOAuthConfigured: vi.fn(() => false),
    isPasskeyConfigured: vi.fn(() => false),

    // Settings
    getSettings: vi.fn(async () => null),

    // App tokens
    getAppToken: vi.fn(async () => null),
    listAppTokens: vi.fn(async () => []),
    createAppToken: vi.fn(async () => ({ token: { id: 'token-1' }, plainTextToken: 'tky_abc123' })),
    deleteAppToken: vi.fn(async () => undefined),
    validateAppToken: vi.fn(async () => ({ valid: false })),

    // Webhooks
    getDocumentAuditLogs: vi.fn(async () => []),
    getCollectionAuditLogs: vi.fn(async () => []),

    // Storage adapters
    getDataStorageAdapter: vi.fn(() => ({})),
    getMediaStorageAdapter: vi.fn(() => ({})),

    // Misc
    logAuditEvent: vi.fn(),
    configuration: { schemas },

    ...overrides,
  }

  return core as unknown as TrokkyCore
}

export { mockUser, mockSession, mockDocument }
