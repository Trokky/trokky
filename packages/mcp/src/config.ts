import path from 'node:path'
import { resolveApiUrl } from './api.js'
import type { TrokkyMcpOptions } from './server.js'

export type Env = Record<string, string | undefined>

const TRUE = new Set(['1', 'true', 'yes', 'on'])

/** Configuration from the environment, minus the parts that are objects (store, fetch) */
export type EnvConfig = Omit<TrokkyMcpOptions, 'fetch' | 'store'> & {
  /** Where the shared site list lives, when set by TROKKY_CONFIG */
  configPath?: string
}

/**
 * Read the server's configuration from the environment, which is how MCP clients
 * pass settings to a stdio server. Variable names match the Trokky CLI's.
 *
 * TROKKY_URL with TROKKY_TOKEN pins one site. Without them the server works on the sites in
 * the shared Trokky config, added by `trokky-mcp login`, `trokky login`, or the add_site tool.
 */
export function readConfig(env: Env, cwd: string): EnvConfig {
  const url = env.TROKKY_URL?.trim()
  const token = env.TROKKY_TOKEN?.trim()
  if (Boolean(url) !== Boolean(token)) {
    throw new Error(
      `${url ? 'TROKKY_TOKEN' : 'TROKKY_URL'} is missing. Set both to pin one site, or neither to use ` +
      'the sites you signed in to (trokky-mcp login <url>).'
    )
  }

  const readOnly = TRUE.has((env.TROKKY_READ_ONLY ?? '').trim().toLowerCase())

  // Uploads read local files and publish them, so they are opt-in and confined
  const uploadDirs = (env.TROKKY_UPLOAD_DIRS ?? '')
    .split(path.delimiter)
    .map(dir => dir.trim())
    .filter(Boolean)
    .map(dir => path.resolve(cwd, dir))

  const maxMb = env.TROKKY_MAX_UPLOAD_MB ? Number(env.TROKKY_MAX_UPLOAD_MB) : undefined
  // Below one byte once floored, every upload would be refused
  if (maxMb !== undefined && !(maxMb * 1024 * 1024 >= 1)) {
    throw new Error(`TROKKY_MAX_UPLOAD_MB must be a positive number, got ${env.TROKKY_MAX_UPLOAD_MB}`)
  }

  const configPath = env.TROKKY_CONFIG?.trim()

  return {
    ...(url && token ? { apiUrl: resolveApiUrl(url), token } : {}),
    ...(configPath ? { configPath: path.resolve(cwd, configPath) } : {}),
    readOnly,
    uploadRoots: uploadDirs,
    maxUploadBytes: maxMb !== undefined ? Math.floor(maxMb * 1024 * 1024) : undefined
  }
}
