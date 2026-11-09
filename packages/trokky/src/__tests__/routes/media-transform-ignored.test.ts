/**
 * The server serves a media file as stored. Transform parameters from imageUrl() (?w=800&fm=webp)
 * used to come back as a plain 200 that looked like a resized image; now the response says which
 * parameters it did not apply, and the server logs it once.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createTestRoutes,
  createAuthenticatedUser,
  createMockRequest,
  executeRoute,
} from '../helpers/test-helpers.js'
import { TRANSFORM_IGNORED_HEADER, resetTransformWarning } from '../../routes/handlers/media.js'

async function setup() {
  const { routes, core } = await createTestRoutes()
  const { token } = await createAuthenticatedUser(core, { role: 'admin' })
  const media = await core.uploadMedia(new File([new Uint8Array([1, 2, 3])], 'notes.txt', { type: 'text/plain' }))
  const get = (query: Record<string, string> = {}) =>
    executeRoute(
      routes,
      createMockRequest({
        method: 'GET',
        path: `/api/media/${media.id}/file`,
        headers: { Authorization: `Bearer ${token}` },
        query,
      })
    )
  return { get }
}

function warnings(): string[] {
  return vi.mocked(console.warn).mock.calls.flat().map((line) => String(line))
}

describe('GET /media/:id/file with transform parameters', () => {
  beforeEach(() => {
    resetTransformWarning()
    vi.mocked(console.warn).mockClear()
  })

  it('should name the transform parameters it did not apply', async () => {
    const { get } = await setup()
    const response = await get({ w: '800', fm: 'webp', q: '85', unrelated: 'x' })
    expect(response.status).toBe(200)
    expect(response.headers[TRANSFORM_IGNORED_HEADER]).toBe('w,fm,q')
    expect(response.headers['Content-Type']).toBe('text/plain')
  })

  it('should recognise every parameter imageUrl() emits, and nothing else', async () => {
    const { get } = await setup()
    const all = { w: '1', h: '1', fm: 'webp', q: '80', fit: 'cover', blur: '2', sharp: '1', grayscale: '1', auto: 'format', dpr: '2' }
    const response = await get(all)
    expect(response.headers[TRANSFORM_IGNORED_HEADER]).toBe('w,h,fm,q,fit,blur,sharp,grayscale')
    expect(response.headers['Access-Control-Expose-Headers']).toBe(TRANSFORM_IGNORED_HEADER)
  })

  it('should count a repeated parameter', async () => {
    const { get } = await setup()
    const response = await get({ w: ['400', '800'] } as never)
    expect(response.headers[TRANSFORM_IGNORED_HEADER]).toBe('w')
  })

  it('should add no header to a plain request', async () => {
    const { get } = await setup()
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers[TRANSFORM_IGNORED_HEADER]).toBeUndefined()
    expect(response.headers['Access-Control-Expose-Headers']).toBeUndefined()
  })

  it('should log the first ignored transform once, not on every request', async () => {
    const { get } = await setup()
    await get({ w: '400' })
    await get({ w: '800' })
    await get({ h: '200', grayscale: '1' })
    const logged = warnings().filter((line) => line.includes('Image transform parameters'))
    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain('(w)')
    expect(logged[0]).toContain('media.variants')
  })

  it('should not log for requests without transform parameters', async () => {
    const { get } = await setup()
    await get()
    expect(warnings().some((line) => line.includes('Image transform parameters'))).toBe(false)
  })
})
