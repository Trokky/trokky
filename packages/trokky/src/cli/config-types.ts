/**
 * Types for Trokky CLI configuration system
 * Manages instance credentials and settings stored in ~/.trokky/config.yaml
 */

/**
 * A configured Trokky instance
 */
export interface TrokkyInstance {
  /** Base URL of the Trokky API (e.g., https://cms.example.com/api) */
  url: string
  /** API token for authentication */
  token: string
  /** Optional description/label for the instance */
  description?: string
  /** When this instance was added */
  addedAt?: string
  /** When credentials were last updated */
  updatedAt?: string
}

/**
 * Root configuration structure stored in ~/.trokky/config.yaml
 */
export interface TrokkyConfig {
  /** Config file version for future migrations */
  version: '1.0'
  /** Name of the default instance to use */
  default?: string
  /** Map of instance name to configuration */
  instances: Record<string, TrokkyInstance>
}

/**
 * Resolved credentials from config, env vars, or CLI flags
 */
export interface ResolvedCredentials {
  url: string
  token: string
  /** Source of the credentials for debugging */
  source: 'cli' | 'env' | 'config'
  /** Instance name if loaded from config */
  instanceName?: string
}

/**
 * Options for resolving credentials
 */
export interface ResolveOptions {
  /** Explicit URL from CLI flag */
  url?: string
  /** Explicit token from CLI flag */
  token?: string
  /** Specific instance name to use */
  instance?: string
}

/**
 * Environment variable names
 */
export const ENV_VARS = {
  URL: 'TROKKY_URL',
  TOKEN: 'TROKKY_TOKEN',
  INSTANCE: 'TROKKY_INSTANCE'
} as const

/**
 * Default config directory path
 */
export const CONFIG_DIR = '.trokky'
export const CONFIG_FILE = 'config.yaml'
