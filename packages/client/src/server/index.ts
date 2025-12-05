/**
 * Server-side utilities for Trokky Client
 *
 * These utilities are designed to run on the server (Node.js, Edge, etc.)
 * and should not be imported in client-side code.
 */

export {
  createMediaProxy,
  createAstroMediaProxy,
  createNextMediaProxy,
  createExpressMediaProxy,
  proxyMediaRequest
} from './media-proxy.js'

export type {
  MediaProxyConfig,
  ProxyRequest,
  ProxyResponse
} from './media-proxy.js'
