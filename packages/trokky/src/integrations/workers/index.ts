/**
 * Trokky on a web-standard runtime (Cloudflare Workers, Deno, Bun).
 *
 * The Express integration exists because Express has its own request object and
 * its own middleware conventions. An edge runtime has neither: it hands you a
 * web `Request` and wants a web `Response`, which is close enough to the route
 * layer's own `HttpRequest`/`HttpResponse` that the whole integration is a
 * router lookup between two conversions.
 *
 *   const handler = createFetchHandler({ core, basePath: '/api' })
 *   export default { fetch: (req) => handler(req) }
 */

import { TrokkyRoutes } from '../../routes/index.js'
import type { RoutesConfig } from '../../routes/types.js'
import type { HttpRequest } from '../../types/http.js'
import { toHttpRequest, toResponse } from './adapter.js'

export { toHttpRequest, toResponse } from './adapter.js'

export interface FetchHandlerOptions extends RoutesConfig {
  /** Path the API is mounted under, stripped before route matching. Default '/api'. */
  basePath?: string
}

export type FetchHandler = (request: Request) => Promise<Response>

/** Build a `fetch` handler serving the Trokky API. */
export function createFetchHandler(options: FetchHandlerOptions): FetchHandler {
  const basePath = options.basePath ?? '/api'
  const routes = new TrokkyRoutes({ ...options, basePath: '' } as RoutesConfig)

  return async function handle(request: Request): Promise<Response> {
    let httpRequest: HttpRequest
    try {
      httpRequest = await toHttpRequest(request, basePath)
    } catch {
      return toResponse({
        status: 400,
        headers: {},
        body: { success: false, error: { code: 'INVALID_INPUT', message: 'Malformed request body' } },
      })
    }

    const route = routes.findRoute(httpRequest.method, httpRequest.path)
    if (!route) {
      return toResponse({
        status: 404,
        headers: {},
        body: { success: false, error: { code: 'NOT_FOUND', message: `No route for ${httpRequest.method} ${httpRequest.path}` } },
      })
    }

    httpRequest.params = routes.extractParams(route.path, httpRequest.path)

    try {
      return toResponse(await route.handler(httpRequest))
    } catch (error) {
      // A handler that throws must not take the isolate down with it.
      return toResponse({
        status: 500,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal error',
          },
        },
      })
    }
  }
}
