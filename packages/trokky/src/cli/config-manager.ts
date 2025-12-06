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
