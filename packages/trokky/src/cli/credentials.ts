/**
 * Credential resolution utilities for CLI commands
 * Provides consistent credential handling across all commands
 */

import chalk from 'chalk'
import { resolveCredentials, loadConfig, getValidToken } from './config-manager.js'
import type { ResolvedCredentials, ResolveOptions } from './config-types.js'
import { ENV_VARS } from './config-types.js'
import { TrokkyClient } from '../client.js'

/**
 * Result of attempting to get credentials
 */
export type CredentialResult =
  | { success: true; credentials: ResolvedCredentials }
  | { success: false; error: string }

/**
 * Get credentials for a command, with helpful error messages
 */
export async function getCredentials(options: ResolveOptions): Promise<CredentialResult> {
  const credentials = await resolveCredentials(options)

  if (credentials) {
    return { success: true, credentials }
  }

  // Build helpful error message
  const error = buildCredentialError(options)
  return { success: false, error }
}

/**
 * Build a helpful error message when credentials are missing
 */
function buildCredentialError(options: ResolveOptions): string {
  const lines: string[] = [
    chalk.red('No credentials found.'),
    '',
    chalk.bold('You can provide credentials in several ways:'),
    '',
    chalk.cyan('1. CLI flags (highest priority):'),
    `   trokky <command> --url <url> --token <token>`,
    '',
    chalk.cyan('2. Environment variables:'),
    `   export ${ENV_VARS.URL}=https://cms.example.com/api`,
    `   export ${ENV_VARS.TOKEN}=your-api-token`,
    '',
    chalk.cyan('3. Configure an instance (recommended):'),
    `   trokky config add <name>`,
    `   trokky config use <name>`,
    '',
  ]

  if (options.instance) {
    lines.push(
      chalk.yellow(`Note: Instance '${options.instance}' was not found.`),
      chalk.gray('Run `trokky config list` to see available instances.')
    )
  }

  return lines.join('\n')
}

/**
 * Print credential source info (for verbose output)
 */
export function printCredentialSource(credentials: ResolvedCredentials): void {
  const sourceLabels: Record<string, string> = {
    cli: 'CLI flags',
    env: 'environment variables',
    config: `config file (instance: ${credentials.instanceName || 'unknown'})`
  }

  console.log(chalk.gray(`Using credentials from: ${sourceLabels[credentials.source]}`))
}

/**
 * Require credentials or exit with error
 * Use this in commands for cleaner code
 */
export async function requireCredentials(options: ResolveOptions): Promise<ResolvedCredentials> {
  const result = await getCredentials(options)

  if (!result.success) {
    console.error(result.error)
    process.exit(1)
  }

  return result.credentials
}

/**
 * Common CLI options for commands that need credentials
 */
export const credentialOptions = {
  url: {
    flags: '--url <url>',
    description: 'Trokky instance URL (or use TROKKY_URL env var, or configure an instance)'
  },
  token: {
    flags: '--token <token>',
    description: 'Authentication token (or use TROKKY_TOKEN env var, or configure an instance)'
  },
  instance: {
    flags: '--instance <name>',
    description: 'Use a specific configured instance'
  }
} as const

/**
 * Options for creating a CLI client
 */
export interface CliClientOptions extends ResolveOptions {
  quiet?: boolean
  silent?: boolean // Completely suppress all output (for --ids-only, piping, etc.)
}

/**
 * Result of creating a CLI client
 */
export interface CliClientResult {
  client: TrokkyClient
  credentials: ResolvedCredentials
}

/**
 * Create a TrokkyClient for CLI commands
 *
 * This is the primary entry point for CLI commands that need to interact
 * with a Trokky instance. It handles:
 * - Credential resolution (CLI flags > env vars > config file)
 * - Automatic token refresh for OAuth2 instances
 * - Instance info display (when using a configured instance)
 * - Client creation
 */
export async function createCliClient(options: CliClientOptions): Promise<CliClientResult> {
  const credentials = await requireCredentials(options)

  // For config-based credentials, check if token needs refresh
  let token = credentials.token
  let tokenRefreshed = false

  if (credentials.source === 'config' && credentials.instanceName) {
    const config = await loadConfig()
    const instance = config.instances[credentials.instanceName]

    if (instance) {
      const tokenResult = await getValidToken(credentials.instanceName, instance)

      if ('error' in tokenResult) {
        // Token refresh failed
        if (tokenResult.requiresRelogin) {
          console.error(chalk.red(`\nSession expired for instance '${credentials.instanceName}'.`))
          console.error(chalk.yellow(`Please run: trokky login ${credentials.url.replace('/api', '')}`))
          process.exit(1)
        } else {
          // Non-fatal error, try with existing token
          if (!options.quiet && !options.silent) {
            console.error(chalk.yellow(`Warning: ${tokenResult.error}`))
          }
        }
      } else {
        token = tokenResult.token
        tokenRefreshed = tokenResult.refreshed
      }
    }
  }

  // Display instance info when using a configured instance (unless quiet/silent mode)
  const shouldShowInstanceInfo = !options.quiet && !options.silent && credentials.source === 'config' && credentials.instanceName
  if (shouldShowInstanceInfo) {
    const refreshNote = tokenRefreshed ? chalk.green(' (token refreshed)') : ''
    console.error(chalk.gray(`Using instance: ${credentials.instanceName} (${credentials.url})${refreshNote}`))
  }

  try {
    const client = new TrokkyClient({
      baseUrl: credentials.url,
      apiToken: token
    })

    // Update credentials with potentially refreshed token
    const updatedCredentials: ResolvedCredentials = {
      ...credentials,
      token
    }

    return { client, credentials: updatedCredentials }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to create Trokky client: ${message}`)
  }
}
