import { describe, it, expect } from 'vitest'
import { SchemaRegistry, normalizeSchemaFields } from '../../core/schema/registry.js'
import type { ContentSchema } from '../../core/types/index.js'

// The Go CLI scaffold (and Sanity-style configs) write fields as an array.
const arrayForm = {
  name: 'article',
  title: 'Article',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string', required: true },
    { name: 'body', title: 'Body', type: 'richtext' },
  ],
} as unknown as ContentSchema

describe('schema fields in array form', () => {
  it('normalizes the array form to a record keyed by field name', () => {
    const out = normalizeSchemaFields(arrayForm)
    expect(Object.keys(out.fields)).toEqual(['title', 'body'])
    expect(out.fields.title).toMatchObject({ title: 'Title', type: 'string', required: true })
    expect(out.fields.title).not.toHaveProperty('name')
  })

  it('leaves the record form untouched', () => {
    const rec = { name: 'page', title: 'Page', type: 'document', fields: { title: { type: 'string', title: 'Title' } } } as ContentSchema
    expect(normalizeSchemaFields(rec)).toBe(rec)
  })

  it('registers an array-form schema and exposes record fields to consumers', () => {
    const registry = new SchemaRegistry([arrayForm])
    const stored = registry.getSchema('article')!
    expect(Object.keys(stored.fields)).toEqual(expect.arrayContaining(['title', 'body']))
    expect(Object.keys(stored.fields)).not.toContain('0')
  })

  it('rejects duplicate or unnamed fields in array form', () => {
    const dup = { ...arrayForm, fields: [{ name: 'a', type: 'string', title: 'A' }, { name: 'a', type: 'string', title: 'A' }] } as unknown as ContentSchema
    expect(() => normalizeSchemaFields(dup)).toThrow(/duplicate field "a"/)
    const unnamed = { ...arrayForm, fields: [{ type: 'string', title: 'A' }] } as unknown as ContentSchema
    expect(() => normalizeSchemaFields(unnamed)).toThrow(/non-empty "name"/)
  })
})
