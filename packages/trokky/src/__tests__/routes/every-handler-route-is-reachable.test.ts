/**
 * Every route a handler group defines must be reachable through the router.
 *
 * TrokkyRoutes keeps two registries: the handler groups' own `getRoutes()`, and an explicit
 * list in `initializeRoutes()` that `findRoute` consults. A route added to the first but not the
 * second is served by Express and is "No route" on Workers — which is exactly how the first-boot
 * claim shipped in 3.3.0 reachable from a Node deployment and absent from a Worker. This pins
 * the two registries together so that cannot happen quietly again.
 */
import { describe, it, expect } from 'vitest'
import { TrokkyRoutes } from '../../routes/routes.js'
import { createMockCore } from '../helpers/mock-core.js'

describe('TrokkyRoutes registries', () => {
  it('can find every route its handler groups define', () => {
    const routes = new TrokkyRoutes({ core: createMockCore() as never, basePath: '/api' })

    const defined = (routes as unknown as { handlerRoutes: Map<string, { method: string; path: string }> }).handlerRoutes
    expect(defined.size).toBeGreaterThan(40)

    const unreachable: string[] = []
    for (const [key, route] of defined) {
      // Substitute a value for each path parameter so the pattern matcher has something to match.
      const concrete = route.path.replace(/:[A-Za-z0-9_]+/g, 'x')
      const found = routes.findRoute(route.method, concrete)
      if (!found || found.path !== route.path) unreachable.push(key)
    }

    expect(unreachable).toEqual([])
  })

  it('serves the first-boot claim on the fetch path', () => {
    const routes = new TrokkyRoutes({ core: createMockCore() as never, basePath: '/api' })
    expect(routes.findRoute('GET', '/api/auth/claim')?.path).toBe('/api/auth/claim')
    expect(routes.findRoute('POST', '/api/auth/claim')?.path).toBe('/api/auth/claim')
  })
})
