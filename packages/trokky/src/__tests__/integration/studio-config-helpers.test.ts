import { describe, it, expect, afterEach } from 'vitest'
import { resolveStudioUrl, ignoredStudioKeys, assertStudioConfigShape } from '../../integrations/express/config.js'

describe('studio config helpers', () => {
  const saved = process.env.STUDIO_URL
  afterEach(() => {
    if (saved === undefined) delete process.env.STUDIO_URL
    else process.env.STUDIO_URL = saved
  })

  it('prefers studio.url, strips trailing slashes, falls back to STUDIO_URL', () => {
    process.env.STUDIO_URL = 'https://env.example.com/studio/'
    expect(resolveStudioUrl({ studio: { url: 'https://cfg.example.com/admin//' } })).toBe('https://cfg.example.com/admin')
    expect(resolveStudioUrl({ studio: {} })).toBe('https://env.example.com/studio')
    delete process.env.STUDIO_URL
    expect(resolveStudioUrl({})).toBeUndefined()
    expect(resolveStudioUrl(undefined)).toBeUndefined()
  })

  it('names the dead keys and leaves the live ones alone', () => {
    expect(ignoredStudioKeys({ settings: {}, fields: [], branding: {}, url: 'x', session: {} })).toEqual(['settings', 'fields'])
    expect(ignoredStudioKeys(undefined)).toEqual([])
    // the removed keys are still refused, the dead ones are not
    expect(() => assertStudioConfigShape({ settings: {} })).not.toThrow()
    expect(() => assertStudioConfigShape({ path: '/studio' })).toThrow(/studio\.path/)
  })
})
