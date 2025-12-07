/**
 * Config Manager for Trokky CLI
 * Handles reading/writing ~/.trokky/config.yaml
 */

import { homedir } from 'os'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import * as yaml from 'js-yaml'
import type {
  TrokkyConfig,
  TrokkyInstance,
  ResolvedCredentials,
  ResolveOptions
} from './config-types.js'
import { CONFIG_DIR, CONFIG_FILE, ENV_VARS } from './config-types.js'

/**
 * Get the path to the config directory
 */
export function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR)
}

/**
 * Get the path to the config file
 */
export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE)
}

/**
 * Create an empty config
 */
function createEmptyConfig(): TrokkyConfig {
  return {
    version: '1.0',
    instances: {}
  }
}

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir()
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true })
  }
}

/**
 * Load the config from disk
 */
export async function loadConfig(): Promise<TrokkyConfig> {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    return createEmptyConfig()
  }

  try {
    const content = await readFile(configPath, 'utf-8')
    const config = yaml.load(content) as TrokkyConfig

    // Validate and migrate if needed
    if (!config || typeof config !== 'object') {
      return createEmptyConfig()
    }

    // Ensure required fields
    if (!config.version) {
      config.version = '1.0'
    }
    if (!config.instances) {
      config.instances = {}
    }

    return config
  } catch (error) {
    // If parsing fails, return empty config
    return createEmptyConfig()
  }
}

/**
 * Save the config to disk
 */
export async function saveConfig(config: TrokkyConfig): Promise<void> {
  await ensureConfigDir()
  const configPath = getConfigPath()
  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
    forceQuotes: false
  })
  await writeFile(configPath, content, 'utf-8')
}

/**
 * Add or update an instance in the config
 */
export async function addInstance(
  name: string,
  instance: Omit<TrokkyInstance, 'addedAt' | 'updatedAt'>,
  setAsDefault: boolean = false
): Promise<void> {
  const config = await loadConfig()
  const now = new Date().toISOString()

  const existing = config.instances[name]
  config.instances[name] = {
    ...instance,
    addedAt: existing?.addedAt || now,
    updatedAt: now
  }

  // Set as default if requested or if it's the first instance
  if (setAsDefault || Object.keys(config.instances).length === 1) {
    config.default = name
  }

  await saveConfig(config)
}

/**
 * Remove an instance from the config
 */
export async function removeInstance(name: string): Promise<boolean> {
  const config = await loadConfig()

  if (!config.instances[name]) {
    return false
  }

  delete config.instances[name]

  // If we removed the default, clear it or set to another instance
  if (config.default === name) {
    const remaining = Object.keys(config.instances)
    config.default = remaining.length > 0 ? remaining[0] : undefined
  }

  await saveConfig(config)
  return true
}

/**
 * List all configured instances
 */
export async function listInstances(): Promise<{
  instances: Record<string, TrokkyInstance>
  defaultInstance?: string
}> {
  const config = await loadConfig()
  return {
    instances: config.instances,
    defaultInstance: config.default
  }
}

/**
 * Get a specific instance by name
 */
export async function getInstance(name: string): Promise<TrokkyInstance | undefined> {
  const config = await loadConfig()
  return config.instances[name]
}

/**
 * Get the default instance
 */
export async function getDefaultInstance(): Promise<{
  name: string
  instance: TrokkyInstance
} | undefined> {
  const config = await loadConfig()

  if (!config.default || !config.instances[config.default]) {
    return undefined
  }

  return {
    name: config.default,
    instance: config.instances[config.default]
  }
}

/**
 * Set the default instance
 */
export async function setDefaultInstance(name: string): Promise<boolean> {
  const config = await loadConfig()

  if (!config.instances[name]) {
    return false
  }

  config.default = name
  await saveConfig(config)
  return true
}

/**
 * Resolve credentials from CLI flags, environment variables, or config file
 * Priority: CLI flags > Environment variables > Config file default
 */
export async function resolveCredentials(
  options: ResolveOptions
): Promise<ResolvedCredentials | null> {
  // Priority 1: Explicit CLI flags (both url and token must be provided)
  if (options.url && options.token) {
    return {
      url: options.url,
      token: options.token,
      source: 'cli'
    }
  }

  // Priority 2: Environment variables
  const envUrl = process.env[ENV_VARS.URL]
  const envToken = process.env[ENV_VARS.TOKEN]
  const envInstance = process.env[ENV_VARS.INSTANCE]

  if (envUrl && envToken) {
    return {
      url: envUrl,
      token: envToken,
      source: 'env'
    }
  }

  // Priority 3: Config file
  const config = await loadConfig()

  // Determine which instance to use
  const instanceName = options.instance || envInstance || config.default

  if (!instanceName) {
    return null
  }

  const instance = config.instances[instanceName]
  if (!instance) {
    return null
  }

  return {
    url: instance.url,
    token: instance.token,
    source: 'config',
    instanceName
  }
}

/**
 * Check if config file exists
 */
export function configExists(): boolean {
  return existsSync(getConfigPath())
}

/**
 * Mask a token for display (show first 4 and last 4 characters)
 */
export function maskToken(token: string): string {
  if (token.length <= 12) {
    return '****'
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

/**
 * Token refresh response from the OAuth2 server
 */
interface TokenRefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

/**
 * Check if a token is expired or about to expire
 * Returns true if token expires within the buffer time (default 5 minutes)
 */
export function isTokenExpired(tokenExpiresAt: string | undefined, bufferSeconds: number = 300): boolean {
  if (!tokenExpiresAt) {
    return false // No expiration info, assume valid
  }

  const expiresAt = new Date(tokenExpiresAt).getTime()
  const now = Date.now()
  const bufferMs = bufferSeconds * 1000

  return now >= (expiresAt - bufferMs)
}

/**
 * Result of a token refresh attempt
 */
export type TokenRefreshResult =
  | { success: true; token: string; expiresAt: string }
  | { success: false; error: string; requiresRelogin: boolean }

/**
 * Refresh an OAuth2 access token using the refresh token
 */
export async function refreshAccessToken(
  instanceName: string,
  instance: TrokkyInstance
): Promise<TokenRefreshResult> {
  if (!instance.refreshToken) {
    return {
      success: false,
      error: 'No refresh token available',
      requiresRelogin: true
    }
  }

  if (instance.authType !== 'oauth2') {
    return {
      success: false,
      error: 'Instance does not use OAuth2 authentication',
      requiresRelogin: false
    }
  }

  try {
    // Build the token endpoint URL
    const tokenUrl = `${instance.url}/auth/token`

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: instance.refreshToken,
        client_id: 'trokky-cli'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorDescription = (errorData as any).error_description || (errorData as any).error || response.statusText

      // Check if refresh token is expired or invalid
      if (response.status === 400 || response.status === 401) {
        return {
          success: false,
          error: `Token refresh failed: ${errorDescription}`,
          requiresRelogin: true
        }
      }

      return {
        success: false,
        error: `Token refresh failed: ${errorDescription}`,
        requiresRelogin: false
      }
    }

    const tokenData = await response.json() as TokenRefreshResponse

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Update the stored instance with new tokens
    const config = await loadConfig()
    if (config.instances[instanceName]) {
      config.instances[instanceName] = {
        ...config.instances[instanceName],
        token: tokenData.access_token,
        tokenExpiresAt: expiresAt,
        // Update refresh token if a new one was provided
        refreshToken: tokenData.refresh_token || instance.refreshToken,
        updatedAt: new Date().toISOString()
      }
      await saveConfig(config)
    }

    return {
      success: true,
      token: tokenData.access_token,
      expiresAt
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `Token refresh failed: ${message}`,
      requiresRelogin: false
    }
  }
}

/**
 * Get a valid token for an instance, refreshing if necessary
 * Returns the token and whether it was refreshed
 */
export async function getValidToken(
  instanceName: string,
  instance: TrokkyInstance
): Promise<{ token: string; refreshed: boolean } | { error: string; requiresRelogin: boolean }> {
  // If not OAuth2 or no expiration info, just return the current token
  if (instance.authType !== 'oauth2' || !instance.tokenExpiresAt) {
    return { token: instance.token, refreshed: false }
  }

  // Check if token is expired or about to expire
  if (!isTokenExpired(instance.tokenExpiresAt)) {
    return { token: instance.token, refreshed: false }
  }

  // Token is expired, try to refresh
  const refreshResult = await refreshAccessToken(instanceName, instance)

  if (refreshResult.success) {
    return { token: refreshResult.token, refreshed: true }
  }

  return {
    error: refreshResult.error,
    requiresRelogin: refreshResult.requiresRelogin
  }
}
