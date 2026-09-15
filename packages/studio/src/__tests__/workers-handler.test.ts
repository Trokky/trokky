// @vitest-environment node
/**
 * The Workers handler is how a one-click deployment serves Studio: there is no Express and no
 * disk, only the ASSETS binding. What is pinned here mirrors the studioRouter contract — the
 * document at the root and at every client-side route with a bootstrap that reflects the mount,
 * hashed assets with long caching, 404 for anything unknown — plus the one thing specific to
 * this runtime: a clear failure when Studio was never copied into the assets bundle.
 */
import { describe, it, expect, vi } from 'vitest'
import { createStudioFetchHandler } from '../server/workers.js'

const BUILT_INDEX = `<!doctype html><html><head>
<script>
  window.TROKKY_CONFIG = {
    mode: 'development',
    basePath: '',
    branding: { title: 'Trokky Studio (Dev)' }
  };
</script>
<link rel="icon" type="image/svg+xml" href="/trokky-icon.svg" />
<title>Trokky Studio</title>
<script type="module" crossorigin src="/assets/index-abc123.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-def456.css">
</head><body><div id="root"></div></body></html>`

function fakeAssets(files: Record<string, string>) {
  const fetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname
    if (path in files) {
      const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript'
      return new Response(files[path], { status: 200, headers: { 'content-type': type, etag: '"x"' } })
    }
    return new Response('Not Found', { status: 404 })
  })
  return { fetch }
}

function bootstrap(html: string): Record<string, any> {
  const m = html.match(/window\.TROKKY_CONFIG = (\{.*?\});/s)
  if (!m) throw new Error('no bootstrap config in HTML')
  return JSON.parse(m[1])
}

const files = {
  '/studio/index.html': BUILT_INDEX,
  '/studio/assets/index-abc123.js': 'console.log("studio")',
  '/studio/assets/index-def456.css': 'body{}',
}

describe('createStudioFetchHandler', () => {
  it('serves the document at the mount root with a bootstrap that reflects the mount', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', apiPath: '/api', assets: fakeAssets(files) })

    const res = await handler(new Request('https://cms.example.org/studio'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const cfg = bootstrap(await res.text())
    expect(cfg).toMatchObject({ mode: 'production', basePath: '/studio', apiBasePath: '/api' })
    expect(cfg.backendUrl).toBe('https://cms.example.org/api')
  })

  it('serves the same document for client-side routes', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets(files) })

    const res = await handler(new Request('https://cms.example.org/studio/content/article/some-id?x=1'))

    expect(res.status).toBe(200)
    expect(bootstrap(await res.text()).basePath).toBe('/studio')
  })

  it('rewrites asset URLs to the mount and drops the root favicon', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets(files), branding: { title: 'My CMS' } })

    const html = await (await handler(new Request('https://cms.example.org/studio/'))).text()

    expect(html).toContain('src="/studio/assets/index-abc123.js"')
    expect(html).toContain('href="/studio/assets/index-def456.css"')
    expect(html).not.toContain('rel="icon"')
    expect(html).toContain('<title>My CMS</title>')
  })

  it('cannot be broken out of by a branding title containing script', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets(files), branding: { title: '</script><script>alert(1)</script>' } })

    const html = await (await handler(new Request('https://cms.example.org/studio'))).text()

    expect(html).not.toContain('</script><script>alert(1)')
    expect(bootstrap(html).branding.title).toBe('</script><script>alert(1)</script>')
  })

  it('hands hashed assets to the binding with immutable caching', async () => {
    const assets = fakeAssets(files)
    const handler = createStudioFetchHandler({ basePath: '/studio', assets })

    const res = await handler(new Request('https://cms.example.org/studio/assets/index-abc123.js'))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('console.log("studio")')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(new URL(assets.fetch.mock.calls[0][0].url).pathname).toBe('/studio/assets/index-abc123.js')
  })

  it('404s an unknown asset rather than serving the document for it', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets(files) })
    expect((await handler(new Request('https://cms.example.org/studio/assets/missing.js'))).status).toBe(404)
  })

  it('404s outside its mount and 405s non-GET', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets(files) })
    expect((await handler(new Request('https://cms.example.org/api/x'))).status).toBe(404)
    expect((await handler(new Request('https://cms.example.org/studio', { method: 'POST' }))).status).toBe(405)
  })

  it('says exactly what is wrong when Studio was never copied into the assets bundle', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets({}) })

    const res = await handler(new Request('https://cms.example.org/studio'))

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('/studio/index.html')
  })

  it('uses backendUrl when the API lives on another origin', async () => {
    const handler = createStudioFetchHandler({ basePath: '/studio', assets: fakeAssets(files), backendUrl: 'https://api.example.org/api' })
    expect(bootstrap(await (await handler(new Request('https://cms.example.org/studio'))).text()).backendUrl).toBe('https://api.example.org/api')
  })
})
