/**
 * The first-boot claim is how a one-click deployment gets its first administrator without a
 * password baked into the template — which would mean every Trokky on the internet sharing one
 * default credential.
 *
 * It is also, by necessity, an unauthenticated endpoint that creates an admin account, so every
 * guard on it is tested here: it works exactly once, it is closed the moment any user exists, and
 * when a claim secret is configured nothing gets through without it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserService, type UserServiceDependencies } from '../../core/services/user-service.js'
import type { User } from '../../core/types/index.js'

function makeService(options: { claimSecret?: string; users?: User[]; weak?: boolean; noAtomicCreate?: boolean } = {}) {
  const users: User[] = [...(options.users ?? [])]
  let nextId = users.length + 1

  const dataStorage = {
    listUsers: vi.fn(async ({ limit }: { limit?: number } = {}) => users.slice(0, limit ?? users.length)),
    getUserByUsername: vi.fn(async (username: string) => users.find(u => u.username === username) ?? null),
    getUserByEmail: vi.fn(async (email: string) => users.find(u => u.email === email) ?? null),
    saveUser: vi.fn(async (id: string, data: Record<string, unknown>) => {
      const user = { id, ...data } as unknown as User
      users.push(user)
      return user
    }),
    deleteUser: vi.fn(async (id: string) => {
      const index = users.findIndex(u => u.id === id)
      if (index >= 0) users.splice(index, 1)
    }),
    getUser: vi.fn(async (id: string) => users.find(u => u.id === id) ?? null),
    // Models the adapter contract: check and write are one step, and it is honoured exactly once.
    createFirstUser: options.noAtomicCreate ? undefined : vi.fn(async (id: string, data: Record<string, unknown>) => {
      if (users.length > 0) return null
      const user = { id, ...data } as unknown as User
      users.push(user)
      return user
    })
  } as unknown as UserServiceDependencies['dataStorage']

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }

  const service = new UserService({
    logger: logger as never,
    dataStorage,
    idGenerator: { generate: () => `user_${nextId++}` } as never,
    securityEnabled: true,
    eventBus: { emitEvent: vi.fn().mockResolvedValue(undefined) } as never,
    hashPassword: async password => `hashed:${password}`,
    checkWeakPassword: () => (options.weak ? { isWeak: true, reason: 'too short' } : { isWeak: false }),
    logAuditEvent: vi.fn(),
    getUserCreatedWithPasswordCallback: () => undefined,
    claimSecret: () => options.claimSecret
  })

  return { service, users, logger }
}

const validClaim = {
  username: 'amenophis',
  email: 'owner@example.org',
  password: 'a-long-enough-password-9!',
}

describe('first-boot claim', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('status', () => {
    it('reports an empty instance as claimable', async () => {
      const { service } = makeService()
      expect(await service.getClaimStatus()).toEqual({ claimable: true, secretRequired: false })
    })

    it('says a secret is required when one is configured', async () => {
      const { service } = makeService({ claimSecret: 'deploy-token' })
      expect(await service.getClaimStatus()).toEqual({ claimable: true, secretRequired: true })
    })

    it('reports an instance with any user as already claimed', async () => {
      const { service } = makeService({ users: [{ id: 'user_1', username: 'someone' } as User] })
      expect(await service.getClaimStatus()).toMatchObject({ claimable: false, reason: 'already-claimed' })
    })
  })

  describe('claiming', () => {
    it('creates an administrator on an empty instance', async () => {
      const { service, users } = makeService()

      const admin = await service.claimInstance(validClaim)

      expect(admin.username).toBe('amenophis')
      expect(admin.role).toBe('admin')
      expect(admin.permissions).toContain('studio:access')
      expect(admin.permissions).toContain('users:write')
      expect(users).toHaveLength(1)
    })

    it('closes permanently once claimed', async () => {
      const { service } = makeService()

      await service.claimInstance(validClaim)

      expect(await service.getClaimStatus()).toMatchObject({ claimable: false, reason: 'already-claimed' })
      await expect(service.claimInstance({ ...validClaim, username: 'intruder', email: 'i@example.org' }))
        .rejects.toThrow('already been claimed')
    })

    it('refuses on an instance that already has an unrelated user', async () => {
      // Not just "an admin exists" — any account at all means someone can sign in and own this.
      const { service } = makeService({ users: [{ id: 'user_1', username: 'editor', role: 'editor' } as User] })

      await expect(service.claimInstance(validClaim)).rejects.toThrow('already been claimed')
    })

    it('requires every field a real account needs', async () => {
      const { service } = makeService()

      await expect(service.claimInstance({ ...validClaim, email: '' })).rejects.toThrow()
      await expect(service.claimInstance({ ...validClaim, username: '' })).rejects.toThrow()
    })
  })

  describe('claim secret', () => {
    it('rejects a claim with no secret when one is configured', async () => {
      const { service, users } = makeService({ claimSecret: 'deploy-token' })

      await expect(service.claimInstance(validClaim)).rejects.toThrow('Incorrect claim secret')
      expect(users).toHaveLength(0)
    })

    it('rejects a wrong secret', async () => {
      const { service, users } = makeService({ claimSecret: 'deploy-token' })

      await expect(service.claimInstance({ ...validClaim, secret: 'guess' })).rejects.toThrow('Incorrect claim secret')
      expect(users).toHaveLength(0)
    })

    it('rejects a secret that is merely a prefix of the real one', async () => {
      const { service } = makeService({ claimSecret: 'deploy-token' })

      await expect(service.claimInstance({ ...validClaim, secret: 'deploy' })).rejects.toThrow('Incorrect claim secret')
    })

    it('accepts the right secret', async () => {
      const { service, users } = makeService({ claimSecret: 'deploy-token' })

      const admin = await service.claimInstance({ ...validClaim, secret: 'deploy-token' })

      expect(admin.role).toBe('admin')
      expect(users).toHaveLength(1)
    })

    it('leaves the instance claimable after a rejected attempt', async () => {
      // A failed guess must not lock the real owner out of their own instance.
      const { service } = makeService({ claimSecret: 'deploy-token' })

      await expect(service.claimInstance({ ...validClaim, secret: 'wrong' })).rejects.toThrow()

      expect(await service.getClaimStatus()).toMatchObject({ claimable: true, secretRequired: true })
      await expect(service.claimInstance({ ...validClaim, secret: 'deploy-token' })).resolves.toBeDefined()
    })
  })

  describe('concurrent claims', () => {
    it('leaves exactly one administrator when claims race', async () => {
      const { service, users } = makeService()

      const results = await Promise.allSettled([
        service.claimInstance({ ...validClaim, username: 'first', email: 'first@example.org' }),
        service.claimInstance({ ...validClaim, username: 'second', email: 'second@example.org' }),
        service.claimInstance({ ...validClaim, username: 'third', email: 'third@example.org' })
      ])

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
      expect(users).toHaveLength(1)
      // Exactly-once is the adapter's atomic create; the losers are told the instance is claimed.
      for (const lost of results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]) {
        expect(String(lost.reason)).toContain('already been claimed')
      }
    })
  })

  describe('hardening', () => {
    it('refuses a weak password, unlike the env bootstrap which only warns', async () => {
      const { service, users } = makeService({ weak: true })

      await expect(service.claimInstance({ ...validClaim, password: 'password' })).rejects.toThrow('too weak')
      expect(users).toHaveLength(0)
    })

    it('is unclaimable on an adapter without an atomic first-user create', async () => {
      // A racy fallback would be worse than refusing: the adapter must implement the primitive.
      const { service } = makeService({ noAtomicCreate: true })

      expect(await service.getClaimStatus()).toMatchObject({ claimable: false, reason: 'unsupported' })
      await expect(service.claimInstance(validClaim)).rejects.toThrow('cannot be claimed')
    })

    it('uses the dedicated claim rate-limit bucket', async () => {
      const checkRateLimit = vi.fn().mockResolvedValue(undefined)
      const { service } = makeService()
      ;(service as unknown as { deps: { rateLimiter: unknown } }).deps.rateLimiter = { checkRateLimit }

      await service.claimInstance(validClaim)

      expect(checkRateLimit).toHaveBeenCalledWith('claimInstance')
    })
  })
})
