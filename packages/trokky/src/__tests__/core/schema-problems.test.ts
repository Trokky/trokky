/**
 * Schema mistakes the parser used to let through silently: unknown top-level keys (dropped),
 * field types nothing knows (no validation, no editor), and `required` on types the validator
 * accepted anything for.
 */

import { describe, it, expect, vi } from 'vitest'
import { SchemaRegistry, findSchemaProblems, BUILTIN_FIELD_TYPES } from '../../core/schema/registry.js'
import { DocumentValidator } from '../../core/validation/validator.js'
import type { ContentSchema } from '../../core/types/index.js'

const schema = (extra: Record<string, unknown>, fields: Record<string, unknown> = { title: { type: 'string' } }) =>
  ({ name: 'page', type: 'document', fields, ...extra }) as unknown as ContentSchema

describe('findSchemaProblems', () => {
  it('should find nothing in a correct schema', () => {
    expect(
      findSchemaProblems(
        schema({ title: 'Page', description: 'x', singleton: true }, {
          title: { type: 'string', required: true },
          body: { type: 'richtext' },
          blocks: { type: 'array', of: { type: 'object', fields: { heading: { type: 'text' } } } },
          location: { type: 'geoCoordinate' },
        })
      )
    ).toEqual([])
  })

  it.each([
    ['isSingleton', 'singleton'],
    ['Fields', 'fields'],
    ['label', 'title'],
    ['titel', 'title'],
    ['descripton', 'description'],
  ])('should name the unknown key %s and suggest %s', (key, hint) => {
    const [problem] = findSchemaProblems(schema({ [key]: true }))
    expect(problem).toContain(`unknown key "${key}" is ignored`)
    expect(problem).toContain(`did you mean "${hint}"?`)
  })

  it.each([
    ['displayName', 'title'],
    ['Properties', 'fields'],
    ['FIELD', 'fields'],
  ])('should use the hint table, whatever the case, for %s', (key, hint) => {
    expect(findSchemaProblems(schema({ [key]: true }))[0]).toContain(`did you mean "${hint}"?`)
  })

  it('should match spelling without regard to case', () => {
    // three edits from "description" case-sensitively, none case-insensitively
    expect(findSchemaProblems(schema({ DESCription: 'x' }))[0]).toContain('did you mean "description"?')
  })

  it.each([
    ['file', 'date is two edits away but not a typo of it'],
    ['json', 'icon is two edits away but not a typo of it'],
    ['vidia', 'media and video tie, so neither is the answer'],
  ])('should not suggest a type for %s (%s)', (type) => {
    const [problem] = findSchemaProblems(schema({}, { f: { type } }))
    expect(problem).toContain(`has type "${type}"`)
    expect(problem).not.toContain('did you mean')
  })

  it('should not suggest anything three edits away', () => {
    expect(findSchemaProblems(schema({ titlexyz: 1 }))[0]).not.toContain('did you mean')
  })

  it('should ignore a field without a type', () => {
    expect(findSchemaProblems(schema({}, { loose: { title: 'No type' } }))).toEqual([])
  })

  it('should report an unknown key with nothing close without a suggestion', () => {
    const [problem] = findSchemaProblems(schema({ icon: 'file' }))
    expect(problem).toContain('unknown key "icon"')
    expect(problem).not.toContain('did you mean')
  })

  it('should name a misspelt field type and suggest the built-in one', () => {
    const [problem] = findSchemaProblems(schema({}, { body: { type: 'richText' } }))
    expect(problem).toContain('field "body" has type "richText"')
    expect(problem).toContain('did you mean "richtext"?')
  })

  it('should find unknown types inside objects, arrays and array-form fields', () => {
    const problems = findSchemaProblems(
      schema({}, {
        seo: { type: 'object', fields: { image: { type: 'imagee' } } },
        gallery: { type: 'array', of: { type: 'picture' } },
        slides: { type: 'array', of: [{ name: 'slide', type: 'slyde' }] },
        links: { type: 'object', fields: [{ name: 'href', type: 'link' }] },
      })
    )
    expect(problems).toHaveLength(4)
    expect(problems[0]).toContain('field "seo.image" has type "imagee"')
    expect(problems[1]).toContain('field "gallery.[]" has type "picture"')
    expect(problems[2]).toContain('field "slides.slide" has type "slyde"')
    expect(problems[3]).toContain('field "links.href" has type "link"')
  })

  it('should accept the types listed in customFieldTypes', () => {
    expect(findSchemaProblems(schema({}, { rating: { type: 'stars' } }), ['stars'])).toEqual([])
  })

  it('should know every type the Studio registers', () => {
    expect(BUILTIN_FIELD_TYPES).toHaveLength(23)
    for (const type of BUILTIN_FIELD_TYPES) {
      expect(findSchemaProblems(schema({}, { f: { type } }))).toEqual([])
    }
  })
})

describe('SchemaRegistry schema problems', () => {
  it('should warn and still load the schema by default', () => {
    const warn = vi.mocked(console.warn)
    warn.mockClear()
    const registry = new SchemaRegistry([schema({ isSingleton: true })])
    expect(registry.hasSchema('page')).toBe(true)
    const messages = warn.mock.calls.flat().map((line) => JSON.parse(String(line)).message as string)
    expect(messages).toContainEqual(expect.stringContaining('Schema "page": unknown key "isSingleton"'))
  })

  it('should refuse the schema under strictSchemas, listing every problem', () => {
    expect(
      () => new SchemaRegistry([schema({ isSingleton: true }, { body: { type: 'richText' } })], { strictSchemas: true })
    ).toThrow(/strictSchemas[\s\S]*isSingleton[\s\S]*richText/)
  })

  it('should load a custom field type under strictSchemas when it is declared', () => {
    const registry = new SchemaRegistry([schema({}, { rating: { type: 'stars' } })], {
      strictSchemas: true,
      customFieldTypes: ['stars'],
    })
    expect(registry.hasSchema('page')).toBe(true)
  })
})

describe('required on every field type', () => {
  const validator = new DocumentValidator(
    new SchemaRegistry([
      schema({}, {
        body: { type: 'richtext', required: true },
        cover: { type: 'media', required: true },
        publishedAt: { type: 'date', required: true },
        colour: { type: 'color' },
        seo: { type: 'object', fields: { summary: { type: 'text', required: true } } },
      }),
    ], { autoThumbnail: { enabled: false }, autoSlug: { enabled: false } })
  )
  const valid = {
    body: '<p>Hello</p>',
    cover: { _type: 'media', asset: { _ref: 'm1', _type: 'mediaAsset' } },
    publishedAt: '2026-11-08',
    seo: { summary: 'Short' },
  }
  const errorFields = (data: Record<string, unknown>, options?: { allowMissingRequired?: boolean }) =>
    validator.validateDocument('page', data, options).errors.map((e) => e.field)

  it('should accept a document with every required field filled', () => {
    expect(errorFields(valid)).toEqual([])
  })

  it.each(['body', 'cover', 'publishedAt'])('should reject a missing required %s', (field) => {
    const { [field]: _, ...rest } = valid as Record<string, unknown>
    expect(errorFields(rest)).toEqual([field])
  })

  it.each(['body', 'cover', 'publishedAt'])('should reject a null required %s', (field) => {
    expect(errorFields({ ...valid, [field]: null })).toEqual([field])
  })

  it('should reject a missing required property inside an object', () => {
    expect(errorFields({ ...valid, seo: {} })).toEqual(['seo.summary'])
  })

  it('should still accept null and absence for an optional field of any type', () => {
    expect(errorFields({ ...valid, colour: null })).toEqual([])
    expect(errorFields({ ...valid, colour: undefined })).toEqual([])
  })

  it('should relax required properties inside objects too when the caller allows it', () => {
    expect(errorFields({ seo: {} }, { allowMissingRequired: true })).toEqual([])
  })

  it('should accept missing required fields only when the caller allows it', () => {
    expect(errorFields({}, { allowMissingRequired: true })).toEqual([])
    expect(errorFields({})).toEqual(['body', 'cover', 'publishedAt'])
  })
})

describe('TrokkyCore.saveDocument required fields', () => {
  it('should refuse empty required fields unless the caller allows them', async () => {
    const { createTestCore } = await import('../helpers/test-helpers.js')
    const { core } = createTestCore({
      schemas: [schema({ singleton: true }, { body: { type: 'richtext', required: true } })],
      enableSecurity: false,
    })
    await core.init()
    await expect(core.saveDocument('page', { id: 'page' })).rejects.toThrow(/validation failed/i)
    const saved = await core.saveDocument('page', { id: 'page' }, undefined, { allowMissingRequired: true })
    expect(saved._id ?? (saved as { id?: string }).id).toBe('page')
  })
})

describe('required in nested definitions', () => {
  const validator = new DocumentValidator(
    new SchemaRegistry([
      schema({}, {
        links: { type: 'object', fields: [{ name: 'href', title: 'Href', type: 'url', required: true }] },
        covers: { type: 'array', of: { type: 'media', required: true } },
        notes: { type: 'array', of: { type: 'text' } },
      }),
    ], { autoThumbnail: { enabled: false }, autoSlug: { enabled: false } })
  )
  const errorFields = (data: Record<string, unknown>) =>
    validator.validateDocument('page', data).errors.map((e) => e.field)

  it('should key array-form object fields by name, not index', () => {
    expect(errorFields({ links: { href: 'https://example.com' } })).toEqual([])
    expect(errorFields({ links: {} })).toEqual(['links.href'])
  })

  it('should refuse a null item in an array of required items', () => {
    expect(errorFields({ covers: [null] })).toEqual(['covers.0'])
  })

  it('should leave optional array items as they were', () => {
    expect(errorFields({ notes: ['a', 'b'] })).toEqual([])
  })
})

describe('PUT status changes and required fields', () => {
  it('should unpublish a document with an empty required field, but not publish it', async () => {
    const { createTestRoutes, createAuthenticatedUser, createMockRequest, executeRoute } = await import('../helpers/test-helpers.js')
    const { routes, core, dataAdapter } = await createTestRoutes({
      schemas: [schema({}, { title: { type: 'string' }, body: { type: 'richtext', required: true } })],
    })
    const { token } = await createAuthenticatedUser(core, { role: 'admin' })
    // A document stored before body became required
    await dataAdapter.saveDocument('page', 'p1', { title: 'Old', _status: 'published' })
    const put = (body: Record<string, unknown>) =>
      executeRoute(
        routes,
        createMockRequest({
          method: 'PUT',
          path: '/api/collections/page/p1',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: { data: body },
        })
      )

    expect((await put({ _status: 'draft' })).status).toBe(200)
    expect((await put({ _status: 'published' })).status).toBe(400)
    expect((await put({ _status: 'draft', title: 'Edited' })).status).toBe(400)
  })
})
