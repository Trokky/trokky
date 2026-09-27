/**
 * Signing in to a site with the OAuth2 device flow: the person opens a link, checks the code
 * and approves in the site's Studio, where they can untick any access they do not want to
 * grant. No token is copied by hand.
 */

import { userAgent as defaultUserAgent } from './api.js'
import type { FetchLike } from './sites.js'

export const MCP_CLIENT_ID = 'trokky-mcp'
/** Servers before 3.5.2 know only the CLI client; their tokens are unscoped anyway */
const FALLBACK_CLIENT_ID = 'trokky-cli'

/** What an agent asks for; the person can narrow it on the consent screen */
export const ACCESS_LEVELS = {
  read: ['profile', 'content:read', 'media:read', 'offline_access'],
  edit: ['profile', 'content:read', 'content:write', 'media:read', 'media:write', 'offline_access'],
  publish: ['profile', 'content:read', 'content:write', 'content:publish', 'media:read', 'media:write', 'offline_access'],
  full: ['profile', 'content:read', 'content:write', 'content:publish', 'content:delete', 'media:read', 'media:write', 'media:delete', 'offline_access']
} as const

export type AccessLevel = keyof typeof ACCESS_LEVELS

export interface PendingLogin {
  apiUrl: string
  clientId: string
  deviceCode: string
  userCode: string
  /** Where the person approves, with the code filled in */
  verificationUrl: string
  intervalMs: number
  expiresAt: number
  /** Sent with every request of the sign-in; the site records it with the grant */
  userAgent: string
}

export type PollResult =
  | { status: 'pending'; slowDown?: boolean }
  | { status: 'approved'; token: string; refreshToken?: string; expiresIn?: number; scope?: string; clientId: string }
  | { status: 'failed'; reason: string }

async function post(fetchImpl: FetchLike, url: string, body: unknown, userAgent: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': userAgent },
      body: JSON.stringify(body)
    })
  } catch (error) {
    throw new Error(`Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  return { ok: response.ok, status: response.status, data }
}

export async function startLogin(apiUrl: string, access: AccessLevel, fetchImpl: FetchLike, userAgent = defaultUserAgent({})): Promise<PendingLogin> {
  const scope = ACCESS_LEVELS[access].join(' ')
  let clientId = MCP_CLIENT_ID
  let result = await post(fetchImpl, `${apiUrl}/auth/device`, { client_id: clientId, scope }, userAgent)
  // Only a server that has never heard of this client (before 3.5.2): one that knows it and
  // refuses it must not be worked around
  if (!result.ok && result.data.error === 'invalid_client' && result.data.error_description === 'Unknown client_id') {
    clientId = FALLBACK_CLIENT_ID
    result = await post(fetchImpl, `${apiUrl}/auth/device`, { client_id: clientId, scope }, userAgent)
  }
  if (result.status === 501) {
    throw new Error('This site does not have sign-in for applications enabled (oauth2.enabled in its configuration). Use an API token with TROKKY_URL and TROKKY_TOKEN instead.')
  }
  const data = result.data
  if (!result.ok || typeof data.device_code !== 'string' || typeof data.user_code !== 'string') {
    throw new Error(`The site refused to start a sign-in: ${String(data.error_description ?? data.error ?? `status ${result.status}`)}`)
  }
  return {
    apiUrl,
    clientId,
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUrl: String(data.verification_uri_complete ?? data.verification_uri),
    intervalMs: Math.max(1, Number(data.interval) || 5) * 1000,
    expiresAt: Date.now() + (Number(data.expires_in) || 600) * 1000,
    userAgent
  }
}

export async function pollLogin(login: PendingLogin, fetchImpl: FetchLike): Promise<PollResult> {
  if (Date.now() > login.expiresAt) {
    return { status: 'failed', reason: 'The sign-in code expired. Start again with add_site.' }
  }
  const { ok, data } = await post(fetchImpl, `${login.apiUrl}/auth/token`, {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: login.deviceCode,
    client_id: login.clientId
  }, login.userAgent)
  if (ok && typeof data.access_token === 'string') {
    return {
      status: 'approved',
      token: data.access_token,
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
      scope: typeof data.scope === 'string' ? data.scope : undefined,
      clientId: login.clientId
    }
  }
  if (data.error === 'authorization_pending' || data.error === 'slow_down') {
    return { status: 'pending', slowDown: data.error === 'slow_down' }
  }
  if (data.error === 'access_denied') {
    return { status: 'failed', reason: 'The sign-in was denied.' }
  }
  return { status: 'failed', reason: `The sign-in failed: ${String(data.error_description ?? data.error ?? 'unknown error')}` }
}

/**
 * A short site name from its host, derived the same way by the CLI: the first label, skipping
 * www (www.cms.example.com → cms), with the port when there is one, so two local sites do not
 * collide (localhost:3253 → localhost-3253).
 */
export function siteNameFromUrl(apiUrl: string): string {
  const url = new URL(apiUrl)
  const labels = url.hostname.split('.')
  const name = (labels[0] === 'www' ? labels[1] : labels[0]) || url.hostname
  return url.port ? `${name}-${url.port}` : name
}
