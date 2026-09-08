import { describe, it, expect } from 'vitest'
import {
  buildSavePayload,
  getSchemaFieldEntries,
  isIncompleteArrayItem,
  isMissingValue,
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
    expect(payload.gallery).toBeNull()
    expect(payload.seo).toBeNull()
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
})
