/**
 * Trokky Studio on a web-standard runtime (Cloudflare Workers, or anything with `fetch`).
 *
 * `studioRouter` is Express and reads the built files from disk. On Workers there is no disk:
 * the built Studio is shipped as static assets and served through the ASSETS binding. So this
 * handler does two things and nothing else — hands hashed assets to the binding with immutable
 * caching, and serves the document for the root and every client-side route, with the bootstrap
 * config injected for this mount point.
 *
 *   // wrangler.jsonc: "assets": { "directory": "./public" }, and @trokky/studio/dist copied
 *   // into public/studio at build time.
 *   const studio = createStudioFetchHandler({ basePath: '/studio', apiPath: '/api', assets: env.ASSETS })
 *   if (url.pathname.startsWith('/studio')) return studio(request)
 */

import type { StudioConfig } from './assets.js'
import { transformStudioDocument } from './document.js'

/** The shape of the ASSETS binding; declared structurally so this package needs no Workers types. */
export interface AssetsFetcher {
  fetch(request: Request): Promise<Response>
}

export interface StudioFetchHandlerOptions {
  /** Where the Studio is mounted, e.g. '/studio'. Also where its files live under the assets root. */
  basePath: string
  /** Where the Trokky API is mounted. Default '/api'. */
  apiPath?: string
  /** The Workers static assets binding (`env.ASSETS`). */
  assets: AssetsFetcher
  /** An absolute API URL, for when the Studio is served from a different origin than the API. */
  backendUrl?: string
  branding?: StudioConfig['branding']
  i18n?: Record<string, unknown>
}

const ASSET_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export function createStudioFetchHandler(options: StudioFetchHandlerOptions): (request: Request) => Promise<Response> {
  const basePath = trimTrailingSlash(options.basePath)
  const apiPath = trimTrailingSlash(options.apiPath ?? '/api')

  return async function handleStudio(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }

    const url = new URL(request.url)
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return new Response('Not Found', { status: 404 })
    }

    // Hashed assets: the binding serves them from `${basePath}/assets/…` as copied at build time.
    if (url.pathname.startsWith(`${basePath}/assets/`)) {
      const asset = await options.assets.fetch(new Request(url.toString(), { method: request.method }))
      if (!asset.ok) return new Response('Not Found', { status: 404 })
      const headers = new Headers(asset.headers)
      // Vite emits content-hashed filenames, so they can be cached forever.
      headers.set('cache-control', `public, max-age=${ASSET_MAX_AGE_SECONDS}, immutable`)
      return new Response(asset.body, { status: asset.status, headers })
    }

    // The root and every client-side route get the same document.
    const documentUrl = new URL(`${basePath}/index.html`, url.origin)
    const built = await options.assets.fetch(new Request(documentUrl.toString()))
    if (!built.ok) {
      return new Response(
        `Studio is not in the assets bundle at ${basePath}/index.html. Copy @trokky/studio/dist there at build time.`,
        { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      )
    }

    const config = {
      mode: 'production',
      apiBasePath: apiPath,
      basePath,
      backendUrl: options.backendUrl ?? `${url.origin}${apiPath}`,
      schemas: [],
      branding: options.branding,
      ...(options.i18n ? { i18n: options.i18n } : {}),
    } as StudioConfig

    const html = transformStudioDocument(await built.text(), config, basePath)
    return new Response(request.method === 'HEAD' ? null : html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
}
