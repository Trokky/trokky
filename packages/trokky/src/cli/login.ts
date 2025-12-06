/**
 * Login command for Trokky CLI
 * Uses the OAuth2 Device Authorization Flow (RFC 8628) to authenticate
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { addInstance } from './config-manager.js'

interface DeviceAuthResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

interface TokenErrorResponse {
  error: string
  error_description?: string
}

const CLIENT_ID = 'trokky-cli'
const DEFAULT_SCOPES = 'openid profile content:read content:write content:delete media:read media:write offline_access'

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Start the device authorization flow
 */
async function startDeviceAuth(baseUrl: string): Promise<DeviceAuthResponse> {
  const response = await fetch(`${baseUrl}/auth/device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: DEFAULT_SCOPES
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as TokenErrorResponse
    throw new Error(error.error_description || `Device authorization failed: ${response.statusText}`)
  }

  return response.json() as Promise<DeviceAuthResponse>
}

/**
 * Poll for the token
 */
async function pollForToken(
  baseUrl: string,
  deviceCode: string,
  interval: number,
  expiresIn: number
): Promise<TokenResponse> {
  const startTime = Date.now()
  const expirationTime = startTime + (expiresIn * 1000)
  let pollInterval = interval * 1000

  while (Date.now() < expirationTime) {
    await sleep(pollInterval)

    const response = await fetch(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: CLIENT_ID
      })
    })

    const data = await response.json() as TokenResponse | TokenErrorResponse

    if (response.ok) {
      return data as TokenResponse
    }

    const error = data as TokenErrorResponse

    switch (error.error) {
      case 'authorization_pending':
        // Keep polling
        continue

      case 'slow_down':
        // Increase polling interval
        pollInterval += 5000
        continue

      case 'access_denied':
        throw new Error('Authorization denied by user')

      case 'expired_token':
        throw new Error('Device code expired. Please try again.')

      default:
        throw new Error(error.error_description || `Token request failed: ${error.error}`)
    }
  }

  throw new Error('Device code expired. Please try again.')
}

export const loginCommand = new Command('login')
  .description('Login to a Trokky instance using browser authentication')
  .argument('<url>', 'Trokky instance URL (e.g., https://cms.example.com or https://cms.example.com/api)')
  .option('--name <name>', 'Name for this instance in config (default: derived from URL)')
  .option('--set-default', 'Set this instance as the default', true)
  .action(async (url: string, options: { name?: string; setDefault?: boolean }) => {
    // Normalize URL - remove trailing slashes and ensure we have the base API URL
    let baseUrl = url.replace(/\/+$/, '')
    if (!baseUrl.endsWith('/api')) {
      baseUrl = `${baseUrl}/api`
    }

    // Derive instance name from URL if not provided
    const instanceName = options.name || new URL(baseUrl).hostname.split('.')[0]

    console.log('')
    console.log(chalk.bold('Trokky CLI Login'))
    console.log(chalk.gray('─'.repeat(40)))
    console.log('')

    const spinner = ora('Starting device authorization...').start()

    try {
      // Start device authorization
      const deviceAuth = await startDeviceAuth(baseUrl)

      spinner.stop()

      // Display instructions to user
      console.log(chalk.green('Device authorization started!'))
      console.log('')
      console.log(chalk.bold('To complete login:'))
      console.log('')
      console.log(`  1. Open this URL in your browser:`)
      console.log(chalk.cyan(`     ${deviceAuth.verification_uri}`))
      console.log('')
      console.log(`  2. Enter this code when prompted:`)
      console.log(chalk.yellow.bold(`     ${deviceAuth.user_code}`))
      console.log('')
      console.log(chalk.gray(`  Or open the complete URL directly:`))
      console.log(chalk.cyan(`     ${deviceAuth.verification_uri_complete}`))
      console.log('')
      console.log(chalk.gray(`  Code expires in ${Math.floor(deviceAuth.expires_in / 60)} minutes`))
      console.log('')

      // Wait for user to authorize
      const pollSpinner = ora('Waiting for authorization...').start()

      const tokenResponse = await pollForToken(
        baseUrl,
        deviceAuth.device_code,
        deviceAuth.interval,
        deviceAuth.expires_in
      )

      pollSpinner.succeed('Authorization successful!')

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString()

      // Save to config
      await addInstance(
        instanceName,
        {
          url: baseUrl,
          token: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          authType: 'oauth2',
          tokenExpiresAt: expiresAt,
          description: `Logged in via OAuth2 device flow`
        },
        options.setDefault
      )

      console.log('')
      console.log(chalk.green.bold('Login successful!'))
      console.log('')
      console.log(chalk.white(`  Instance: ${chalk.cyan(instanceName)}`))
      console.log(chalk.white(`  URL: ${chalk.gray(baseUrl)}`))
      console.log(chalk.white(`  Scopes: ${chalk.gray(tokenResponse.scope)}`))
      if (options.setDefault) {
        console.log(chalk.white(`  Default: ${chalk.green('Yes')}`))
      }
      console.log('')
      console.log(chalk.gray('You can now use trokky commands without --url and --token flags.'))
      console.log('')

    } catch (error: any) {
      spinner.fail('Login failed')
      console.error('')
      console.error(chalk.red(`Error: ${error.message}`))
      console.error('')

      // Provide helpful error messages
      if (error.message.includes('fetch')) {
        console.error(chalk.yellow('Could not connect to the server. Please check:'))
        console.error(chalk.gray('  - The URL is correct'))
        console.error(chalk.gray('  - The server is running'))
        console.error(chalk.gray('  - OAuth2 is enabled on the server'))
      } else if (error.message.includes('not enabled')) {
        console.error(chalk.yellow('OAuth2 is not enabled on this server.'))
        console.error(chalk.gray('Use "trokky config add" to add credentials manually.'))
      }

      process.exit(1)
    }
  })
