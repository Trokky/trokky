import { describe, it, expect } from 'vitest'
import {
  buildSavePayload,
  getSchemaFieldEntries,
  isIncompleteArrayItem,
  isMissingValue,
  ITEM_KEY,
  resolveFieldDefault,
  ensureItemKeys,
  stripItemKeys,
} from '../components/document/savePayload'

const schema = {
  name: 'article',
  fields: {
    title: { type: 'string' },
    views: { type: 'number' },
    featured: { type: 'boolean' },
    subtitle: { type: 'string' },
    gallery: { type: 'array' },
    seo: { type: 'object' },
  },
}

describe('getSchemaFieldEntries', () => {
  it('should normalise object-form fields', () => {
    expect(getSchemaFieldEntries({ fields: { a: { type: 'string' } } })).toEqual([
      { name: 'a', definition: { type: 'string' } },
    ])
  })

  it('should normalise array-form fields', () => {
    expect(
      getSchemaFieldEntries({ fields: [{ name: 'a', type: 'string' }] })
    ).toEqual([{ name: 'a', definition: { name: 'a', type: 'string' } }])
  })

  it('should return an empty list for a schema without fields', () => {
    expect(getSchemaFieldEntries(null)).toEqual([])
    expect(getSchemaFieldEntries({})).toEqual([])
  })
})

describe('isMissingValue', () => {
  it('should treat undefined, null, empty string and empty array as missing', () => {
    expect(isMissingValue(undefined)).toBe(true)
    expect(isMissingValue(null)).toBe(true)
    expect(isMissingValue('')).toBe(true)
    expect(isMissingValue([])).toBe(true)
  })

  it('should not treat 0 or false as missing', () => {
    expect(isMissingValue(0)).toBe(false)
    expect(isMissingValue(false)).toBe(false)
    expect(isMissingValue([1])).toBe(false)
    expect(isMissingValue({})).toBe(false)
  })
})

describe('isIncompleteArrayItem', () => {
  it('should flag media items without a resolved asset', () => {
    expect(isIncompleteArrayItem({ _type: 'media' })).toBe(true)
    expect(isIncompleteArrayItem({ _type: 'media', asset: {} })).toBe(true)
  })

  it('should keep media items with an asset reference', () => {
    expect(
      isIncompleteArrayItem({ _type: 'media', asset: { _ref: 'img-1' } })
    ).toBe(false)
  })

  it('should flag reference items without a target', () => {
    expect(isIncompleteArrayItem({ _type: 'reference' })).toBe(true)
    expect(isIncompleteArrayItem({ _type: 'reference', _ref: 'doc-1' })).toBe(
      false
    )
  })

  it('should keep plain values and other item types', () => {
    expect(isIncompleteArrayItem('text')).toBe(false)
    expect(isIncompleteArrayItem(null)).toBe(false)
    expect(isIncompleteArrayItem({ _type: 'block' })).toBe(false)
  })
})

describe('buildSavePayload', () => {
  it('should drop system keys and keep _status and _type', () => {
    const payload = buildSavePayload(
      {
        _id: 'abc',
        id: 'abc',
        _type: 'article',
        _status: 'published',
        _createdAt: '2026-01-01T00:00:00.000Z',
        _updatedAt: '2026-01-02T00:00:00.000Z',
        _revision: 3,
        _createdBy: 'admin',
        title: 'Hello',
        views: 5,
        featured: true,
        subtitle: 'Sub',
        gallery: [],
        seo: {},
      },
      schema
    )

    expect(Object.keys(payload).sort()).toEqual(
      [
        '_status',
        '_type',
        'featured',
        'gallery',
        'seo',
        'subtitle',
        'title',
        'views',
      ].sort()
    )
    expect(payload._status).toBe('published')
    expect(payload._type).toBe('article')
  })

  it('should convert undefined schema fields to null', () => {
    const payload = buildSavePayload({ title: 'Hello' }, schema)

    expect(payload.subtitle).toBeNull()
    expect(payload.views).toBeNull()
    expect(payload.featured).toBeNull()
    expect(payload.seo).toBeNull()
  })

  it('should send an empty array for undefined array fields', () => {
    const payload = buildSavePayload({ title: 'Hello' }, schema)

    expect(payload.gallery).toEqual([])
  })

  it('should preserve falsy but meaningful values', () => {
    const payload = buildSavePayload(
      { title: '', views: 0, featured: false },
      schema
    )

    expect(payload.title).toBe('')
    expect(payload.views).toBe(0)
    expect(payload.featured).toBe(false)
  })

  it('should strip incomplete media and reference items from array fields', () => {
    const payload = buildSavePayload(
      {
        gallery: [
          { _type: 'media', asset: { _ref: 'img-1' } },
          { _type: 'media' },
          { _type: 'media', asset: {} },
          { _type: 'reference', _ref: 'doc-1' },
          { _type: 'reference' },
          'plain',
        ],
      },
      schema
    )

    expect(payload.gallery).toEqual([
      { _type: 'media', asset: { _ref: 'img-1' } },
      { _type: 'reference', _ref: 'doc-1' },
      'plain',
    ])
  })

  it('should clear values whose shape does not match the schema type', () => {
    const payload = buildSavePayload({ gallery: { a: 1 }, seo: [1, 2] }, schema)

    expect(payload.gallery).toEqual([])
    expect(payload.seo).toEqual({})
  })

  it('should fall back to the given status and the schema name for _type', () => {
    const payload = buildSavePayload({ title: 'Hi' }, schema, 'review')

    expect(payload._status).toBe('review')
    expect(payload._type).toBe('article')
  })

  it('should support array-form schema fields', () => {
    const payload = buildSavePayload(
      { _id: 'x', title: 'Hi' },
      { name: 'page', fields: [{ name: 'title', type: 'string' }] }
    )

    expect(payload).toEqual({ title: 'Hi', _status: 'draft', _type: 'page' })
  })

  describe('editor-managed publishedAt', () => {
    const schema = { name: 'article', fields: { title: { type: 'string' } } }

    it('keeps publishedAt even though the schema does not declare it', () => {
      const payload = buildSavePayload(
        { title: 'A', publishedAt: '2026-01-01T00:00:00.000Z', _status: 'published' },
        schema
      )
      expect(payload.publishedAt).toBe('2026-01-01T00:00:00.000Z')
    })

    it('sends null when the document was reverted to draft', () => {
      const payload = buildSavePayload({ title: 'A', publishedAt: null, _status: 'draft' }, schema)
      expect(payload.publishedAt).toBeNull()
    })

    it('omits publishedAt entirely when the document never had one', () => {
      const payload = buildSavePayload({ title: 'A' }, schema)
      expect('publishedAt' in payload).toBe(false)
    })
  })

  describe('array cleaning', () => {
    const schema = { name: 'article', fields: { gallery: { type: 'array' } } }

    it('drops null and undefined slots left in a stored array', () => {
      const payload = buildSavePayload({ gallery: ['a', null, 'b', undefined] }, schema)
      expect(payload.gallery).toEqual(['a', 'b'])
    })

    it('keeps complete media and reference items with their nested keys', () => {
      const gallery = [
        { _type: 'media', asset: { _ref: 'img-1', _type: 'mediaAsset' } },
        { _type: 'reference', _ref: 'doc-1' }
      ]
      const payload = buildSavePayload({ gallery }, schema)
      expect(payload.gallery).toEqual(gallery)
    })
  })

  describe('portable text content keys survive a save', () => {
    // `_key` is content for portable text: a span's marks[] points at a markDef
    // by it. The editor's own item marker must never collide with it.
    const schema = { name: 'page', fields: { body: { type: 'portable' } } }
    const body = {
      blocks: [
        {
          _type: 'block',
          _key: 'b1',
          children: [{ _type: 'span', _key: 's1', text: 'see this', marks: ['link1'] }],
          markDefs: [{ _key: 'link1', _type: 'link', href: 'https://example.org' }]
        }
      ]
    }

    it('keeps every _key so link associations stay intact', () => {
      const payload = buildSavePayload({ body }, schema)
      expect(payload.body).toEqual(body)
      const block = (payload.body as any).blocks[0]
      expect(block.markDefs[0]._key).toBe('link1')
      expect(block.children[0].marks).toContain(block.markDefs[0]._key)
    })

    it('still removes the editor-only item marker at every depth', () => {
      const withMarkers = {
        blocks: [{ _type: 'block', _key: 'b1', [ITEM_KEY]: 'editor-1', children: [] }]
      }
      const payload = buildSavePayload({ body: withMarkers }, schema)
      const block = (payload.body as any).blocks[0]
      expect(block._key).toBe('b1')
      expect(ITEM_KEY in block).toBe(false)
    })
  })

  describe('schema defaults for a new document', () => {
    // Most plugins ignore `default` and return their own empty value, so the
    // declared default must win; only sentinels go to the plugin.
    const plugins: Record<string, any> = {
      string: { getDefaultValue: () => '' },
      boolean: { getDefaultValue: () => false },
      slug: { getDefaultValue: () => 'untitled' },
      number: { getDefaultValue: () => '' },
      date: { getDefaultValue: () => '2026-09-08' },
      broken: { getDefaultValue: () => { throw new Error('boom') } }
    }
    const getPlugin = (type: string) => plugins[type]

    it('uses the schema-declared default verbatim', () => {
      expect(resolveFieldDefault({ type: 'string', default: 'Hello' }, getPlugin)).toBe('Hello')
      expect(resolveFieldDefault({ type: 'boolean', default: true }, getPlugin)).toBe(true)
      expect(resolveFieldDefault({ type: 'slug', default: 'my-slug' }, getPlugin)).toBe('my-slug')
      expect(resolveFieldDefault({ type: 'number', default: 5 }, getPlugin)).toBe(5)
    })

    it('resolves a sentinel through the plugin', () => {
      expect(resolveFieldDefault({ type: 'date', default: 'now' }, getPlugin)).toBe('2026-09-08')
    })

    it('falls back to the sentinel when the plugin is missing or throws', () => {
      expect(resolveFieldDefault({ type: 'nope', default: 'now' }, getPlugin)).toBe('now')
      expect(resolveFieldDefault({ type: 'broken', default: 'now' }, getPlugin)).toBe('now')
    })

    it('leaves an undeclared default undefined', () => {
      expect(resolveFieldDefault({ type: 'string' }, getPlugin)).toBeUndefined()
    })
  })

  describe('values the marker machinery must not damage', () => {
    it('leaves a Date inside an array intact instead of spreading it to {}', () => {
      const date = new Date(0)
      const out = ensureItemKeys({ dates: [date] })
      expect(out.dates[0]).toBeInstanceOf(Date)
      expect(out.dates[0].getTime()).toBe(0)
    })

    it('keeps content named prototype or constructor', () => {
      const out = stripItemKeys({ prototype: 'content', constructor: 'content', _key: 'keep' })
      expect(out).toEqual({ prototype: 'content', constructor: 'content', _key: 'keep' })
    })

    it('drops a content __proto__ key rather than re-pointing the clone', () => {
      const hostile = JSON.parse('{"__proto__": {"polluted": true}, "items": [{"a": 1}]}')
      const out = ensureItemKeys(hostile)
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
      expect(({} as any).polluted).toBeUndefined()
      // the marker stripper still recognises the clone as a plain object
      expect(ITEM_KEY in stripItemKeys(out).items[0]).toBe(false)
    })

    it('only resolves the now sentinel, and only for date-like fields', () => {
      const getPlugin = () => ({ getDefaultValue: () => 'PLUGIN' })
      expect(resolveFieldDefault({ type: 'string', default: 'now' }, getPlugin)).toBe('now')
      expect(resolveFieldDefault({ type: 'date', default: 'today' }, getPlugin)).toBe('today')
      expect(resolveFieldDefault({ type: 'date', default: 'now' }, getPlugin)).toBe('PLUGIN')
    })
  })

  describe('unset versus cleared', () => {
    const schema = {
      name: 'article',
      fields: {
        title: { type: 'string' },
        featured: { type: 'boolean', default: true },
        author: { type: 'reference' },
        tags: { type: 'array' }
      }
    }

    it('omits a field the editor never set, so the stored value survives', () => {
      const loaded = { title: 'A' }
      const payload = buildSavePayload({ title: 'A' }, schema, 'draft', loaded)
      expect(payload.title).toBe('A')
      // featured has a schema default the editor never rendered: sending null
      // would overwrite it in storage.
      expect('featured' in payload).toBe(false)
      expect('author' in payload).toBe(false)
      expect('tags' in payload).toBe(false)
    })

    it('sends null for a field that had a value and is now gone', () => {
      const loaded = { title: 'A', author: { _ref: 'author-1' }, featured: true }
      const current = { title: 'A' }
      const payload = buildSavePayload(current, schema, 'draft', loaded)
      expect(payload.author).toBeNull()
      expect(payload.featured).toBeNull()
    })

    it('sends an empty list for an array that had items and is now empty', () => {
      const payload = buildSavePayload({ title: 'A' }, schema, 'draft', { title: 'A', tags: ['x'] })
      expect(payload.tags).toEqual([])
    })

    it('still sends an explicit null the editor set', () => {
      const payload = buildSavePayload({ title: 'A', author: null }, schema, 'draft', { title: 'A' })
      expect(payload.author).toBeNull()
    })

    it('ships every schema field on a create, where nothing stored can be lost', () => {
      const payload = buildSavePayload({ title: 'New' }, schema, 'draft')
      expect(payload.title).toBe('New')
      expect(payload.featured).toBeNull()
      expect(payload.tags).toEqual([])
      expect(payload._status).toBe('draft')
    })
  })
})
