import { describe, it, expect } from 'vitest'
import { normalizeIconValue } from '../definition.js'
import { IconFieldPlugin } from '../index.js'

describe('normalizeIconValue', () => {
  it('accepts the object form unchanged', () => {
    const v = { library: 'fontawesome' as const, name: 'fa-video', style: 'solid' }
    expect(normalizeIconValue(v)).toBe(v)
  })

  it('converts a legacy FontAwesome class string', () => {
    expect(normalizeIconValue('fas fa-th-large')).toEqual({
      library: 'fontawesome',
      name: 'fa-th-large',
      style: 'solid',
    })
  })

  it('maps every FontAwesome style prefix', () => {
    expect(normalizeIconValue('far fa-star')?.style).toBe('regular')
    expect(normalizeIconValue('fab fa-github')?.style).toBe('brands')
    expect(normalizeIconValue('fal fa-user')?.style).toBe('light')
    expect(normalizeIconValue('fad fa-bell')?.style).toBe('duotone')
  })

  it('parses a JSON-encoded object', () => {
    expect(normalizeIconValue('{"library":"lucide","name":"home"}')).toEqual({
      library: 'lucide',
      name: 'home',
    })
  })

  it('returns null for values it cannot use', () => {
    expect(normalizeIconValue('not an icon')).toBeNull()
    expect(normalizeIconValue('')).toBeNull()
    expect(normalizeIconValue(null)).toBeNull()
    expect(normalizeIconValue(42)).toBeNull()
  })
})

describe('icon field validation', () => {
  const def = { name: 'badgeIcon', type: 'icon' as const, title: 'Badge' }

  it('accepts a legacy string instead of reporting "Expected object, received string"', () => {
    const result = IconFieldPlugin.validate!('fas fa-th-large' as unknown as never, def as never)
    expect(result.errors).toEqual([])
    expect(result.isValid).toBe(true)
  })

  it('still accepts the object form', () => {
    const result = IconFieldPlugin.validate!(
      { library: 'fontawesome', name: 'fa-video', style: 'solid' },
      def as never
    )
    expect(result.isValid).toBe(true)
  })

  it('rejects a required field left empty', () => {
    const result = IconFieldPlugin.validate!(null, { ...def, required: true } as never)
    expect(result.isValid).toBe(false)
  })
})
