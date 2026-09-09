/**
 * Storage adapter conformance suite — the executable form of the storage contract.
 *
 * This file is deliberately NOT named `*.test.ts`: vitest.config.ts includes only
 * `src/**\/*.test.ts`, so the spec is picked up solely through the thin per-adapter
 * runners (`conformance.filesystem.test.ts`, `conformance.postgres.test.ts`).
 *
 * The contract encoded here is the one pinned in `.foreman/MISSION.md`. Where the two
 * adapters historically disagreed, the decision recorded there wins — not whichever
 * behaviour happens to pass today.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { DataStorageAdapter } from '../../core/types/storage-adapters.js'
import type {
  AuditContext,
  Document,
  DocumentData,
  CreateUserData,
  UpdateUserData,
  User
} from '../../core/types/index.js'

export interface DataAdapterConformanceHooks {
  /** A brand new, completely empty adapter. Called before every test. */
  createAdapter: () => Promise<DataStorageAdapter>
  /** Dispose of everything the matching createAdapter() produced. Called after every test. */
  teardown: (adapter: DataStorageAdapter) => Promise<void>
}

/**
 * Postgres and the filesystem both need real I/O for every one of these tests, and each test
 * gets a brand new store (a fresh temp dir / a fresh set of prefixed tables), so the
 * per-test budget has to cover schema setup as well as the assertions.
 */
const TEST_TIMEOUT = 60_000

/** Document data is metadata-only in the type system; user fields are structurally extra. */
const asData = (data: Record<string, unknown>): DocumentData => data as unknown as DocumentData

/** Read a user-supplied field off a returned document. */
const field = (doc: Document, key: string): unknown => (doc as unknown as Record<string, unknown>)[key]

/**
 * User input, allowing every optional field at create time and an explicit `null` to clear
 * a field on update. `CreateUserData` omits `passwordHash`/`mfa`/`passkeys`/`oauthProviders`
 * even though the contract says a create must persist them, so callers cast; the cast lives
 * here once rather than at every call site.
 */
type UserInput = { [K in keyof User]?: User[K] | null }

const asUserData = (data: UserInput): CreateUserData & Partial<UpdateUserData> =>
  data as unknown as CreateUserData & Partial<UpdateUserData>

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** Timestamps are compared for ordering, so fixtures need distinguishable creation times. */
const TIME_GAP_MS = 20

const baseUser = (overrides: UserInput = {}): UserInput => ({
  username: 'conformance',
  email: 'conformance@example.com',
  passwordHash: 'hash-v1',
  firstName: 'Con',
  lastName: 'Formance',
  role: 'editor',
  ...overrides
})

const MFA_FIXTURE: NonNullable<User['mfa']> = {
  enabled: true,
  methods: [{ type: 'totp', enabled: true, verified: true, secret: 'SECRET-1' }],
  backupCodes: ['code-a', 'code-b']
}

const MFA_FIXTURE_2: NonNullable<User['mfa']> = {
  enabled: false,
  methods: [{ type: 'email', enabled: false, verified: false }]
}

const PASSKEYS_FIXTURE = [
  { id: 'cred-1', publicKey: 'pk-1', counter: 3, createdAt: '2026-01-01T00:00:00.000Z' }
] as unknown as NonNullable<User['passkeys']>

const PASSKEYS_FIXTURE_2 = [
  { id: 'cred-2', publicKey: 'pk-2', counter: 0, createdAt: '2026-02-02T00:00:00.000Z' }
] as unknown as NonNullable<User['passkeys']>

const OAUTH_FIXTURE: NonNullable<User['oauthProviders']> = [
  {
    provider: 'google',
    providerId: 'google-123',
    email: 'conformance@example.com',
    linkedAt: '2026-01-01T00:00:00.000Z'
  }
]

const OAUTH_FIXTURE_2: NonNullable<User['oauthProviders']> = [
  {
    provider: 'github',
    providerId: 'github-456',
    email: 'conformance@example.com',
    linkedAt: '2026-02-02T00:00:00.000Z'
  }
]

/**
 * The fields whose create/update/omit/clear behaviour diverged between adapters. Every one of
 * them is exercised through the same four-way matrix below.
 */
const DIVERGENT_USER_FIELDS: Array<{
  name: keyof User & string
  createValue: unknown
  updateValue: unknown
}> = [
  {
    name: 'lastLoginAt',
    createValue: '2026-03-04T05:06:07.000Z',
    updateValue: '2026-05-06T07:08:09.000Z'
  },
  { name: 'mfa', createValue: MFA_FIXTURE, updateValue: MFA_FIXTURE_2 },
  { name: 'passkeys', createValue: PASSKEYS_FIXTURE, updateValue: PASSKEYS_FIXTURE_2 },
  { name: 'oauthProviders', createValue: OAUTH_FIXTURE, updateValue: OAUTH_FIXTURE_2 },
  {
    name: 'preferences',
    createValue: { theme: 'dark', language: 'fr', timezone: 'Europe/Paris' },
    updateValue: { theme: 'light', language: 'en' }
  },
  {
    name: 'permissions',
    createValue: ['content:read', 'media:read'],
    updateValue: ['content:read', 'content:write']
  }
]

export function describeDataAdapterConformance(name: string, hooks: DataAdapterConformanceHooks): void {
  describe(`${name} conformance`, { timeout: TEST_TIMEOUT }, () => {
    let adapter: DataStorageAdapter

    beforeEach(async () => {
      adapter = await hooks.createAdapter()
    }, TEST_TIMEOUT)

    afterEach(async () => {
      await hooks.teardown(adapter)
    }, TEST_TIMEOUT)

    const editor: AuditContext = { userId: 'user-editor', userType: 'user', username: 'editor' }
    const robot: AuditContext = { userId: 'token-robot', userType: 'api', username: 'robot' }

    // =========================================================================
    // DOCUMENTS — CRUD
    // =========================================================================

    describe('documents: CRUD round-trip', () => {
      it('creates a document and returns the stored data', async () => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello', order: 1 }))

        expect(saved.id).toBe('post-1')
        expect(field(saved, 'title')).toBe('Hello')
        expect(field(saved, 'order')).toBe(1)
      })

      it('reads a created document back', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello', order: 1 }))

        const read = await adapter.getDocument('posts', 'post-1')
        expect(read).not.toBeNull()
        expect(read!.id).toBe('post-1')
        expect(field(read!, 'title')).toBe('Hello')
        expect(field(read!, 'order')).toBe(1)
      })

      it('updates a document in place', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Original', order: 1 }))
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Updated', order: 2 }))

        expect(field(updated, 'title')).toBe('Updated')

        const read = await adapter.getDocument('posts', 'post-1')
        expect(field(read!, 'title')).toBe('Updated')
        expect(field(read!, 'order')).toBe(2)
        // An update is not a second document
        expect(await adapter.listDocuments('posts')).toHaveLength(1)
      })

      it('deletes a document', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Doomed' }))
        await adapter.deleteDocument('posts', 'post-1')

        expect(await adapter.getDocument('posts', 'post-1')).toBeNull()
        expect(await adapter.listDocuments('posts')).toEqual([])
      })

      it('keeps collections isolated from each other', async () => {
        await adapter.saveDocument('posts', 'shared-id', asData({ title: 'A post' }))
        await adapter.saveDocument('pages', 'shared-id', asData({ title: 'A page' }))

        const posts = await adapter.listDocuments('posts')
        const pages = await adapter.listDocuments('pages')
        expect(posts).toHaveLength(1)
        expect(pages).toHaveLength(1)
        expect(field(posts[0], 'title')).toBe('A post')
        expect(field(pages[0], 'title')).toBe('A page')
      })
    })

    // =========================================================================
    // DOCUMENTS — IDENTITY
    // =========================================================================

    describe('documents: identity (id and _id)', () => {
      it('returns both id and _id from saveDocument', async () => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))

        expect(saved.id).toBe('post-1')
        expect(saved._id).toBe('post-1')
        expect(saved._id).toBe(saved.id)
      })

      it('returns both id and _id from getDocument', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))

        const read = await adapter.getDocument('posts', 'post-1')
        expect(read!.id).toBe('post-1')
        expect(read!._id).toBe('post-1')
        expect(read!._id).toBe(read!.id)
      })

      it('returns both id and _id from listDocuments', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        await adapter.saveDocument('posts', 'post-2', asData({ title: 'World' }))

        const docs = await adapter.listDocuments('posts')
        expect(docs).toHaveLength(2)
        for (const doc of docs) {
          expect(typeof doc.id).toBe('string')
          expect(doc.id).not.toBe('')
          expect(doc._id).toBe(doc.id)
        }
        expect(new Set(docs.map(d => d._id))).toEqual(new Set(['post-1', 'post-2']))
      })
    })

    // =========================================================================
    // DOCUMENTS — SYSTEM FIELDS
    // =========================================================================

    describe('documents: system fields', () => {
      it('returns typed system fields from saveDocument', async () => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), editor)

        expect(saved._collection).toBe('posts')
        expect(saved._createdAt).toBeInstanceOf(Date)
        expect(saved._updatedAt).toBeInstanceOf(Date)
        expect(Number.isNaN(saved._createdAt.getTime())).toBe(false)
        expect(Number.isNaN(saved._updatedAt.getTime())).toBe(false)
        expect(typeof saved._revision).toBe('number')
        expect(saved._status).toBe('draft')
        expect(saved._createdBy).toBe('user-editor')
        expect(saved._updatedBy).toBe('user-editor')
        expect(saved._createdByType).toBe('user')
        expect(saved._updatedByType).toBe('user')
      })

      it('returns typed system fields from getDocument', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), editor)

        const read = await adapter.getDocument('posts', 'post-1')
        expect(read!._collection).toBe('posts')
        expect(read!._createdAt).toBeInstanceOf(Date)
        expect(read!._updatedAt).toBeInstanceOf(Date)
        expect(typeof read!._revision).toBe('number')
        expect(read!._status).toBe('draft')
        expect(read!._createdBy).toBe('user-editor')
        expect(read!._updatedBy).toBe('user-editor')
        expect(read!._createdByType).toBe('user')
        expect(read!._updatedByType).toBe('user')
      })

      it('returns the same shape from listDocuments as from getDocument', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), editor)

        const read = await adapter.getDocument('posts', 'post-1')
        const [listed] = await adapter.listDocuments('posts')

        expect(listed._collection).toBe('posts')
        expect(listed._createdAt).toBeInstanceOf(Date)
        expect(listed._updatedAt).toBeInstanceOf(Date)
        expect(listed._revision).toBe(read!._revision)
        expect(listed._status).toBe(read!._status)
        expect(listed._createdBy).toBe('user-editor')
        expect(listed._updatedBy).toBe('user-editor')
        expect(listed._createdByType).toBe('user')
        expect(listed._updatedByType).toBe('user')
        // The list projection must not be a reduced view of the document.
        expect(new Set(Object.keys(listed))).toEqual(new Set(Object.keys(read!)))
      })

      it('reports unknown audit fields as undefined and never as null', async () => {
        // No auditContext: nobody is known to have made this write.
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        const read = await adapter.getDocument('posts', 'post-1')
        const [listed] = await adapter.listDocuments('posts')

        for (const doc of [saved, read!, listed]) {
          expect(doc._createdBy).toBeUndefined()
          expect(doc._createdBy).not.toBeNull()
          expect(doc._updatedBy).toBeUndefined()
          expect(doc._updatedBy).not.toBeNull()
          expect(doc._createdByType).toBeUndefined()
          expect(doc._createdByType).not.toBeNull()
          expect(doc._updatedByType).toBeUndefined()
          expect(doc._updatedByType).not.toBeNull()
        }
      })

      it('sets _collection to the collection the document was saved in', async () => {
        await adapter.saveDocument('pages', 'page-1', asData({ title: 'A page' }))

        const read = await adapter.getDocument('pages', 'page-1')
        const [listed] = await adapter.listDocuments('pages')
        expect(read!._collection).toBe('pages')
        expect(listed._collection).toBe('pages')
      })
    })

    // =========================================================================
    // DOCUMENTS — _status
    // =========================================================================

    describe('documents: _status defaulting', () => {
      it("defaults to 'draft' when create omits _status", async () => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        expect(saved._status).toBe('draft')
        expect((await adapter.getDocument('posts', 'post-1'))!._status).toBe('draft')
        expect((await adapter.listDocuments('posts'))[0]._status).toBe('draft')
      })

      it("keeps an explicit 'published' supplied on create", async () => {
        const saved = await adapter.saveDocument(
          'posts',
          'post-1',
          asData({ title: 'Hello', _status: 'published' })
        )
        expect(saved._status).toBe('published')
        expect((await adapter.getDocument('posts', 'post-1'))!._status).toBe('published')
      })

      it('preserves the stored status when an update omits _status', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello', _status: 'published' }))
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello again' }))

        expect(updated._status).toBe('published')
        expect((await adapter.getDocument('posts', 'post-1'))!._status).toBe('published')
      })

      it('changes the status when an update supplies _status', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        const updated = await adapter.saveDocument(
          'posts',
          'post-1',
          asData({ title: 'Hello', _status: 'published' })
        )

        expect(updated._status).toBe('published')
        expect((await adapter.getDocument('posts', 'post-1'))!._status).toBe('published')
      })
    })

    // =========================================================================
    // DOCUMENTS — _revision
    // =========================================================================

    describe('documents: _revision', () => {
      it('is 1 on create', async () => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ n: 1 }))
        expect(saved._revision).toBe(1)
        expect((await adapter.getDocument('posts', 'post-1'))!._revision).toBe(1)
        expect((await adapter.listDocuments('posts'))[0]._revision).toBe(1)
      })

      it('is 2 after one update', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ n: 1 }))
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ n: 2 }))

        expect(updated._revision).toBe(2)
        expect((await adapter.getDocument('posts', 'post-1'))!._revision).toBe(2)
      })

      it('is 3 after two updates', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ n: 1 }))
        await adapter.saveDocument('posts', 'post-1', asData({ n: 2 }))
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ n: 3 }))

        expect(updated._revision).toBe(3)
        expect((await adapter.getDocument('posts', 'post-1'))!._revision).toBe(3)
      })
    })

    // =========================================================================
    // DOCUMENTS — AUDIT CONTEXT
    // =========================================================================

    describe('documents: audit context', () => {
      it('records the creator from the auditContext argument', async () => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), editor)

        expect(saved._createdBy).toBe('user-editor')
        expect(saved._createdByType).toBe('user')
        expect(saved._updatedBy).toBe('user-editor')
        expect(saved._updatedByType).toBe('user')
      })

      it('records a non-user actor type', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), robot)

        const read = await adapter.getDocument('posts', 'post-1')
        expect(read!._createdBy).toBe('token-robot')
        expect(read!._createdByType).toBe('api')
      })

      it('preserves the original creator when a different actor updates', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), editor)
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Edited' }), robot)

        expect(updated._createdBy).toBe('user-editor')
        expect(updated._createdByType).toBe('user')
        expect(updated._updatedBy).toBe('token-robot')
        expect(updated._updatedByType).toBe('api')

        const read = await adapter.getDocument('posts', 'post-1')
        expect(read!._createdBy).toBe('user-editor')
        expect(read!._createdByType).toBe('user')
        expect(read!._updatedBy).toBe('token-robot')
        expect(read!._updatedByType).toBe('api')
      })

      it('preserves the original creator in listDocuments too', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }), editor)
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Edited' }), robot)

        const [listed] = await adapter.listDocuments('posts')
        expect(listed._createdBy).toBe('user-editor')
        expect(listed._updatedBy).toBe('token-robot')
        expect(listed._createdByType).toBe('user')
        expect(listed._updatedByType).toBe('api')
      })
    })

    // =========================================================================
    // DOCUMENTS — VALUE FIDELITY
    // =========================================================================

    describe('documents: value fidelity', () => {
      /**
       * Round-trip one field through save -> get -> list and assert the value and its type
       * survive all three. Key ORDER is deliberately not asserted anywhere in this suite:
       * postgres stores documents as `jsonb`, which normalises key order by design, and no
       * consumer depends on it (see the Decisions section of .foreman/MISSION.md).
       */
      const expectRoundTrip = async (key: string, value: unknown): Promise<void> => {
        const saved = await adapter.saveDocument('posts', 'post-1', asData({ [key]: value }))
        expect(field(saved, key)).toStrictEqual(value)

        const read = await adapter.getDocument('posts', 'post-1')
        expect(field(read!, key)).toStrictEqual(value)

        const [listed] = await adapter.listDocuments('posts')
        expect(field(listed, key)).toStrictEqual(value)
      }

      it('round-trips the number 0', async () => {
        await expectRoundTrip('count', 0)
      })

      it('round-trips false', async () => {
        await expectRoundTrip('featured', false)
      })

      it('round-trips the empty string', async () => {
        await expectRoundTrip('subtitle', '')
      })

      it('round-trips an explicit null', async () => {
        await expectRoundTrip('deletedAt', null)
      })

      it('round-trips an empty array', async () => {
        await expectRoundTrip('tags', [])
      })

      it('round-trips an empty object', async () => {
        await expectRoundTrip('meta', {})
      })

      it('round-trips an object nested three levels deep', async () => {
        await expectRoundTrip('seo', {
          one: { two: { three: { title: 'deep', count: 0, flag: false, empty: '', nothing: null } } }
        })
      })

      it('round-trips an array of objects', async () => {
        await expectRoundTrip('blocks', [
          { type: 'text', value: 'a', order: 0 },
          { type: 'image', value: null, tags: ['x', 'y'] },
          { type: 'quote', nested: { by: 'someone' } }
        ])
      })

      it('round-trips unicode (emoji, CJK and combining accents)', async () => {
        await expectRoundTrip('title', '🚀 日本語と中文 — café vs café 🇫🇷')
      })

      it('round-trips a string larger than 100KB', async () => {
        const long = 'décomposé-🚀-'.repeat(10_000)
        expect(long.length).toBeGreaterThan(100_000)
        await expectRoundTrip('body', long)
      })

      it('keeps every value of a mixed document together', async () => {
        const data = {
          count: 0,
          featured: false,
          subtitle: '',
          deletedAt: null,
          tags: [],
          meta: {},
          nested: { a: { b: { c: [1, 2, 3] } } }
        }
        const saved = await adapter.saveDocument('posts', 'post-1', asData(data))
        const read = await adapter.getDocument('posts', 'post-1')
        const [listed] = await adapter.listDocuments('posts')

        for (const doc of [saved, read!, listed]) {
          for (const [key, value] of Object.entries(data)) {
            expect(field(doc, key)).toStrictEqual(value)
          }
        }
      })
    })

    // =========================================================================
    // DOCUMENTS — UPDATE SEMANTICS
    // =========================================================================

    describe('documents: update semantics', () => {
      it('replaces the user data rather than merging it', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello', subtitle: 'Kept?', order: 3 }))
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))

        expect(field(updated, 'title')).toBe('Hello')
        expect(field(updated, 'subtitle')).toBeUndefined()
        expect(field(updated, 'order')).toBeUndefined()

        const read = await adapter.getDocument('posts', 'post-1')
        expect(field(read!, 'subtitle')).toBeUndefined()
        expect(field(read!, 'order')).toBeUndefined()
        expect(Object.prototype.hasOwnProperty.call(read!, 'subtitle')).toBe(false)

        const [listed] = await adapter.listDocuments('posts')
        expect(field(listed, 'subtitle')).toBeUndefined()
        expect(field(listed, 'order')).toBeUndefined()
      })

      it('replaces nested structures wholesale', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ seo: { title: 'a', description: 'b' } }))
        const updated = await adapter.saveDocument('posts', 'post-1', asData({ seo: { title: 'z' } }))

        expect(field(updated, 'seo')).toStrictEqual({ title: 'z' })
        expect(field((await adapter.getDocument('posts', 'post-1'))!, 'seo')).toStrictEqual({ title: 'z' })
      })
    })

    // =========================================================================
    // DOCUMENTS — LISTING: FILTERS
    // =========================================================================

    describe('documents: listDocuments filters', () => {
      beforeEach(async () => {
        await adapter.saveDocument(
          'posts',
          'post-1',
          asData({ category: 'news', featured: true, views: 10, _status: 'published' })
        )
        await adapter.saveDocument(
          'posts',
          'post-2',
          asData({ category: 'tech', featured: false, views: 0, _status: 'draft' })
        )
        await adapter.saveDocument(
          'posts',
          'post-3',
          asData({ category: 'tech', featured: false, views: 0, _status: 'published' })
        )
      })

      it('filters on a string field', async () => {
        const docs = await adapter.listDocuments('posts', { filter: { category: 'tech' } })
        expect(docs.map(d => d.id).sort()).toEqual(['post-2', 'post-3'])
      })

      it('filters on a boolean false field', async () => {
        const docs = await adapter.listDocuments('posts', { filter: { featured: false } })
        expect(docs.map(d => d.id).sort()).toEqual(['post-2', 'post-3'])
      })

      it('filters on a boolean true field', async () => {
        const docs = await adapter.listDocuments('posts', { filter: { featured: true } })
        expect(docs.map(d => d.id)).toEqual(['post-1'])
      })

      it('filters on a numeric 0 field', async () => {
        const docs = await adapter.listDocuments('posts', { filter: { views: 0 } })
        expect(docs.map(d => d.id).sort()).toEqual(['post-2', 'post-3'])
      })

      it('filters on the _status system field', async () => {
        const docs = await adapter.listDocuments('posts', { filter: { _status: 'published' } })
        expect(docs.map(d => d.id).sort()).toEqual(['post-1', 'post-3'])
      })

      it('combines several filter keys', async () => {
        const docs = await adapter.listDocuments('posts', {
          filter: { category: 'tech', _status: 'published' }
        })
        expect(docs.map(d => d.id)).toEqual(['post-3'])
      })

      it('returns nothing when the filter matches nothing', async () => {
        const docs = await adapter.listDocuments('posts', { filter: { category: 'absent' } })
        expect(docs).toEqual([])
      })

      it('does not coerce types when filtering', async () => {
        // '0' is not 0 and 'false' is not false: equality is exact and type-preserving.
        expect(await adapter.listDocuments('posts', { filter: { views: '0' } })).toEqual([])
        expect(await adapter.listDocuments('posts', { filter: { featured: 'false' } })).toEqual([])
      })
    })

    // =========================================================================
    // DOCUMENTS — LISTING: SORT
    // =========================================================================

    describe('documents: listDocuments sorting', () => {
      beforeEach(async () => {
        // Spaced out so _createdAt ordering is unambiguous at millisecond resolution.
        await adapter.saveDocument('posts', 'post-b', asData({ order: 2, title: 'B' }))
        await sleep(TIME_GAP_MS)
        await adapter.saveDocument('posts', 'post-a', asData({ order: 1, title: 'A' }))
        await sleep(TIME_GAP_MS)
        await adapter.saveDocument('posts', 'post-c', asData({ order: 3, title: 'C' }))
      })

      const orders = (docs: Document[]): unknown[] => docs.map(d => field(d, 'order'))

      it('sorts a data field ascending with the field.asc grammar', async () => {
        expect(orders(await adapter.listDocuments('posts', { sort: 'order.asc' }))).toEqual([1, 2, 3])
      })

      it('sorts a data field descending with the field.desc grammar', async () => {
        expect(orders(await adapter.listDocuments('posts', { sort: 'order.desc' }))).toEqual([3, 2, 1])
      })

      it('sorts a data field descending with the -field grammar', async () => {
        expect(orders(await adapter.listDocuments('posts', { sort: '-order' }))).toEqual([3, 2, 1])
      })

      it('sorts a data field ascending with a bare field name', async () => {
        expect(orders(await adapter.listDocuments('posts', { sort: 'order' }))).toEqual([1, 2, 3])
      })

      it('sorts _createdAt ascending with the field.asc grammar', async () => {
        const docs = await adapter.listDocuments('posts', { sort: '_createdAt.asc' })
        expect(docs.map(d => d.id)).toEqual(['post-b', 'post-a', 'post-c'])
      })

      it('sorts _createdAt descending with the field.desc grammar', async () => {
        const docs = await adapter.listDocuments('posts', { sort: '_createdAt.desc' })
        expect(docs.map(d => d.id)).toEqual(['post-c', 'post-a', 'post-b'])
      })

      it('sorts _createdAt descending with the -field grammar', async () => {
        const docs = await adapter.listDocuments('posts', { sort: '-_createdAt' })
        expect(docs.map(d => d.id)).toEqual(['post-c', 'post-a', 'post-b'])
      })

      it('sorts _createdAt ascending with a bare field name', async () => {
        const docs = await adapter.listDocuments('posts', { sort: '_createdAt' })
        expect(docs.map(d => d.id)).toEqual(['post-b', 'post-a', 'post-c'])
      })

      it('defaults to _createdAt descending when no sort is given', async () => {
        const docs = await adapter.listDocuments('posts')
        expect(docs.map(d => d.id)).toEqual(['post-c', 'post-a', 'post-b'])
      })

      it('applies the sort before the pagination window', async () => {
        const docs = await adapter.listDocuments('posts', { sort: 'order.asc', limit: 2 })
        expect(orders(docs)).toEqual([1, 2])
      })
    })

    // =========================================================================
    // DOCUMENTS — LISTING: PAGINATION
    // =========================================================================

    describe('documents: listDocuments pagination', () => {
      const seed = async (count: number): Promise<void> => {
        for (let i = 0; i < count; i++) {
          await adapter.saveDocument('posts', `post-${String(i).padStart(3, '0')}`, asData({ order: i }))
        }
      }

      it('honours limit', async () => {
        await seed(10)
        const docs = await adapter.listDocuments('posts', { sort: 'order.asc', limit: 3 })
        expect(docs.map(d => field(d, 'order'))).toEqual([0, 1, 2])
      })

      it('honours offset', async () => {
        await seed(10)
        const docs = await adapter.listDocuments('posts', { sort: 'order.asc', offset: 7 })
        expect(docs.map(d => field(d, 'order'))).toEqual([7, 8, 9])
      })

      it('honours limit and offset together', async () => {
        await seed(10)
        const docs = await adapter.listDocuments('posts', { sort: 'order.asc', limit: 3, offset: 4 })
        expect(docs.map(d => field(d, 'order'))).toEqual([4, 5, 6])
      })

      it('applies no implicit default limit', async () => {
        // 60 is deliberately above the 50-row window one adapter used to impose silently.
        await seed(60)
        const docs = await adapter.listDocuments('posts')
        expect(docs).toHaveLength(60)
      })
    })

    // =========================================================================
    // DOCUMENTS — countDocuments
    // =========================================================================

    describe('documents: countDocuments', () => {
      beforeEach(async () => {
        await adapter.saveDocument(
          'posts',
          'post-1',
          asData({ category: 'news', featured: true, views: 10, _status: 'published' })
        )
        await adapter.saveDocument(
          'posts',
          'post-2',
          asData({ category: 'tech', featured: false, views: 0, _status: 'draft' })
        )
        await adapter.saveDocument(
          'posts',
          'post-3',
          asData({ category: 'tech', featured: false, views: 0, _status: 'published' })
        )
      })

      it('counts every document when no filter is given', async () => {
        expect(adapter.countDocuments).toBeTypeOf('function')
        expect(await adapter.countDocuments!('posts')).toBe(3)
      })

      it('counts with a string filter', async () => {
        expect(await adapter.countDocuments!('posts', { category: 'tech' })).toBe(2)
      })

      it('counts with a boolean false filter', async () => {
        expect(await adapter.countDocuments!('posts', { featured: false })).toBe(2)
      })

      it('counts with a numeric 0 filter', async () => {
        expect(await adapter.countDocuments!('posts', { views: 0 })).toBe(2)
      })

      it('counts with a _status system-field filter', async () => {
        expect(await adapter.countDocuments!('posts', { _status: 'published' })).toBe(2)
      })

      it('counts the same rows listDocuments returns', async () => {
        const filters: Record<string, unknown>[] = [
          { category: 'tech' },
          { featured: false },
          { views: 0 },
          { _status: 'published' },
          { category: 'absent' }
        ]
        for (const filter of filters) {
          const listed = await adapter.listDocuments('posts', { filter })
          expect(await adapter.countDocuments!('posts', filter)).toBe(listed.length)
        }
      })
    })

    // =========================================================================
    // DOCUMENTS — MISSING DOCUMENT / COLLECTION
    // =========================================================================

    describe('documents: missing document', () => {
      it('returns null from getDocument', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        expect(await adapter.getDocument('posts', 'post-absent')).toBeNull()
      })

      it('rejects from deleteDocument', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        await expect(adapter.deleteDocument('posts', 'post-absent')).rejects.toThrow()
      })

      it('reports documentExists false', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        expect(adapter.documentExists).toBeTypeOf('function')
        expect(await adapter.documentExists!('posts', 'post-absent')).toBe(false)
      })

      it('reports documentExists true for a document that is there', async () => {
        await adapter.saveDocument('posts', 'post-1', asData({ title: 'Hello' }))
        expect(await adapter.documentExists!('posts', 'post-1')).toBe(true)
      })
    })

    describe('documents: missing collection', () => {
      it('returns an empty array from listDocuments', async () => {
        expect(await adapter.listDocuments('nope')).toEqual([])
      })

      it('returns 0 from countDocuments', async () => {
        expect(await adapter.countDocuments!('nope')).toBe(0)
      })

      it('returns null from getDocument', async () => {
        expect(await adapter.getDocument('nope', 'post-1')).toBeNull()
      })

      it('returns false from documentExists', async () => {
        expect(await adapter.documentExists!('nope', 'post-1')).toBe(false)
      })
    })

    // =========================================================================
    // USERS — CRUD
    // =========================================================================

    describe('users: CRUD round-trip', () => {
      it('creates a user and returns it', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser()))

        expect(created.id).toBe('user-1')
        expect(created.username).toBe('conformance')
        expect(created.email).toBe('conformance@example.com')
        expect(created.firstName).toBe('Con')
        expect(created.lastName).toBe('Formance')
        expect(created.role).toBe('editor')
        expect(created.passwordHash).toBe('hash-v1')
      })

      it('reads a created user back', async () => {
        await adapter.saveUser('user-1', asUserData(baseUser()))

        const read = await adapter.getUser('user-1')
        expect(read).not.toBeNull()
        expect(read!.id).toBe('user-1')
        expect(read!.username).toBe('conformance')
        expect(read!.passwordHash).toBe('hash-v1')
      })

      it('updates a user', async () => {
        await adapter.saveUser('user-1', asUserData(baseUser()))
        const updated = await adapter.saveUser('user-1', asUserData({ firstName: 'Updated', role: 'admin' }))

        expect(updated.firstName).toBe('Updated')
        expect(updated.role).toBe('admin')
        // Untouched fields survive
        expect(updated.username).toBe('conformance')
        expect(updated.lastName).toBe('Formance')

        const read = await adapter.getUser('user-1')
        expect(read!.firstName).toBe('Updated')
        expect(read!.role).toBe('admin')
        expect(await adapter.listUsers()).toHaveLength(1)
      })

      it('deletes a user', async () => {
        await adapter.saveUser('user-1', asUserData(baseUser()))
        await adapter.deleteUser('user-1')

        expect(await adapter.getUser('user-1')).toBeNull()
        expect(await adapter.listUsers()).toEqual([])
      })
    })

    describe('users: missing user', () => {
      it('returns null from getUser', async () => {
        expect(await adapter.getUser('user-absent')).toBeNull()
      })

      it('rejects from deleteUser', async () => {
        await expect(adapter.deleteUser('user-absent')).rejects.toThrow()
      })
    })

    // =========================================================================
    // USERS — LOOKUPS
    // =========================================================================

    describe('users: lookups', () => {
      beforeEach(async () => {
        await adapter.saveUser('user-1', asUserData(baseUser({ username: 'ada', email: 'ada@example.com' })))
      })

      it('finds a user by username', async () => {
        const found = await adapter.getUserByUsername('ada')
        expect(found).not.toBeNull()
        expect(found!.id).toBe('user-1')
      })

      it('returns null for an unknown username', async () => {
        expect(await adapter.getUserByUsername('nobody')).toBeNull()
      })

      it('finds a user by email', async () => {
        const found = await adapter.getUserByEmail('ada@example.com')
        expect(found).not.toBeNull()
        expect(found!.id).toBe('user-1')
      })

      it('returns null for an unknown email', async () => {
        expect(await adapter.getUserByEmail('nobody@example.com')).toBeNull()
      })

      it('reports a taken username as unavailable', async () => {
        expect(adapter.isUsernameAvailable).toBeTypeOf('function')
        expect(await adapter.isUsernameAvailable!('ada')).toBe(false)
      })

      it('reports an unused username as available', async () => {
        expect(await adapter.isUsernameAvailable!('grace')).toBe(true)
      })

      it('reports a taken email as unavailable', async () => {
        expect(adapter.isEmailAvailable).toBeTypeOf('function')
        expect(await adapter.isEmailAvailable!('ada@example.com')).toBe(false)
      })

      it('reports an unused email as available', async () => {
        expect(await adapter.isEmailAvailable!('grace@example.com')).toBe(true)
      })
    })

    // =========================================================================
    // USERS — listUsers
    // =========================================================================

    describe('users: listUsers', () => {
      const seedUsers = async (): Promise<void> => {
        await adapter.saveUser(
          'user-1',
          asUserData(baseUser({ username: 'u1', email: 'u1@example.com', role: 'admin', isActive: true }))
        )
        await sleep(TIME_GAP_MS)
        await adapter.saveUser(
          'user-2',
          asUserData(baseUser({ username: 'u2', email: 'u2@example.com', role: 'editor', isActive: false }))
        )
        await sleep(TIME_GAP_MS)
        await adapter.saveUser(
          'user-3',
          asUserData(baseUser({ username: 'u3', email: 'u3@example.com', role: 'editor', isActive: true }))
        )
      }

      it('filters by role', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ role: 'editor' })
        expect(users.map(u => u.id).sort()).toEqual(['user-2', 'user-3'])
      })

      it('filters by isActive true', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ isActive: true })
        expect(users.map(u => u.id).sort()).toEqual(['user-1', 'user-3'])
      })

      it('filters by isActive false', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ isActive: false })
        expect(users.map(u => u.id)).toEqual(['user-2'])
      })

      it('combines role and isActive', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ role: 'editor', isActive: true })
        expect(users.map(u => u.id)).toEqual(['user-3'])
      })

      it('orders by createdAt descending', async () => {
        await seedUsers()
        const users = await adapter.listUsers()
        expect(users.map(u => u.id)).toEqual(['user-3', 'user-2', 'user-1'])
      })

      it('honours limit', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ limit: 2 })
        expect(users.map(u => u.id)).toEqual(['user-3', 'user-2'])
      })

      it('honours offset', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ offset: 2 })
        expect(users.map(u => u.id)).toEqual(['user-1'])
      })

      it('honours limit and offset together', async () => {
        await seedUsers()
        const users = await adapter.listUsers({ limit: 1, offset: 1 })
        expect(users.map(u => u.id)).toEqual(['user-2'])
      })

      it('applies no implicit default limit', async () => {
        for (let i = 0; i < 60; i++) {
          const n = String(i).padStart(3, '0')
          await adapter.saveUser(
            `user-${n}`,
            asUserData(baseUser({ username: `u${n}`, email: `u${n}@example.com` }))
          )
        }
        expect(await adapter.listUsers()).toHaveLength(60)
      })

      it('returns an empty array when there are no users', async () => {
        expect(await adapter.listUsers()).toEqual([])
      })
    })

    // =========================================================================
    // USERS — DEFAULTS, NULL vs UNDEFINED, TIMESTAMPS
    // =========================================================================

    describe('users: defaults on create', () => {
      it('defaults permissions to an empty array', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser()))
        expect(created.permissions).toEqual([])
        expect((await adapter.getUser('user-1'))!.permissions).toEqual([])
      })

      it('defaults isActive to true', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser()))
        expect(created.isActive).toBe(true)
        expect((await adapter.getUser('user-1'))!.isActive).toBe(true)
      })

      it('keeps an explicit isActive false', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser({ isActive: false })))
        expect(created.isActive).toBe(false)
        expect((await adapter.getUser('user-1'))!.isActive).toBe(false)
      })
    })

    describe('users: null versus undefined', () => {
      it('reads unsupplied optional fields back as undefined, never null', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser()))
        const read = await adapter.getUser('user-1')
        const [listed] = await adapter.listUsers()

        for (const user of [created, read!, listed]) {
          expect(user.profileImage).toBeUndefined()
          expect(user.profileImage).not.toBeNull()
          expect(user.preferences).toBeUndefined()
          expect(user.preferences).not.toBeNull()
          expect(user.oauthProviders).toBeUndefined()
          expect(user.oauthProviders).not.toBeNull()
          expect(user.mfa).toBeUndefined()
          expect(user.mfa).not.toBeNull()
          expect(user.passkeys).toBeUndefined()
          expect(user.passkeys).not.toBeNull()
          expect(user.lastLoginAt).toBeUndefined()
          expect(user.lastLoginAt).not.toBeNull()
        }
      })
    })

    describe('users: timestamps', () => {
      it('returns createdAt as an ISO-8601 string', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser()))
        const read = await adapter.getUser('user-1')

        for (const user of [created, read!]) {
          expect(typeof user.createdAt).toBe('string')
          expect(Number.isNaN(Date.parse(user.createdAt))).toBe(false)
          expect(new Date(user.createdAt).toISOString()).toBe(new Date(user.createdAt).toISOString())
        }
      })

      it('returns updatedAt as an ISO-8601 string', async () => {
        const created = await adapter.saveUser('user-1', asUserData(baseUser()))
        const read = await adapter.getUser('user-1')

        for (const user of [created, read!]) {
          expect(typeof user.updatedAt).toBe('string')
          expect(Number.isNaN(Date.parse(user.updatedAt))).toBe(false)
        }
      })

      it('returns lastLoginAt as an ISO-8601 string', async () => {
        await adapter.saveUser('user-1', asUserData(baseUser()))
        const updated = await adapter.saveUser(
          'user-1',
          asUserData({ lastLoginAt: '2026-05-06T07:08:09.000Z' })
        )
        const read = await adapter.getUser('user-1')

        for (const user of [updated, read!]) {
          expect(typeof user.lastLoginAt).toBe('string')
          expect(Number.isNaN(Date.parse(user.lastLoginAt as string))).toBe(false)
          expect(new Date(user.lastLoginAt as string).toISOString()).toBe('2026-05-06T07:08:09.000Z')
        }
      })

      it('returns timestamps as strings in listUsers too', async () => {
        await adapter.saveUser('user-1', asUserData(baseUser({ lastLoginAt: '2026-05-06T07:08:09.000Z' })))
        const [listed] = await adapter.listUsers()

        expect(typeof listed.createdAt).toBe('string')
        expect(typeof listed.updatedAt).toBe('string')
        expect(typeof listed.lastLoginAt).toBe('string')
      })
    })

    // =========================================================================
    // USERS — THE HISTORICALLY DIVERGENT FIELDS
    // =========================================================================

    describe('users: fields that diverged between adapters', () => {
      for (const { name, createValue, updateValue } of DIVERGENT_USER_FIELDS) {
        describe(name, () => {
          const read = async (): Promise<Record<string, unknown>> =>
            (await adapter.getUser('user-1')) as unknown as Record<string, unknown>

          it('persists the value supplied at create time', async () => {
            const created = await adapter.saveUser(
              'user-1',
              asUserData(baseUser({ [name]: createValue } as UserInput))
            )

            expect((created as unknown as Record<string, unknown>)[name]).toStrictEqual(createValue)
            expect((await read())[name]).toStrictEqual(createValue)
          })

          it('persists the value supplied on update', async () => {
            await adapter.saveUser('user-1', asUserData(baseUser()))
            const updated = await adapter.saveUser(
              'user-1',
              asUserData({ [name]: updateValue } as UserInput)
            )

            expect((updated as unknown as Record<string, unknown>)[name]).toStrictEqual(updateValue)
            expect((await read())[name]).toStrictEqual(updateValue)
          })

          it('leaves the value unchanged when an update omits it', async () => {
            await adapter.saveUser('user-1', asUserData(baseUser({ [name]: createValue } as UserInput)))
            const updated = await adapter.saveUser('user-1', asUserData({ firstName: 'Untouched' }))

            expect(updated.firstName).toBe('Untouched')
            expect((updated as unknown as Record<string, unknown>)[name]).toStrictEqual(createValue)
            expect((await read())[name]).toStrictEqual(createValue)
          })

          it('clears the value when an update sets it to null', async () => {
            await adapter.saveUser('user-1', asUserData(baseUser({ [name]: createValue } as UserInput)))
            const updated = await adapter.saveUser('user-1', asUserData({ [name]: null } as UserInput))

            // Cleared means gone, and gone reads back as undefined — never as null.
            expect((updated as unknown as Record<string, unknown>)[name]).toBeUndefined()
            expect((updated as unknown as Record<string, unknown>)[name]).not.toBeNull()
            expect((await read())[name]).toBeUndefined()
            expect((await read())[name]).not.toBeNull()
          })
        })
      }
    })

    // =========================================================================
    // USERS — saveUserIf
    // =========================================================================

    describe('users: saveUserIf', () => {
      beforeEach(async () => {
        await adapter.saveUser('user-1', asUserData(baseUser({ passwordHash: 'hash-v1' })))
      })

      it('applies the update when the stored password hash matches', async () => {
        expect(adapter.saveUserIf).toBeTypeOf('function')
        const updated = await adapter.saveUserIf!(
          'user-1',
          { passwordHash: 'hash-v2', lastLoginAt: '2026-05-06T07:08:09.000Z' },
          { passwordHash: 'hash-v1' }
        )

        expect(updated).not.toBeNull()
        expect(updated!.passwordHash).toBe('hash-v2')

        const read = await adapter.getUser('user-1')
        expect(read!.passwordHash).toBe('hash-v2')
        expect(read!.lastLoginAt).toBe('2026-05-06T07:08:09.000Z')
      })

      it('returns null and writes nothing when the stored hash differs', async () => {
        const updated = await adapter.saveUserIf!(
          'user-1',
          { passwordHash: 'hash-v2', lastLoginAt: '2026-05-06T07:08:09.000Z' },
          { passwordHash: 'stale-hash' }
        )

        expect(updated).toBeNull()

        const read = await adapter.getUser('user-1')
        expect(read!.passwordHash).toBe('hash-v1')
        expect(read!.lastLoginAt).toBeUndefined()
      })

      it('returns null for a user that does not exist', async () => {
        const updated = await adapter.saveUserIf!(
          'user-absent',
          { passwordHash: 'hash-v2' },
          { passwordHash: 'hash-v1' }
        )

        expect(updated).toBeNull()
        expect(await adapter.getUser('user-absent')).toBeNull()
      })
    })

    // =========================================================================
    // HEALTH
    // =========================================================================

    describe('healthCheck', () => {
      it('reports a freshly created adapter as healthy', async () => {
        expect(await adapter.healthCheck()).toBe(true)
      })
    })
  })
}
