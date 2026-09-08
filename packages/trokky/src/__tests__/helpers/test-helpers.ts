/**
 * Shared helpers for core service, auth and routes integration tests.
 *
 * Provides in-memory implementations of the v2 DataStorageAdapter and
 * MediaStorageAdapter interfaces plus factories for a real TrokkyCore /
 * TrokkyRoutes pair. Nothing here touches the filesystem or the network.
 */

import { TrokkyCore } from '../../core/core/engine.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'
import { TrokkyRoutes } from '../../routes/index.js'
import type { RoutesConfig } from '../../routes/types.js'
import type {
  AppToken,
  AppTokenListOptions,
  AuditContext,
  AuditLog,
  ContentSchema,
  CreateAppTokenData,
  CreateUserData,
  DataStorageAdapter,
  Document,
  DocumentData,
  ListOptions,
  MediaFile,
  MediaListOptions,
  MediaListResult,
  MediaMetadata,
  MediaStorageAdapter,
  SettingsConfig,
  TrokkyConfig,
  UpdateAppTokenData,
  UpdateUserData,
  User,
  UserListOptions
} from '../../core/types/index.js'
import type { WebhookConfig } from '../../core/events/types.js'
import type { HttpMethod, HttpRequest, HttpResponse } from '../../types/index.js'

/** Keep PBKDF2 cheap so password-heavy tests stay fast and deterministic. */
export const TEST_PBKDF2_ITERATIONS = 1000

export const TEST_JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!'

/**
 * In-memory DataStorageAdapter for tests.
 */
export class MemoryDataAdapter implements DataStorageAdapter {
  private documents = new Map<string, Map<string, Document>>()
  private users = new Map<string, User>()
  private tokens = new Map<string, AppToken>()
  private auditLogs: AuditLog[] = []
  private webhooks = new Map<string, WebhookConfig>()
  private settings: SettingsConfig | null = null

  // Document operations
  async getDocument(collection: string, id: string): Promise<Document | null> {
    return this.documents.get(collection)?.get(id) ?? null
  }

  async saveDocument(
    collection: string,
    id: string,
    data: DocumentData,
    _auditContext?: AuditContext
  ): Promise<Document> {
    let collectionDocs = this.documents.get(collection)
    if (!collectionDocs) {
      collectionDocs = new Map<string, Document>()
      this.documents.set(collection, collectionDocs)
    }
    const existing = collectionDocs.get(id)
    const now = new Date()
    const doc: Document = {
      ...(data as Record<string, unknown>),
      id,
      _collection: collection,
      _createdAt: existing?._createdAt ?? now,
      _updatedAt: now,
      _revision: (existing?._revision ?? 0) + 1
    }
    collectionDocs.set(id, doc)
    return doc
  }

  async listDocuments(collection: string, options?: ListOptions): Promise<Document[]> {
    const collectionDocs = this.documents.get(collection)
    if (!collectionDocs) return []
    let docs = Array.from(collectionDocs.values())

    if (options?.filter) {
      const filter = options.filter
      docs = docs.filter(doc =>
        Object.entries(filter).every(
          ([key, value]) => (doc as unknown as Record<string, unknown>)[key] === value
        )
      )
    }

    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100
    return docs.slice(offset, offset + limit)
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    this.documents.get(collection)?.delete(id)
  }

  async documentExists(collection: string, id: string): Promise<boolean> {
    return this.documents.get(collection)?.has(id) ?? false
  }

  async countDocuments(collection: string, filter?: Record<string, unknown>): Promise<number> {
    const docs = await this.listDocuments(collection, { filter, limit: Number.MAX_SAFE_INTEGER })
    return docs.length
  }

  // User operations
  async getUser(id: string): Promise<User | null> {
    const user = this.users.get(id)
    return user ? { ...user } : null
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.username === username)
    return user ? { ...user } : null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.email === email)
    return user ? { ...user } : null
  }

  async saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User> {
    const existing = this.users.get(id)
    const patch = userData as Partial<User>
    const now = new Date().toISOString()
    const user: User = {
      username: '',
      email: '',
      role: 'viewer',
      passwordHash: '',
      firstName: '',
      lastName: '',
      permissions: [],
      isActive: true,
      createdAt: existing?.createdAt ?? now,
      ...existing,
      ...patch,
      id,
      updatedAt: now
    }
    this.users.set(id, user)
    return { ...user }
  }

  async listUsers(options?: UserListOptions): Promise<User[]> {
    let users = Array.from(this.users.values())
    if (options?.role) {
      users = users.filter(u => u.role === options.role)
    }
    if (options?.isActive !== undefined) {
      users = users.filter(u => u.isActive === options.isActive)
    }
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100
    return users.slice(offset, offset + limit).map(u => ({ ...u }))
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id)
  }

  // App token operations
  async getAppToken(id: string): Promise<AppToken | null> {
    const token = this.tokens.get(id)
    return token ? { ...token } : null
  }

  async getAppTokenByHash(hash: string): Promise<AppToken | null> {
    const token = Array.from(this.tokens.values()).find(t => t.tokenHash === hash)
    return token ? { ...token } : null
  }

  async saveAppToken(
    id: string,
    tokenData: CreateAppTokenData | Partial<UpdateAppTokenData>
  ): Promise<AppToken> {
    const existing = this.tokens.get(id)
    const patch = tokenData as Partial<AppToken>
    const now = new Date().toISOString()
    const token: AppToken = {
      name: '',
      tokenHash: '',
      permissions: [],
      createdBy: '',
      isActive: true,
      createdAt: existing?.createdAt ?? now,
      ...existing,
      ...patch,
      id,
      updatedAt: now
    }
    this.tokens.set(id, token)
    return { ...token }
  }

  async listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]> {
    let tokens = Array.from(this.tokens.values())
    if (options?.createdBy) {
      tokens = tokens.filter(t => t.createdBy === options.createdBy)
    }
    if (options?.isActive !== undefined) {
      tokens = tokens.filter(t => t.isActive === options.isActive)
    }
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100
    return tokens.slice(offset, offset + limit).map(t => ({ ...t }))
  }

  async deleteAppToken(id: string): Promise<void> {
    this.tokens.delete(id)
  }

  // Audit log operations
  async createAuditLog(auditLog: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const created: AuditLog = { ...auditLog, id: `audit-${this.auditLogs.length + 1}` }
    this.auditLogs.push(created)
    return created
  }

  async getDocumentAuditLogs(
    documentId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLog[]> {
    return this.sliceLogs(
      this.auditLogs.filter(l => l.documentId === documentId),
      options
    )
  }

  async getCollectionAuditLogs(
    collection: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLog[]> {
    return this.sliceLogs(
      this.auditLogs.filter(l => l.collection === collection),
      options
    )
  }

  async getActorAuditLogs(
    actorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLog[]> {
    return this.sliceLogs(
      this.auditLogs.filter(l => l.actorId === actorId),
      options
    )
  }

  private sliceLogs(logs: AuditLog[], options?: { limit?: number; offset?: number }): AuditLog[] {
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100
    return logs.slice(offset, offset + limit)
  }

  // Webhook operations
  async getWebhook(id: string): Promise<WebhookConfig | null> {
    return this.webhooks.get(id) ?? null
  }

  async saveWebhook(id: string, webhookData: Partial<WebhookConfig>): Promise<WebhookConfig> {
    const existing = this.webhooks.get(id)
    const webhook = { ...existing, ...webhookData, id } as WebhookConfig
    this.webhooks.set(id, webhook)
    return webhook
  }

  async listWebhooks(): Promise<WebhookConfig[]> {
    return Array.from(this.webhooks.values())
  }

  async deleteWebhook(id: string): Promise<void> {
    this.webhooks.delete(id)
  }

  // Settings operations
  async getSettings(): Promise<SettingsConfig | null> {
    return this.settings
  }

  async saveSettings(settings: SettingsConfig): Promise<void> {
    this.settings = settings
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  clear(): void {
    this.documents.clear()
    this.users.clear()
    this.tokens.clear()
    this.webhooks.clear()
    this.auditLogs = []
    this.settings = null
  }
}

/**
 * In-memory MediaStorageAdapter for tests.
 */
export class MemoryMediaAdapter implements MediaStorageAdapter {
  private media = new Map<string, { file: MediaFile; content: ArrayBuffer }>()
  private variants = new Map<string, Map<string, { buffer: Buffer; format: string }>>()
  private counter = 0

  async uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile> {
    const id = metadata.id || `media-${++this.counter}`
    const content = await file.arrayBuffer()
    const mediaFile: MediaFile = {
      id,
      filename: metadata.filename || file.name,
      contentType: metadata.contentType || file.type,
      size: metadata.size ?? file.size,
      url: `/media/${id}`,
      metadata: { ...metadata },
      _createdAt: new Date()
    }
    this.media.set(id, { file: mediaFile, content })
    return mediaFile
  }

  async getFile(id: string): Promise<MediaFile | null> {
    return this.media.get(id)?.file ?? null
  }

  async getFileContent(id: string): Promise<ArrayBuffer | null> {
    return this.media.get(id)?.content ?? null
  }

  async updateFile(id: string, metadata: Record<string, unknown>): Promise<MediaFile> {
    const existing = this.media.get(id)
    if (!existing) throw new Error(`Media not found: ${id}`)
    existing.file.metadata = { ...existing.file.metadata, ...metadata }
    return existing.file
  }

  async deleteFile(id: string): Promise<void> {
    this.media.delete(id)
    this.variants.delete(id)
  }

  async listMedia(options?: MediaListOptions): Promise<MediaListResult> {
    const items = Array.from(this.media.values()).map(m => m.file)
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100
    return { items: items.slice(offset, offset + limit), total: items.length }
  }

  async saveVariantFile(
    parentId: string,
    variantName: string,
    buffer: Buffer,
    format: string
  ): Promise<string> {
    let parentVariants = this.variants.get(parentId)
    if (!parentVariants) {
      parentVariants = new Map<string, { buffer: Buffer; format: string }>()
      this.variants.set(parentId, parentVariants)
    }
    parentVariants.set(variantName, { buffer, format })
    return `${parentId}/${variantName}`
  }

  async getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null> {
    const variant = this.variants.get(parentId)?.get(variantName)
    if (!variant) return null
    const { buffer } = variant
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  }

  async deleteVariantFiles(parentId: string): Promise<void> {
    this.variants.delete(parentId)
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  clear(): void {
    this.media.clear()
    this.variants.clear()
  }
}

/**
 * Record-shaped content schemas matching v2's ContentSchema definition.
 * (The array-shaped fixtures in __tests__/fixtures/schemas.ts are only usable
 * with the mock core, not with a real SchemaRegistry.)
 */
export const testSchemas: ContentSchema[] = [
  {
    name: 'posts',
    type: 'document',
    title: 'Posts',
    description: 'Blog posts',
    fields: {
      title: { type: 'string', required: true },
      content: { type: 'string' },
      status: { type: 'string' }
    }
  },
  {
    name: 'authors',
    type: 'document',
    title: 'Authors',
    description: 'Post authors',
    fields: {
      name: { type: 'string', required: true },
      email: { type: 'string' }
    }
  },
  {
    name: 'settings',
    type: 'singleton',
    title: 'Site Settings',
    singleton: true,
    description: 'Global site settings',
    fields: {
      siteName: { type: 'string' },
      tagline: { type: 'string' }
    }
  }
]

export interface TestCoreOptions {
  schemas?: ContentSchema[]
  jwtSecret?: string
  enableSecurity?: boolean
}

export interface TestCoreContext {
  core: TrokkyCore
  dataAdapter: MemoryDataAdapter
  mediaAdapter: MemoryMediaAdapter
}

/**
 * Build a real TrokkyCore backed by the in-memory adapters.
 */
export function createTestCore(options?: TestCoreOptions): TestCoreContext {
  const dataAdapter = new MemoryDataAdapter()
  const mediaAdapter = new MemoryMediaAdapter()

  const config: TrokkyConfig = {
    storage: { adapter: 'memory', options: {} },
    schemas: options?.schemas ?? testSchemas
  }

  const core = new TrokkyCore(
    config,
    { data: dataAdapter, media: mediaAdapter },
    {
      jwtSecret: options?.jwtSecret ?? TEST_JWT_SECRET,
      enableSecurity: options?.enableSecurity ?? true,
      enableEvents: false,
      // Injected explicitly so tests do not depend on runtime adapter detection
      cryptoAdapter: new WebCryptoAdapter({ pbkdf2Iterations: TEST_PBKDF2_ITERATIONS })
    }
  )

  return { core, dataAdapter, mediaAdapter }
}

export interface TestUserInput {
  username?: string
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  role?: 'admin' | 'editor' | 'viewer'
}

/**
 * Create a user through the core (password is hashed by the crypto adapter).
 */
export async function createTestUser(core: TrokkyCore, userData?: TestUserInput): Promise<User> {
  return core.createUser({
    username: userData?.username ?? 'testuser',
    email: userData?.email ?? 'testuser@example.com',
    password: userData?.password ?? 'TestPassword123!',
    firstName: userData?.firstName ?? 'Test',
    lastName: userData?.lastName ?? 'User',
    role: userData?.role ?? 'editor'
  })
}

export interface TestRoutesContext extends TestCoreContext {
  routes: TrokkyRoutes
}

/**
 * Build a real TrokkyCore + TrokkyRoutes pair mounted at /api.
 */
export async function createTestRoutes(options?: TestCoreOptions): Promise<TestRoutesContext> {
  const { core, dataAdapter, mediaAdapter } = createTestCore(options)
  await core.init()

  const routesConfig: RoutesConfig = {
    core,
    basePath: '/api',
    authentication: {
      enabled: true,
      publicPaths: ['/api/health', '/api/auth/login', '/api/auth/validate', '/api/auth/refresh']
    }
  }

  return { routes: new TrokkyRoutes(routesConfig), core, dataAdapter, mediaAdapter }
}

/**
 * Create a user and issue a real JWT for it.
 */
export async function createAuthenticatedUser(
  core: TrokkyCore,
  userData?: TestUserInput
): Promise<{ user: User; token: string }> {
  const user = await createTestUser(core, userData)
  const token = await core.generateAuthToken(user)
  return { user, token }
}

export interface MockRequestOptions {
  method: string
  path: string
  headers?: Record<string, string>
  body?: unknown
  query?: Record<string, string>
}

export function createMockRequest(options: MockRequestOptions): HttpRequest {
  return {
    method: options.method as HttpMethod,
    url: options.path,
    path: options.path,
    headers: options.headers ?? {},
    body: options.body,
    query: options.query ?? {},
    params: {}
  }
}

/**
 * Resolve a route through the registrar and invoke its handler with params.
 */
export async function executeRoute(
  routes: TrokkyRoutes,
  request: HttpRequest
): Promise<HttpResponse> {
  const route = routes.findRoute(request.method, request.path)
  if (!route) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: { message: 'Route not found' } })
    }
  }

  const params = routes.extractParams(route.path, request.path)
  return route.handler({ ...request, params })
}

export interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  error?: { message?: string; code?: string } | string
  [key: string]: unknown
}

export function parseResponseBody<T = unknown>(response: HttpResponse): ApiEnvelope<T> {
  if (typeof response.body === 'string') {
    return JSON.parse(response.body) as ApiEnvelope<T>
  }
  return response.body as ApiEnvelope<T>
}
