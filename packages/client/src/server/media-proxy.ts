/**
 * Media Proxy Factory
 * Creates server-side media proxy handlers for various frameworks
 *
 * This hides the backend API URL from clients and handles authentication server-side
 */

export interface MediaProxyConfig {
  /** Trokky API base URL */
  apiUrl: string
  /** API token for authentication */
  apiToken: string
  /** Cache-Control header value */
  cacheControl?: string
  /** Additional headers to add to proxied responses */
  responseHeaders?: Record<string, string>
}

export interface ProxyRequest {
  /** Media path (e.g., 'abc123/file' or 'abc123/variants/thumbnail') */
  path: string
  /** Request headers */
  headers?: Headers | Record<string, string>
}

export interface ProxyResponse {
  body: ArrayBuffer | ReadableStream<Uint8Array> | null
  status: number
  headers: Record<string, string>
}

/**
 * Core proxy function that handles the actual proxying logic
 */
export async function proxyMediaRequest(
  config: MediaProxyConfig,
  request: ProxyRequest
): Promise<ProxyResponse> {
  const { apiUrl, apiToken, cacheControl, responseHeaders } = config
  const path = request.path || ''

  try {
    const response = await fetch(`${apiUrl}/media/${path}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    })

    if (!response.ok) {
      return {
        body: null,
        status: response.status,
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer = await response.arrayBuffer()

    return {
      body: buffer,
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl || 'public, max-age=31536000, immutable',
        ...responseHeaders
      }
    }
  } catch (error) {
    console.error('Media proxy error:', error)
    return {
      body: null,
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    }
  }
}

/**
 * Create a generic media proxy handler
 *
 * @example
 * ```typescript
 * const proxy = createMediaProxy({
 *   apiUrl: process.env.TROKKY_API_URL,
 *   apiToken: process.env.TROKKY_API_TOKEN
 * })
 *
 * // Use in your framework's route handler
 * const result = await proxy({ path: 'abc123/file' })
 * ```
 */
export function createMediaProxy(config: MediaProxyConfig) {
  return async (request: ProxyRequest): Promise<ProxyResponse> => {
    return proxyMediaRequest(config, request)
  }
}

/**
 * Create an Astro-compatible media proxy handler
 *
 * @example
 * ```typescript
 * // src/pages/media/[...path].ts
 * import { createAstroMediaProxy } from '@trokky/client/server'
 *
 * export const GET = createAstroMediaProxy({
 *   apiUrl: import.meta.env.TROKKY_API_URL,
 *   apiToken: import.meta.env.TROKKY_API_TOKEN
 * })
 * ```
 */
export function createAstroMediaProxy(config: MediaProxyConfig) {
  return async ({ params }: { params: { path?: string } }): Promise<Response> => {
    const path = params.path || ''
    const result = await proxyMediaRequest(config, { path })

    if (!result.body) {
      return new Response(
        result.status === 404 ? 'Media not found' : 'Internal server error',
        { status: result.status }
      )
    }

    return new Response(result.body, {
      status: result.status,
      headers: result.headers
    })
  }
}

/**
 * Create a Next.js App Router compatible media proxy handler
 *
 * @example
 * ```typescript
 * // app/media/[...path]/route.ts
 * import { createNextMediaProxy } from '@trokky/client/server'
 *
 * export const GET = createNextMediaProxy({
 *   apiUrl: process.env.TROKKY_API_URL!,
 *   apiToken: process.env.TROKKY_API_TOKEN!
 * })
 * ```
 */
export function createNextMediaProxy(config: MediaProxyConfig) {
  return async (
    request: Request,
    { params }: { params: { path?: string[] } }
  ): Promise<Response> => {
    const path = Array.isArray(params.path) ? params.path.join('/') : params.path || ''
    const result = await proxyMediaRequest(config, { path })

    if (!result.body) {
      return new Response(
        result.status === 404 ? 'Media not found' : 'Internal server error',
        { status: result.status }
      )
    }

    return new Response(result.body, {
      status: result.status,
      headers: result.headers
    })
  }
}

/**
 * Create an Express-compatible middleware for media proxying
 *
 * @example
 * ```typescript
 * import express from 'express'
 * import { createExpressMediaProxy } from '@trokky/client/server'
 *
 * const app = express()
 *
 * app.use('/media', createExpressMediaProxy({
 *   apiUrl: process.env.TROKKY_API_URL,
 *   apiToken: process.env.TROKKY_API_TOKEN
 * }))
 * ```
 */
export function createExpressMediaProxy(config: MediaProxyConfig) {
  return async (req: any, res: any, next?: any) => {
    // Extract path from URL (remove leading /media/ if present)
    let path = req.params[0] || req.path || ''
    if (path.startsWith('/')) path = path.slice(1)
    if (path.startsWith('media/')) path = path.slice(6)

    const result = await proxyMediaRequest(config, { path })

    if (!result.body) {
      return res.status(result.status).send(
        result.status === 404 ? 'Media not found' : 'Internal server error'
      )
    }

    // Set headers
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value)
    }

    // Send buffer
    res.status(result.status).send(Buffer.from(result.body as ArrayBuffer))
  }
}
