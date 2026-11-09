/**
 * GET /system/doctor: the report behind `trokky doctor`.
 */
import { describe, it, expect, vi } from 'vitest'
import { createTestRoutes, createAuthenticatedUser, createMockRequest, executeRoute } from '../helpers/test-helpers.js'
import { scopedPermissions } from '../../core/security/oauth2/scoped-permissions.js'
import { runDoctor, MAX_SCANNED_DOCUMENTS, type DoctorInput } from '../../core/diagnostics/doctor.js'
import type { ContentSchema } from '../../core/types/index.js'
import type { DoctorReport } from '../../core/diagnostics/doctor.js'

const schemas = [
  { name: 'posts', type: 'document', isSingleton: true, fields: { title: { type: 'string' }, body: { type: 'richtext', required: true } } },
] as unknown as ContentSchema[]

async function setup(role: 'admin' | 'editor' = 'admin') {
  const { routes, core, dataAdapter } = await createTestRoutes({ schemas })
  const { token } = await createAuthenticatedUser(core, { role })
  const get = (headers: Record<string, string> = { Authorization: `Bearer ${token}` }) =>
    executeRoute(routes, createMockRequest({ method: 'GET', path: '/api/system/doctor', headers }))
  return { get, core, dataAdapter }
}

const report = (response: { body: unknown }) => (response.body as { data: DoctorReport }).data
const check = (r: DoctorReport, id: string) => r.checks.find((c) => c.id === id)!

describe('GET /system/doctor', () => {
  it('should report schema problems, invalid documents and documents without a status to an admin', async () => {
    const { get, dataAdapter } = await setup()
    await dataAdapter.saveDocument('posts', 'ok-1', { title: 'Fine', body: '<p>x</p>', _status: 'published' })
    await dataAdapter.saveDocument('posts', 'empty-body', { title: 'No body', _status: 'draft' })
    await dataAdapter.saveDocument('posts', 'no-status', { title: 'Old', body: '<p>x</p>' })

    const response = await get()
    expect(response.status).toBe(200)
    const r = report(response)
    expect(r.status).toBe('fail')

    expect(check(r, 'schemas').status).toBe('warn')
    expect(check(r, 'schemas').details[0]).toContain('posts: unknown key "isSingleton"')

    const content = check(r, 'content')
    expect(content.status).toBe('fail')
    expect(content.details.join('\n')).toContain('posts: 1 document(s) fail validation, by field: body (1)')
    expect(content.details.join('\n')).toContain('empty-body')
    expect(content.details.join('\n')).toContain('no-status')
    expect(content.details.join('\n')).not.toContain('ok-1')

    expect(check(r, 'signing-key').status).toBe('ok')
  })

  it('should never include the signing key or field values', async () => {
    const { get, core, dataAdapter } = await setup()
    await dataAdapter.saveDocument('posts', 'p1', { title: 'SECRET-TITLE-VALUE', _status: 'draft' })
    const body = JSON.stringify((await get()).body)
    expect(body).not.toContain((core as unknown as { jwtSecret: string }).jwtSecret)
    expect(body).not.toContain('SECRET-TITLE-VALUE')
  })

  it('should refuse a non-admin', async () => {
    const { get } = await setup('editor')
    expect((await get()).status).toBe(403)
  })

  it('should refuse an anonymous request', async () => {
    const { get } = await setup()
    expect((await get({})).status).toBe(401)
  })
})

describe('the system:read scope', () => {
  it('should carry settings:read for an admin only', () => {
    expect(scopedPermissions({ role: 'admin' }, ['system:read'])).toContain('settings:read')
    expect(scopedPermissions({ role: 'editor' }, ['system:read'])).not.toContain('settings:read')
  })
})

describe('runDoctor', () => {
  const base: DoctorInput = {
    environment: 'production',
    signingKey: { source: 'configured', length: 48 },
    schemaProblems: {},
    storage: { checked: true, warnings: [] },
    collections: [],
    listDocuments: async () => [],
    validate: () => ({ valid: true, errors: [] }),
  }

  it('should be ok when nothing is wrong', async () => {
    const r = await runDoctor(base)
    expect(r.status).toBe('ok')
    expect(r.checks.map((c) => c.status)).toEqual(['ok', 'ok', 'ok', 'ok'])
  })

  it('should warn about a generated or short signing key', async () => {
    expect(check(await runDoctor({ ...base, signingKey: { source: 'generated', length: 128 } }), 'signing-key').status).toBe('warn')
    expect(check(await runDoctor({ ...base, signingKey: { source: 'configured', length: 12 } }), 'signing-key').details[0]).toContain('12 characters')
  })

  it('should report storage warnings, and say when storage was not checked', async () => {
    const r = await runDoctor({ ...base, storage: { checked: true, warnings: ['Media files are stored in /app/media'] } })
    expect(check(r, 'storage')).toMatchObject({ status: 'warn', details: ['Media files are stored in /app/media'] })
    expect(r.status).toBe('warn')

    const skipped = await runDoctor({ ...base, storage: { checked: false, reason: 'only checked in production', warnings: [] } })
    expect(check(skipped, 'storage')).toMatchObject({ status: 'ok', details: ['Not checked: only checked in production.'] })
  })

  it('should count an array field once, not once per item, and cap the field list', async () => {
    const r = await runDoctor({
      ...base,
      collections: ['posts'],
      listDocuments: async (_c, _l, offset) => (offset === 0 ? [{ _id: 'p1', _status: 'draft' }] : []),
      validate: () => ({
        valid: false,
        errors: [
          ...Array.from({ length: 50 }, (_, i) => ({ field: `tags.${i}`, message: 'x', code: 'x' })),
          ...Array.from({ length: 12 }, (_, i) => ({ field: `f${i}`, message: 'x', code: 'x' })),
          { field: 'blocks.3.items.0.title', message: 'x', code: 'x' },
        ],
      }),
    })
    const detail = check(r, 'content').details[0]
    expect(detail).toContain('tags[] (1)')
    expect(detail).not.toContain('tags.1')
    expect(detail).toContain('and 4 more')
  })

  it('should report unreadable documents and collections it could not list', async () => {
    const r = await runDoctor({
      ...base,
      collections: ['posts', 'broken'],
      listDocuments: async (collection) => {
        if (collection === 'broken') throw new Error('connection reset')
        return []
      },
      listUnreadable: async (collection) => (collection === 'posts' ? ['corrupt.json'] : []),
    })
    const content = check(r, 'content')
    expect(content.status).toBe('fail')
    expect(content.details).toContainEqual(expect.stringContaining('posts: 1 stored document(s) cannot be read at all'))
    expect(content.details).toContainEqual(expect.stringContaining('corrupt.json'))
    expect(content.details).toContainEqual('broken: could not be listed, so it was not checked.')
    expect(JSON.stringify(r)).not.toContain('connection reset')
  })

  it('should page a capped adapter until it is empty, and stop a very large scan saying so', async () => {
    let calls = 0
    const r = await runDoctor({
      ...base,
      collections: ['a', 'b'],
      // Like Postgres: never more than 1000 a page, however many are asked for
      listDocuments: async (_c, limit, offset) => {
        calls++
        return Array.from({ length: Math.min(limit, 1000) }, (_, i) => ({ _id: `d${offset + i}`, _status: 'draft' }))
      },
    })
    expect(calls).toBe(MAX_SCANNED_DOCUMENTS / 1000 + 1)
    expect(check(r, 'content')).toMatchObject({ status: 'warn' })
    expect(check(r, 'content').details.at(-1)).toContain(`stopped after ${MAX_SCANNED_DOCUMENTS} documents`)
  })

  it('should read an uncapped adapter in one call, plus one that comes back empty', async () => {
    const limits: number[] = []
    const docs = Array.from({ length: 2500 }, (_, i) => ({ _id: `d${i}`, _status: 'draft' }))
    const r = await runDoctor({
      ...base,
      collections: ['posts'],
      listDocuments: async (_c, limit, offset) => {
        limits.push(limit)
        return docs.slice(offset, offset + limit)
      },
    })
    expect(limits).toEqual([MAX_SCANNED_DOCUMENTS, MAX_SCANNED_DOCUMENTS - 2500])
    expect(check(r, 'content').status).toBe('ok')
  })

  it('should not call a scan that ends exactly at the limit truncated', async () => {
    const docs = Array.from({ length: MAX_SCANNED_DOCUMENTS }, (_, i) => ({ _id: `d${i}`, _status: 'draft' }))
    const r = await runDoctor({
      ...base,
      collections: ['posts'],
      listDocuments: async (_c, limit, offset) => docs.slice(offset, offset + limit),
    })
    expect(check(r, 'content').status).toBe('ok')
  })

  it('should read every page of a large collection and cap the ids it names', async () => {
    const docs = Array.from({ length: 1203 }, (_, i) => ({ _id: `d${i}`, _status: 'draft' }))
    const r = await runDoctor({
      ...base,
      collections: ['big'],
      listDocuments: async (_c, limit, offset) => docs.slice(offset, offset + limit),
      validate: () => ({ valid: false, errors: [{ field: 'body', message: 'Required', code: 'custom' }] }),
    })
    // 1203 documents at 1000 a page: two pages, every document counted once
    const detail = check(r, 'content').details[0]
    expect(detail).toContain('big: 1203 document(s) fail validation, by field: body (1203)')
    expect(detail).toContain('d0, d1, d2, d3, d4 and 1198 more')
  })
})

describe('TrokkyCore.diagnose', () => {
  it('should share a scan that is still running, however long it takes', async () => {
    const { core, dataAdapter } = await setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const original = dataAdapter.listDocuments.bind(dataAdapter)
    const list = vi.spyOn(dataAdapter, 'listDocuments').mockImplementation(async (...args) => {
      await gate
      return original(...args)
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const first = core.diagnose()
      vi.setSystemTime(Date.now() + 5 * 60_000)
      const second = core.diagnose()
      expect(second).toBe(first)
      release()
      await first
      expect(list.mock.calls.length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('should share one scan between concurrent callers, reuse it for a minute, and page by id', async () => {
    const { core, dataAdapter } = await setup()
    const list = vi.spyOn(dataAdapter, 'listDocuments')
    const [a, b] = await Promise.all([core.diagnose(), core.diagnose()])
    expect(a).toBe(b)
    const callsAfterFirst = list.mock.calls.length
    expect(list.mock.calls[0][1]).toMatchObject({ sort: ['_id.asc'] })

    await core.diagnose()
    expect(list.mock.calls.length).toBe(callsAfterFirst)

    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 61_000)
      await core.diagnose()
      expect(list.mock.calls.length).toBeGreaterThan(callsAfterFirst)
    } finally {
      vi.useRealTimers()
    }
  })

})
