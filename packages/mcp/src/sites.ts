/**
 * The sites this MCP server can work on, stored in ~/.trokky/config.yaml — the same file the
 * Trokky CLI uses, so a site added with `trokky login` is available here and the reverse.
 *
 * The file is shared, so every change follows the CLI's protocol exactly: take the lock file
 * (`config.yaml.lock`, created exclusively, abandoned after 60 seconds), read, change, write
 * aside and rename into place. A token refresh re-reads the site under the lock and reuses a
 * token the other tool refreshed a moment ago.
 */

import { link, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { parse, stringify } from 'yaml'
import { userAgent } from './api.js'

/** One site, in the CLI's schema. Unknown fields would be dropped by the CLI on its next save. */
export interface SiteRecord {
  url: string
  token: string
  refreshToken?: string
  authType?: 'api-token' | 'oauth2'
  tokenExpiresAt?: string
  /** The OAuth2 client the token belongs to; a refresh must name the same one */
  clientId?: string
  description?: string
  addedAt?: string
  updatedAt?: string
}

interface ConfigFile {
  version: string
  default?: string
  instances: Record<string, SiteRecord>
  /** Top-level keys another version wrote, kept as they are */
  rest: Record<string, unknown>
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

// The CLI's lock protocol (cli/internal/config/lock.go), followed exactly: take the lock file
// exclusively with a random owner id, remove it only while it still holds that id, and take
// over a lock older than LOCK_STALE_MS by renaming it aside, putting it back if it proves live
const LOCK_RETRY_MS = 25
/** Longer than the stale threshold, so a waiter outlasts a crashed holder and a slow refresh */
const LOCK_GIVE_UP_MS = 75_000
const LOCK_STALE_MS = 60_000
/** The longest request made while holding the lock */
const REFRESH_TIMEOUT_MS = 30_000
/** Refresh a little before expiry, as the CLI does */
const EXPIRY_MARGIN_MS = 5 * 60_000

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * The API base for a stored site URL, by the CLI's rule (NormalizeBaseURL): `trokky config
 * add` stores the URL as typed and appends /api only when it uses it. Trailing slashes go; a
 * path with an `api` segment is kept as it is; anything else gets /api.
 */
export function apiBaseOf(storedUrl: string): string {
  const trimmed = storedUrl.replace(/\/+$/, '')
  if (!trimmed) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.host) {
      return url.pathname.split('/').includes('api') ? trimmed : `${trimmed}/api`
    }
  } catch {
    // Unparseable: the plain suffix check below
  }
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

/**
 * The API base a new site is saved under. The shared file is read by the CLI's rule, so a
 * URL that rule would read differently (an API mounted at a path with no `api` segment) is
 * refused rather than saved wrong.
 */
export function storableApiUrl(apiUrl: string): string {
  if (apiBaseOf(apiUrl) !== apiUrl) {
    throw new Error(`${apiUrl} has no "api" segment in its path, which the shared Trokky config (and the CLI) cannot address. Use TROKKY_URL and TROKKY_TOKEN for this site instead.`)
  }
  return apiUrl
}

export function defaultConfigPath(): string {
  return path.join(homedir(), '.trokky', 'config.yaml')
}

export class SiteStore {
  constructor(
    readonly configPath: string = defaultConfigPath(),
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {}

  async list(): Promise<{ sites: Record<string, SiteRecord>; defaultSite?: string }> {
    const config = await this.read()
    return { sites: config.instances, defaultSite: config.default }
  }

  async get(name: string): Promise<SiteRecord | undefined> {
    return (await this.read()).instances[name]
  }

  /**
   * Save a site. A name already in use is refused: an agent told to add some site must not be
   * able to replace another one (and with it the default) by choosing, or deriving, the same
   * name. `replace` allows a new sign-in for the same site, and only if the URL is the same.
   */
  async add(name: string, site: SiteRecord, makeDefault: boolean, replace = false): Promise<void> {
    await this.update(config => {
      const existing = config.instances[name]
      if (existing && !replace) {
        throw new Error(`A site named "${name}" already exists (${existing.url}). Choose another name, or sign in to that same site again with replace.`)
      }
      if (existing && apiBaseOf(existing.url) !== apiBaseOf(site.url)) {
        throw new Error(`"${name}" is ${existing.url}, not ${site.url}. A sign-in can only replace a site at the same address.`)
      }
      const now = new Date().toISOString()
      config.instances[name] = { ...site, addedAt: config.instances[name]?.addedAt ?? now, updatedAt: now }
      if (makeDefault || Object.keys(config.instances).length === 1) {
        config.default = name
      }
    })
  }

  async remove(name: string): Promise<boolean> {
    let existed = false
    await this.update(config => {
      if (!(name in config.instances)) return
      existed = true
      delete config.instances[name]
      // The only site left is the obvious default. With several, none: a call without `site`
      // must not quietly land on one picked arbitrarily (the CLI does the same)
      if (config.default === name) {
        const remaining = Object.keys(config.instances)
        config.default = remaining.length === 1 ? remaining[0] : undefined
      }
    })
    return existed
  }

  async setDefault(name: string): Promise<boolean> {
    let found = false
    await this.update(config => {
      if (!(name in config.instances)) return
      found = true
      config.default = name
    })
    return found
  }

  /**
   * A usable token for the site: the stored one, or a refreshed one when it has expired, or
   * when the server just rejected `rejected`. Refreshing happens under the lock against the
   * site as stored now, so a refresh the CLI made in the meantime is reused, not repeated.
   */
  async token(name: string, rejected?: string): Promise<string> {
    return (await this.session(name, rejected)).token
  }

  /**
   * The site's address and a usable token, from one record: taken from two reads, a site
   * replaced in between (a concurrent sign-in under the same name) would send one site's
   * token to the other's address.
   */
  async session(name: string, rejected?: string): Promise<{ url: string; token: string }> {
    const site = await this.get(name)
    if (!site) throw new Error(`No site named "${name}". list_sites shows the configured sites.`)
    const force = rejected !== undefined
    if (!needsRefresh(site, force)) return { url: site.url, token: site.token }

    // The token known to be bad: the one the server rejected, else the expired one read above
    const seen = rejected ?? site.token
    let result = { url: site.url, token: site.token }
    await this.update(async config => {
      const current = config.instances[name]
      if (!current) throw new Error(`Site "${name}" was removed.`)
      // Someone else refreshed it while this process waited for the lock
      if (current.token !== seen && !needsRefresh(current, false)) {
        result = { url: current.url, token: current.token }
        return
      }
      const refreshed = await this.refresh(current)
      config.instances[name] = { ...current, ...refreshed, updatedAt: new Date().toISOString() }
      result = { url: current.url, token: refreshed.token }
    })
    return result
  }

  private async refresh(site: SiteRecord): Promise<Pick<SiteRecord, 'token' | 'tokenExpiresAt' | 'refreshToken'>> {
    if (site.authType !== 'oauth2' || !site.refreshToken) {
      throw new Error('This site\'s token cannot be renewed. Sign in again with add_site.')
    }
    const response = await this.fetchImpl(`${apiBaseOf(site.url)}/auth/token`, {
      method: 'POST',
      // Held under the lock: bounded, so it cannot outlive the stale threshold
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': userAgent() },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: site.refreshToken,
        client_id: site.clientId ?? 'trokky-cli'
      })
    })
    const body = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string }
    if (!response.ok || !body.access_token) {
      throw new Error(`The site's session has ended (${body.error_description ?? `status ${response.status}`}). Sign in again with add_site.`)
    }
    return {
      token: body.access_token,
      tokenExpiresAt: expiresAtFromNow(body.expires_in),
      refreshToken: body.refresh_token ?? site.refreshToken
    }
  }

  private async read(): Promise<ConfigFile> {
    let text: string
    try {
      text = await readFile(this.configPath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: '1.0', instances: {}, rest: {} }
      throw error
    }
    let parsed: unknown
    try {
      parsed = parse(text)
    } catch (error) {
      // Never an empty config: the next save would overwrite every saved site
      throw new Error(`${this.configPath} is not valid YAML (${(error as Error).message}); fix it or move it aside`)
    }
    const { version, default: defaultSite, instances, ...rest } = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
    return {
      version: typeof version === 'string' ? version : '1.0',
      default: typeof defaultSite === 'string' && defaultSite ? defaultSite : undefined,
      instances: (instances && typeof instances === 'object' ? instances : {}) as Record<string, SiteRecord>,
      rest
    }
  }

  private async update(change: (config: ConfigFile) => void | Promise<void>): Promise<void> {
    const release = await this.lock()
    try {
      const config = await this.read()
      await change(config)
      await this.write(config)
    } finally {
      await release()
    }
  }

  private async write(config: ConfigFile): Promise<void> {
    const document: Record<string, unknown> = { version: config.version }
    if (config.default) document.default = config.default
    Object.assign(document, config.rest)
    document.instances = Object.fromEntries(Object.entries(config.instances).map(([name, site]) =>
      [name, Object.fromEntries(Object.entries(site).filter(([, value]) => value !== undefined && value !== ''))]))

    await mkdir(path.dirname(this.configPath), { recursive: true, mode: 0o700 })
    const temp = path.join(path.dirname(this.configPath), `.config-${randomUUID()}.yaml`)
    try {
      const handle = await open(temp, 'wx', 0o600)
      try {
        await handle.writeFile(stringify(document))
        // On disk before it replaces the old file, so a crash cannot leave an empty config
        await handle.sync()
      } finally {
        await handle.close()
      }
      // Windows refuses to replace a file another process has open; a reader holds it briefly
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temp, this.configPath)
          break
        } catch (error) {
          if (attempt === 5) throw error
          await sleep((attempt + 1) * 20)
        }
      }
    } catch (error) {
      await rm(temp, { force: true })
      throw error
    }
  }

  private async lock(): Promise<() => Promise<void>> {
    const lockPath = `${this.configPath}.lock`
    await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 })
    const owner = randomUUID().replace(/-/g, '')
    const deadline = Date.now() + LOCK_GIVE_UP_MS
    for (;;) {
      try {
        const handle = await open(lockPath, 'wx', 0o600)
        try {
          await handle.writeFile(owner)
        } catch (error) {
          await handle.close()
          await rm(lockPath, { force: true })
          throw error
        } finally {
          await handle.close().catch(() => {})
        }
        // Only while it is still ours: after a stale takeover it belongs to someone else
        return async () => {
          const held = await readFile(lockPath, 'utf8').catch(() => undefined)
          if (held === owner) await rm(lockPath, { force: true })
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
      const info = await stat(lockPath).catch(() => undefined)
      if (info && Date.now() - info.mtimeMs > LOCK_STALE_MS) {
        await takeOverStaleLock(lockPath)
        continue
      }
      if (Date.now() > deadline) {
        throw new Error(`The Trokky config is locked by another process (${lockPath}); if nothing else is running, remove that file`)
      }
      await sleep(LOCK_RETRY_MS)
    }
  }
}

/**
 * Move an abandoned lock aside. Of several waiters that saw it stale, only one renames it; if
 * what was moved turns out to be fresh (replaced between the stat and the rename), it is put
 * back with a link, which fails rather than overwrite a lock taken meanwhile.
 */
export async function takeOverStaleLock(lockPath: string): Promise<void> {
  const aside = `${lockPath}.${randomUUID().replace(/-/g, '')}.stale`
  try {
    await rename(lockPath, aside)
  } catch {
    return
  }
  const info = await stat(aside).catch(() => undefined)
  if (info && Date.now() - info.mtimeMs <= LOCK_STALE_MS) {
    await link(aside, lockPath).catch(() => {})
  }
  await rm(aside, { force: true })
}

function needsRefresh(site: SiteRecord, force: boolean): boolean {
  if (site.authType !== 'oauth2') return false
  if (force) return true
  if (!site.tokenExpiresAt) return false
  const expiresAt = Date.parse(site.tokenExpiresAt)
  // Unreadable counts as not expired, as in the CLI: the token is tried, and a 401 renews it
  return Number.isFinite(expiresAt) && expiresAt - EXPIRY_MARGIN_MS <= Date.now()
}

function expiresAtFromNow(seconds: number | undefined): string | undefined {
  return seconds ? new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined
}
