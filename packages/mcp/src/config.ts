import path from 'node:path'
import { resolveApiUrl } from './api.js'
import type { TrokkyMcpOptions } from './server.js'

export type Env = Record<string, string | undefined>

const TRUE = new Set(['1', 'true', 'yes', 'on'])

/**
 * Read the server's configuration from the environment, which is how MCP clients
 * pass settings to a stdio server. Variable names match the Trokky CLI's.
 */
export function readConfig(env: Env, cwd: string): Omit<TrokkyMcpOptions, 'fetch'> {
  const url = env.TROKKY_URL?.trim()
  const token = env.TROKKY_TOKEN?.trim()
  const missing = [!url && 'TROKKY_URL', !token && 'TROKKY_TOKEN'].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Set TROKKY_URL to your site (e.g. https://cms.example.com) ` +
      'and TROKKY_TOKEN to an API token created in Studio under Users > API tokens.'
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

  return {
    apiUrl: resolveApiUrl(url as string),
    token: token as string,
    readOnly,
    uploadRoots: uploadDirs,
    maxUploadBytes: maxMb !== undefined ? Math.floor(maxMb * 1024 * 1024) : undefined
  }
}
