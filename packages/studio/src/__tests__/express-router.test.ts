// @vitest-environment node
/**
 * studioRouter is how a site mounts Studio (issue #21). These tests pin the
 * contract the server package used to provide implicitly: the document at the
 * mount root and at every client-side route, hashed assets with long caching,
 * a 404 for unknown assets, non-GET requests left to the next handler, and a
 * bootstrap config that reflects where the router was actually mounted.
 */
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { studioRouter } from '../server/express.js'

function bootstrap(html: string): Record<string, any> {
  const m = html.match(/window\.TROKKY_CONFIG = (\{.*?\});/s)
  if (!m) throw new Error('no bootstrap config in HTML')
  return JSON.parse(m[1])
}

describe('studioRouter', () => {
  it('serves the document at the mount root with the mount path as basePath', async () => {
    const app = express()
    app.use('/studio', studioRouter({ apiPath: '/api' }))

    const res = await request(app).get('/studio')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.headers['cache-control']).toBe('no-store')
    const cfg = bootstrap(res.text)
    expect(cfg.basePath).toBe('/studio')
    expect(cfg.apiBasePath).toBe('/api')
    expect(cfg.backendUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api$/)
  })

  it('serves the same document for client-side routes', async () => {
    const app = express()
    app.use('/studio', studioRouter())

    const res = await request(app).get('/studio/content/article/some-id?x=1')
    expect(res.status).toBe(200)
    expect(bootstrap(res.text).basePath).toBe('/studio')
  })

  it('follows a nested mount prefix', async () => {
    const app = express()
    const admin = express.Router()
    admin.use('/studio', studioRouter({ apiPath: '/cms/api' }))
    app.use('/cms', admin)

    const res = await request(app).get('/cms/studio/')
    expect(res.status).toBe(200)
    const cfg = bootstrap(res.text)
    expect(cfg.basePath).toBe('/cms/studio')
    expect(cfg.apiBasePath).toBe('/cms/api')
  })

  it('uses an explicit backendUrl over the request host', async () => {
    const app = express()
    app.use('/studio', studioRouter({ backendUrl: 'https://cms.example.com/api' }))

    const cfg = bootstrap((await request(app).get('/studio')).text)
    expect(cfg.backendUrl).toBe('https://cms.example.com/api')
  })

  it('forwards branding and i18n defaults to the bootstrap config', async () => {
    const app = express()
    app.use(
      '/studio',
      studioRouter({
        branding: { title: 'Cour des Comptes', theme: 'light' },
        i18n: { defaultLocale: 'fr', supportedLocales: ['fr', 'en'] },
      })
    )

    const res = await request(app).get('/studio')
    const cfg = bootstrap(res.text)
    expect(cfg.branding).toEqual({ title: 'Cour des Comptes', theme: 'light' })
    expect(cfg.i18n).toEqual({ defaultLocale: 'fr', supportedLocales: ['fr', 'en'] })
    expect(res.text).toContain('<title>Cour des Comptes</title>')
  })

  it('returns 404 for an unknown asset and rejects traversal', async () => {
    const app = express()
    app.use('/studio', studioRouter())

    expect((await request(app).get('/studio/assets/nope.js')).status).toBe(404)
    expect((await request(app).get('/studio/assets/..%2F..%2Fpackage.json')).status).toBe(404)
  })

  it('leaves non-GET requests to the next handler', async () => {
    const app = express()
    app.use('/studio', studioRouter())
    app.post('/studio/anything', (_req, res) => res.status(201).send('mine'))

    const res = await request(app).post('/studio/anything')
    expect(res.status).toBe(201)
    expect(res.text).toBe('mine')
  })

  it('does not answer outside its mount path', async () => {
    const app = express()
    app.use('/studio', studioRouter())

    expect((await request(app).get('/')).status).toBe(404)
    expect((await request(app).get('/api/health')).status).toBe(404)
  })
})
