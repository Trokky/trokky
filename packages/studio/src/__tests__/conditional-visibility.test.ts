import { describe, it, expect, vi } from 'vitest'
import { evaluateConditional } from '../fields/definitions/ObjectField/validation.js'

/**
 * This used to exist twice, character for character, in DocumentForm and in
 * ObjectField/validation. These cases pin the behaviour the editor and the
 * object field now share.
 */
describe('evaluateConditional', () => {
  it('is the same function the document form re-exports', async () => {
    const form = await import('../components/document/DocumentForm.js')
    expect(form.evaluateConditional).toBe(evaluateConditional)
  })

  it('defaults to visible when a field declares no conditions', () => {
    expect(evaluateConditional({ name: 'title' }, {}).visible).toBe(true)
  })

  it('honours a boolean hidden flag in both directions', () => {
    expect(evaluateConditional({ hidden: true }, {}).visible).toBe(false)
    expect(evaluateConditional({ hidden: false }, {}).visible).toBe(true)
  })

  it('calls a function hidden flag with the document values', () => {
    const hidden = vi.fn((values: Record<string, unknown>) => values.kind === 'a')

    expect(evaluateConditional({ hidden }, { kind: 'a' }).visible).toBe(false)
    expect(evaluateConditional({ hidden }, { kind: 'b' }).visible).toBe(true)
    expect(hidden).toHaveBeenCalledWith({ kind: 'a' })
  })

  it('falls back to visible when a hidden function throws', () => {
    const hidden = () => {
      throw new Error('boom')
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(evaluateConditional({ hidden }, {}).visible).toBe(true)

    consoleError.mockRestore()
  })

  it.each([
    ['equals', 'draft', 'draft', true],
    ['equals', 'draft', 'published', false],
    ['notEquals', 'draft', 'published', true],
    ['greaterThan', 5, 3, true],
    ['greaterThan', 2, 3, false],
    ['lessThan', 2, 3, true],
  ])(
    'evaluates %s against %o / %o',
    (operator, actual, expected, visible) => {
      const result = evaluateConditional(
        { conditional: { field: 'status', value: expected, operator } },
        { status: actual }
      )
      expect(result.visible).toBe(visible)
    }
  )

  it('handles contains and notContains over strings and arrays', () => {
    const contains = (actual: unknown, value: unknown) =>
      evaluateConditional(
        { conditional: { field: 'tags', value, operator: 'contains' } },
        { tags: actual }
      ).visible

    expect(contains('hello world', 'world')).toBe(true)
    expect(contains(['a', 'b'], 'b')).toBe(true)
    expect(contains(['a', 'b'], 'c')).toBe(false)
    expect(contains(42, 'c')).toBe(false)

    const notContains = (actual: unknown, value: unknown) =>
      evaluateConditional(
        { conditional: { field: 'tags', value, operator: 'notContains' } },
        { tags: actual }
      ).visible

    expect(notContains(['a'], 'b')).toBe(true)
    expect(notContains('abc', 'b')).toBe(false)
  })

  it('treats empty string, null and undefined as not existing', () => {
    const exists = (value: unknown) =>
      evaluateConditional(
        { conditional: { field: 'slug', operator: 'exists' } },
        { slug: value }
      ).visible

    expect(exists('a-slug')).toBe(true)
    expect(exists('')).toBe(false)
    expect(exists(null)).toBe(false)
    expect(exists(undefined)).toBe(false)

    const notExists = (value: unknown) =>
      evaluateConditional(
        { conditional: { field: 'slug', operator: 'notExists' } },
        { slug: value }
      ).visible

    expect(notExists('')).toBe(true)
    expect(notExists('a-slug')).toBe(false)
  })

  it('combines multiple conditions with and by default, or on request', () => {
    const conditions = [
      { field: 'status', value: 'published' },
      { field: 'featured', value: true },
    ]

    const and = (values: Record<string, unknown>) =>
      evaluateConditional({ conditional: { field: 'status', conditions } }, values)
        .visible
    const or = (values: Record<string, unknown>) =>
      evaluateConditional(
        { conditional: { field: 'status', conditions, logic: 'or' } },
        values
      ).visible

    expect(and({ status: 'published', featured: true })).toBe(true)
    expect(and({ status: 'published', featured: false })).toBe(false)
    expect(or({ status: 'published', featured: false })).toBe(true)
    expect(or({ status: 'draft', featured: false })).toBe(false)
  })

  it('reports which fields it read, so callers can subscribe to them', () => {
    const result = evaluateConditional(
      {
        conditional: {
          field: 'status',
          conditions: [
            { field: 'status', value: 'published' },
            { field: 'featured', value: true },
          ],
        },
      },
      { status: 'published', featured: true }
    )

    expect(result.evaluatedFields).toEqual(['status', 'status', 'featured'])
  })

  it('hides the field on an unknown operator rather than guessing', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = evaluateConditional(
      { conditional: { field: 'status', value: 'x', operator: 'startsWith' } },
      { status: 'x' }
    )

    expect(result.visible).toBe(false)
    consoleWarn.mockRestore()
  })
})
