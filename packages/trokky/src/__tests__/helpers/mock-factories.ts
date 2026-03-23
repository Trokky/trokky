/**
 * Mock factories for common test objects
 */

export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-test-001',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-test-001',
    _type: 'article',
    title: 'Test Document',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockSchema(overrides: Record<string, unknown> = {}) {
  return {
    name: 'article',
    title: 'Article',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'body', type: 'string' },
    ],
    ...overrides,
  }
}
