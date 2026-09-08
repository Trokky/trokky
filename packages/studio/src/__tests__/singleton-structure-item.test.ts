import { describe, it, expect } from 'vitest'
import { isSingletonStructureItem } from '../utils/singleton'

describe('isSingletonStructureItem', () => {
  it('should recognise a singleton structure entry', () => {
    expect(isSingletonStructureItem({ type: 'singleton' })).toBe(true)
  })

  it('should recognise a list whose schema declares itself a singleton', () => {
    // A custom structure may present a singleton schema as a list. The server enforces one
    // document regardless, so the Studio must not offer to create a second.
    expect(isSingletonStructureItem({ type: 'documentList', schemaIsSingleton: true })).toBe(true)
  })

  it('should treat an ordinary list as creatable', () => {
    expect(isSingletonStructureItem({ type: 'documentList', schemaIsSingleton: false })).toBe(false)
  })

  it('should treat a list from a server that does not send the flag as creatable', () => {
    expect(isSingletonStructureItem({ type: 'documentList' })).toBe(false)
  })

  it('should handle a missing item', () => {
    expect(isSingletonStructureItem(null)).toBe(false)
    expect(isSingletonStructureItem(undefined)).toBe(false)
  })
})
