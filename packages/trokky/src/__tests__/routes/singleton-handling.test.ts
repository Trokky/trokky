/**
 * The schema decides whether a collection is a singleton.
 *
 * These cover the two handlers that used to answer that question from the project's
 * structure (or, with no structure configured, from a hardcoded list of collection
 * names): the duplicate-create guard and singleton auto-creation on read.
 */

import { describe, it, expect, vi } from 'vitest'
import { TrokkyRoutes } from '../../routes/index.js'
import { createMockCore } from '../helpers/mock-core.js'
import type { HttpRequest } from '../../routes/types.js'

const schema = (name: string, extra: Record<string, unknown> = {}) =>
  ({ name, title: name, type: 'document', fields: {}, ...extra }) as any

function setup(options: {
  schemas: any[]
  structureConfig?: any
  existingDocuments?: any[]
  getDocument?: any
}) {
  const core = createMockCore({
    getSchema: vi.fn((name: string) => options.schemas.find(s => s.name === name) || null),
    getAllSchemas: vi.fn(() => options.schemas),
    listDocuments: vi.fn(async () => options.existingDocuments ?? []),
    getDocument: options.getDocument ?? vi.fn(async () => null),
  })

  const routes = new TrokkyRoutes({
    core: core as any,
    structureConfig: options.structureConfig,
  } as any)

  return { core, routes }
}

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method: 'GET',
    path: '/collections/settings',
    headers: { authorization: 'Bearer jwt-token-123' },
    params: {},
    query: {},
    body: undefined,
    ...overrides,
  }
}

async function create(routes: TrokkyRoutes, collection: string, data: Record<string, unknown> = {}) {
  const route = routes.findRoute('POST', `/collections/${collection}`)!
  return route.handler(
    makeRequest({
      method: 'POST',
      path: `/collections/${collection}`,
      params: { collection },
      body: { data },
    })
  )
}

async function read(routes: TrokkyRoutes, collection: string, id: string) {
  const route = routes.findRoute('GET', `/collections/${collection}/${id}`)!
  return route.handler(
    makeRequest({
      path: `/collections/${collection}/${id}`,
      params: { collection, id },
    })
  )
}

describe('singleton duplicate-create guard', () => {
  it('should reject a second document in a collection whose schema is a singleton', async () => {
    const { routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      existingDocuments: [{ id: 'settings' }],
    })

    const response = await create(routes, 'settings', { title: 'Second' })

    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain('Singleton document already exists')
  })

  it('should reject the duplicate with no structure configured at all', async () => {
    const { routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      existingDocuments: [{ id: 'settings' }],
      structureConfig: undefined,
    })

    expect((await create(routes, 'settings', {})).status).toBe(400)
  })

  it('should allow the first document in a singleton collection', async () => {
    const { routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      existingDocuments: [],
    })

    expect((await create(routes, 'settings', { title: 'First' })).status).toBe(201)
  })

  it('should not guard a collection the structure calls a singleton when the schema does not', async () => {
    // The divergence that used to regenerate document ids on restore. The boot-time
    // consistency check now rejects this configuration outright; the handler must not
    // silently act on the structure's word in the meantime.
    const { routes } = setup({
      schemas: [schema('actualites')],
      structureConfig: {
        items: [{ type: 'singleton', schemaType: 'actualites', documentId: 'actualites' }],
      },
      existingDocuments: [{ id: 'actualites' }],
    })

    expect((await create(routes, 'actualites', { title: 'Second' })).status).toBe(201)
  })

  it('should not treat a collection as a singleton because of its name', async () => {
    // 'settings', 'config', 'homePage' and 'siteSettings' were hardcoded as singletons
    // whenever no structure function was configured. ('config' is absent here because it
    // is a reserved collection name, so that entry could never match a real collection.)
    for (const name of ['settings', 'homePage', 'siteSettings']) {
      const { routes } = setup({
        schemas: [schema(name)],
        existingDocuments: [{ id: `${name}-001` }],
      })

      expect((await create(routes, name, { title: 'Second' })).status).toBe(201)
    }
  })
})

describe('singleton auto-creation on read', () => {
  it('should create the singleton document on first read', async () => {
    const { core, routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      structureConfig: { items: [{ type: 'singleton', schemaType: 'settings' }] },
    })

    const response = await read(routes, 'settings', 'settings')

    expect(response.status).toBe(200)
    expect(core.saveDocument).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({ id: 'settings' }),
      expect.anything()
    )
  })

  it('should use the document id the structure names', async () => {
    const { core, routes } = setup({
      schemas: [schema('homepage', { singleton: true })],
      structureConfig: { items: [{ type: 'singleton', schemaType: 'homepage', documentId: 'home' }] },
    })

    expect((await read(routes, 'homepage', 'home')).status).toBe(200)
    expect(core.saveDocument).toHaveBeenCalledWith(
      'homepage',
      expect.objectContaining({ id: 'home' }),
      expect.anything()
    )
  })

  it('should 404 rather than conjure a document under any other id', async () => {
    const { core, routes } = setup({
      schemas: [schema('homepage', { singleton: true })],
      structureConfig: { items: [{ type: 'singleton', schemaType: 'homepage', documentId: 'home' }] },
    })

    expect((await read(routes, 'homepage', 'anything-else')).status).toBe(404)
    expect(core.saveDocument).not.toHaveBeenCalled()
  })

  it('should fall back to the collection name when no structure entry names an id', async () => {
    const { core, routes } = setup({ schemas: [schema('settings', { singleton: true })] })

    expect((await read(routes, 'settings', 'settings')).status).toBe(200)
    expect(core.saveDocument).toHaveBeenCalled()
  })

  it('should respect options.autoCreate: false', async () => {
    const { core, routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      structureConfig: {
        items: [{ type: 'singleton', schemaType: 'settings', options: { autoCreate: false } }],
      },
    })

    expect((await read(routes, 'settings', 'settings')).status).toBe(404)
    expect(core.saveDocument).not.toHaveBeenCalled()
  })

  it('should not mint a second document when the singleton is stored under another id', async () => {
    // A restore preserves the id the backup carried, which need not be the id the structure
    // asks for. Reading the structure's id must not conjure up an empty duplicate: the read
    // path would otherwise break the invariant the create guard enforces.
    const { core, routes } = setup({
      schemas: [schema('homepage', { singleton: true })],
      structureConfig: { items: [{ type: 'singleton', schemaType: 'homepage', documentId: 'home' }] },
      existingDocuments: [{ id: 'homepage' }],
    })

    expect((await read(routes, 'homepage', 'home')).status).toBe(404)
    expect(core.saveDocument).not.toHaveBeenCalled()
  })

  it('should not let a read-only request create a document in a populated singleton', async () => {
    const { core, routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      existingDocuments: [{ id: 'settings-001' }],
    })

    expect((await read(routes, 'settings', 'settings')).status).toBe(404)
    expect(core.saveDocument).not.toHaveBeenCalled()
  })

  it('should auto-create the document each structure entry names', async () => {
    const { core, routes } = setup({
      schemas: [schema('page', { singleton: true })],
      structureConfig: {
        items: [
          { type: 'singleton', schemaType: 'page', documentId: 'first' },
          { type: 'singleton', schemaType: 'page', documentId: 'second' },
        ],
      },
    })

    expect((await read(routes, 'page', 'second')).status).toBe(200)
    expect(core.saveDocument).toHaveBeenCalledWith(
      'page',
      expect.objectContaining({ id: 'second' }),
      expect.anything()
    )
  })

  it('should not auto-create for a collection the schema does not call a singleton', async () => {
    const { core, routes } = setup({
      schemas: [schema('actualites')],
      structureConfig: { items: [{ type: 'singleton', schemaType: 'actualites' }] },
    })

    expect((await read(routes, 'actualites', 'actualites')).status).toBe(404)
    expect(core.saveDocument).not.toHaveBeenCalled()
  })

  it('should resolve a structure supplied as a function', async () => {
    const { core, routes } = setup({
      schemas: [schema('homepage', { singleton: true })],
      structureConfig: () => ({
        items: [{ type: 'singleton', schemaType: 'homepage', documentId: 'home' }],
      }),
    })

    expect((await read(routes, 'homepage', 'home')).status).toBe(200)
    expect(core.saveDocument).toHaveBeenCalledWith(
      'homepage',
      expect.objectContaining({ id: 'home' }),
      expect.anything()
    )
  })

  it('should still serve the schema default when the structure function throws', async () => {
    const { routes } = setup({
      schemas: [schema('settings', { singleton: true })],
      structureConfig: () => {
        throw new Error('structure blew up')
      },
    })

    expect((await read(routes, 'settings', 'settings')).status).toBe(200)
  })
})

describe('auto-generated structure', () => {
  async function getStructure(routes: TrokkyRoutes) {
    const route = routes.findRoute('GET', '/config/structure')!
    const response = await route.handler(makeRequest({ path: '/config/structure' }))
    return (response.body as any)?.data?.structure
  }

  it('should present a singleton schema as a singleton, not a list', async () => {
    // A documentList would give the Studio a Create button whose save the server rejects.
    const { routes } = setup({ schemas: [schema('settings', { singleton: true }), schema('article')] })

    const structure = await getStructure(routes)
    const byType = Object.fromEntries(
      structure.items
        .filter((item: any) => item.schemaType)
        .map((item: any) => [item.schemaType, item])
    )

    expect(byType.settings.type).toBe('singleton')
    expect(byType.settings.documentId).toBe('settings')
    expect(byType.article.type).toBe('documentList')
  })

  it('should mark a custom structure list whose schema is a singleton', async () => {
    const { routes } = setup({
      schemas: [schema('settings', { singleton: true }), schema('article')],
      structureConfig: {
        items: [
          { type: 'documentList', schemaType: 'settings' },
          { type: 'documentList', schemaType: 'article' },
        ],
      },
    })

    const structure = await getStructure(routes)
    const byType = Object.fromEntries(
      structure.items.map((item: any) => [item.schemaType, item])
    )

    expect(byType.settings.schemaIsSingleton).toBe(true)
    expect(byType.article.schemaIsSingleton).toBe(false)
  })
})
