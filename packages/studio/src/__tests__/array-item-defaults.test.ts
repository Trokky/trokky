import { describe, it, expect } from 'vitest'
import { getDefaultItemValue } from '../fields/definitions/ArrayField/defaultItemValue'
import { getItemPreview } from '../fields/definitions/ArrayField/itemPreview'

describe('getDefaultItemValue', () => {
  it('should prefer an explicit default over the type default', () => {
    expect(getDefaultItemValue({ type: 'string', default: 'hello' })).toBe('hello')
    expect(getDefaultItemValue({ type: 'number', default: 0 })).toBe(0)
  })

  it('should give each primitive type its empty value', () => {
    expect(getDefaultItemValue({ type: 'string' })).toBe('')
    expect(getDefaultItemValue({ type: 'number' })).toBe(0)
    expect(getDefaultItemValue({ type: 'boolean' })).toBe(false)
    expect(getDefaultItemValue({ type: 'array' })).toEqual([])
  })

  it('should give a date the current time as an ISO string', () => {
    const value = getDefaultItemValue({ type: 'date' })
    expect(typeof value).toBe('string')
    expect(Number.isNaN(Date.parse(value))).toBe(false)
  })

  it('should stamp an object item with its _type and nested defaults', () => {
    expect(
      getDefaultItemValue({
        type: 'object',
        name: 'linkBlock',
        fields: { label: { default: 'Read more' }, href: {} },
      })
    ).toEqual({ _type: 'linkBlock', label: 'Read more' })
  })

  it('should give reference and media items the empty shape their field expects', () => {
    expect(getDefaultItemValue({ type: 'reference' })).toEqual({ _type: 'reference' })
    expect(getDefaultItemValue({ type: 'media' })).toEqual({ _type: 'media' })
    expect(getDefaultItemValue({ type: 'image' })).toEqual({ _type: 'media' })
  })

  it('should fall back to an empty object rather than null', () => {
    expect(getDefaultItemValue({ type: 'mystery' })).toEqual({})
    expect(getDefaultItemValue(undefined)).toEqual({})
  })
})

describe('getItemPreview', () => {
  it('should return nothing for a non-object item', () => {
    expect(getItemPreview('a string', { type: 'string' })).toEqual({})
    expect(getItemPreview(null, { type: 'object' })).toEqual({})
  })

  it('should use the explicit preview config when the field is present', () => {
    expect(
      getItemPreview(
        { heading: 'Budget', note: '2026' },
        { type: 'object', preview: { title: 'heading', subtitle: 'note' } }
      )
    ).toEqual({ title: 'Budget', subtitle: '2026' })
  })

  it('should fall back to auto-detection when the configured title field is empty', () => {
    expect(
      getItemPreview(
        { name: 'Ada' },
        { type: 'object', preview: { title: 'heading' } }
      )
    ).toEqual({ title: 'Ada' })
  })

  it('should try title, name, label and heading in that order', () => {
    expect(getItemPreview({ label: 'L', heading: 'H' }, { type: 'object' })).toEqual({ title: 'L' })
    expect(getItemPreview({ title: 'T', name: 'N' }, { type: 'object' })).toEqual({ title: 'T' })
  })

  it('should return nothing when nothing looks like a title', () => {
    expect(getItemPreview({ slug: 'x' }, { type: 'object' })).toEqual({})
  })
})
