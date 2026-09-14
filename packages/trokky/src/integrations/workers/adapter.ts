/**
 * Web-standard request/response adapter.
 *
 * The route layer speaks `HttpRequest` -> `HttpResponse` and knows nothing about
 * any framework (see `types/http.ts`). On an edge runtime the incoming object is
 * already a web `Request` and the outgoing one is already a web `Response`, so
 * this adapter is a pair of conversions and nothing else: no Node streams, no
 * `Buffer`, no `busboy`. Multipart is handled by the platform's own
 * `request.formData()`, which yields web `File` objects — exactly what
 * `HttpRequest.files` is typed as.
 */

import type { HttpRequest, HttpResponse, HttpMethod } from '../../types/http.js'

/** Requests with no body to read, per the fetch spec. */
const BODYLESS_METHODS = new Set(['GET', 'HEAD'])

/**
 * Convert a web `Request` into the framework-agnostic `HttpRequest`.
 *
 * `basePath` is the prefix the API is mounted under (e.g. `/api`); it is removed
 * from `path` so route patterns match the same way they do behind Express.
 */
export async function toHttpRequest(request: Request, basePath = ''): Promise<HttpRequest> {
  const url = new URL(request.url)

  // forEach rather than entries(): the package compiles against "DOM" without
  // "DOM.Iterable", and forEach is the iteration surface that library exposes.
  const query: Record<string, string | string[] | undefined> = {}
  url.searchParams.forEach((_value, key) => {
    if (key in query) return
    const all = url.searchParams.getAll(key)
    query[key] = all.length > 1 ? all : all[0]
  })

  const headers: Record<string, string | string[] | undefined> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  let path = url.pathname
  if (basePath && basePath !== '/' && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || '/'
  }

  let body: unknown
  let files: File[] | undefined

  if (!BODYLESS_METHODS.has(request.method)) {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const fields: Record<string, unknown> = {}
      const collected: File[] = []
      form.forEach((value, key) => {
        if (typeof value === 'string') {
          fields[key] = value
        } else {
          collected.push(value as File)
        }
      })
      files = collected
      body = fields
    } else if (contentType.includes('application/json')) {
      const text = await request.text()
      // An empty body is not a parse error; it is simply no body.
      body = text ? JSON.parse(text) : undefined
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(new URLSearchParams(await request.text()))
    } else if (contentType) {
      body = await request.text()
    }
  }

  return {
    method: request.method as HttpMethod,
    url: request.url,
    path,
    query,
    params: {},
    headers,
    body,
    files,
  }
}

/**
 * Convert an `HttpResponse` into a web `Response`.
 *
 * Handlers return binary payloads as `Uint8Array`/`ArrayBuffer` (media already
 * does, deliberately) and everything else as a string or a JSON-serialisable
 * object, which is the only case that needs a content type invented for it.
 */
export function toResponse(result: HttpResponse): Response {
  const headers = new Headers()
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (value !== undefined) headers.set(key, String(value))
  }

  const body = result.body

  if (body === undefined || body === null) {
    return new Response(null, { status: result.status, headers })
  }
  if (typeof body === 'string') {
    if (!headers.has('content-type')) headers.set('content-type', 'text/plain; charset=utf-8')
    return new Response(body, { status: result.status, headers })
  }
  if (body instanceof Uint8Array || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    if (!headers.has('content-type')) headers.set('content-type', 'application/octet-stream')
    return new Response(body as BodyInit, { status: result.status, headers })
  }

  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status: result.status, headers })
}
