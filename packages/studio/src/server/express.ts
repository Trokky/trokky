/**
 * Studio as an Express router.
 *
 * Studio owns its own mounting. A site does:
 *
 *   import { studioRouter } from '@trokky/studio/express'
 *   app.use('/studio', studioRouter({ apiPath: '/api' }))
 *
 * The router serves the built SPA (HTML, hashed assets, and the HTML again
 * for every client-side route) and injects the small bootstrap config the
 * SPA needs before it can talk to the API: where the API is, what path
 * Studio is mounted on, and optional branding and i18n defaults for the
 * login screen. Everything else (structure, schemas, media settings, the
 * branding stored in settings) Studio fetches from the API once it runs.
 *
 * The mount path is read from `req.baseUrl` on every request, so the same
 * router works wherever the site mounts it and behind any prefix a proxy
 * adds. It is a plain middleware function underneath, so it mounts on
 * Express 4 and Express 5 alike; no path-pattern syntax is used.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { getStudioHTML, getStudioAsset } from './assets.js'

export interface StudioRouterOptions {
  /**
   * Path the Trokky API is mounted on, as seen by the browser.
   * Default: '/api'.
   */
  apiPath?: string
  /**
   * Full origin + API path the browser should call, e.g.
   * 'https://cms.example.com/api'. When omitted it is derived from the
   * incoming request (protocol + Host header + apiPath), which is right for
   * the usual same-origin deployment. Set it when the server sits behind a
   * proxy that rewrites the Host header.
   */
  backendUrl?: string
  /** Branding shown before the API has answered (login screen title, theme). */
  branding?: {
    title?: string
    logo?: string
    theme?: 'light' | 'dark' | 'system'
  }
  /** Locale defaults for the UI. */
  i18n?: {
    defaultLocale?: string
    supportedLocales?: string[]
    fallbackLocale?: string
    detectBrowserLanguage?: boolean
  }
}

/** How long browsers may cache Studio's hashed assets. */
const ASSET_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Build an Express router that serves Trokky Studio.
 */
export function studioRouter(options: StudioRouterOptions = {}): Router {
  const apiPath = trimTrailingSlash(options.apiPath ?? '/api')
  const router = Router()

  const sendHtml = (req: Request, res: Response): void => {
    // req.baseUrl is the path this router was mounted on, including any
    // prefix an outer app.use() added. That is exactly what the SPA needs
    // for its own routing and for asset URLs.
    const basePath = trimTrailingSlash(req.baseUrl || '')
    const backendUrl =
      options.backendUrl ?? `${req.protocol}://${req.get('host')}${apiPath}`

    const html = getStudioHTML(
      {
        mode: 'production',
        apiBasePath: apiPath,
        basePath,
        backendUrl,
        schemas: [],
        branding: options.branding,
        ...(options.i18n ? { i18n: options.i18n } : {}),
      } as Parameters<typeof getStudioHTML>[0],
      basePath
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.send(html)
  }

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }

    // req.path is relative to the mount point.
    if (req.path.startsWith('/assets/')) {
      const asset = getStudioAsset(req.path.slice('/assets/'.length))
      if (!asset) {
        res.status(404).send('Not found')
        return
      }
      res.setHeader('Content-Type', asset.contentType)
      // Vite emits content-hashed filenames, so they can be cached forever.
      res.setHeader('Cache-Control', `public, max-age=${ASSET_MAX_AGE_SECONDS}, immutable`)
      res.send(asset.content)
      return
    }

    // The root and every client-side route get the same document.
    sendHtml(req, res)
  })

  return router
}

export { getStudioHTML, getStudioAsset } from './assets.js'
