#!/usr/bin/env node
/**
 * trokky-mcp: the Trokky MCP server over stdio, plus two commands for a terminal.
 *
 *   trokky-mcp                          serve (what an MCP client runs)
 *   trokky-mcp login <url> [--name n] [--access read|edit|publish|full]
 *   trokky-mcp sites
 *
 * When serving, stdout carries the protocol, so everything human-readable goes to stderr.
 */

import { spawn } from 'node:child_process'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveApiUrl } from './api.js'
import { readConfig } from './config.js'
import { ACCESS_LEVELS, pollLogin, siteNameFromUrl, startLogin, type AccessLevel } from './device.js'
import { createTrokkyMcpServer } from './server.js'
import { SiteStore, storableApiUrl } from './sites.js'

const say = (line: string): void => { process.stderr.write(`${line}\n`) }
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

function warnIfPlainHttp(apiUrl: string): void {
  const { protocol, hostname } = new URL(apiUrl)
  if (protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    say('trokky-mcp: warning: plain http to a remote host sends the token unencrypted')
  }
}

/**
 * Best effort: the link is printed either way. The site chose this URL, so only a web address
 * is opened, and never through a shell (`cmd /c start` would run anything after an `&`).
 */
function openInBrowser(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open'
  const args = [parsed.toString()]
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
  } catch {
    // No browser here; the printed link is enough
  }
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

async function login(args: string[], store: SiteStore, readOnly: boolean): Promise<void> {
  const url = args[0]
  if (!url || url.startsWith('--')) {
    throw new Error('Usage: trokky-mcp login <site url> [--name <name>] [--access read|edit|publish|full] [--replace]')
  }
  const access = (flag(args, 'access') ?? (readOnly ? 'read' : 'edit')) as AccessLevel
  if (!(access in ACCESS_LEVELS)) {
    throw new Error(`--access must be one of: ${Object.keys(ACCESS_LEVELS).join(', ')}`)
  }
  const apiUrl = storableApiUrl(resolveApiUrl(url))
  warnIfPlainHttp(apiUrl)
  const name = flag(args, 'name') ?? siteNameFromUrl(apiUrl)
  const replace = args.includes('--replace')
  const existing = (await store.list()).sites[name]
  if (existing && !replace) {
    throw new Error(`A site named "${name}" already exists (${existing.url}). Use --name for another name, or --replace to sign in to it again.`)
  }

  const pending = await startLogin(apiUrl, access, (input, init) => fetch(input, init))
  say(`Open this link and approve code ${pending.userCode}:`)
  say(`  ${pending.verificationUrl}`)
  say('You can untick any access you do not want to give. Waiting...')
  openInBrowser(pending.verificationUrl)

  for (;;) {
    await sleep(pending.intervalMs)
    const result = await pollLogin(pending, (input, init) => fetch(input, init))
    if (result.status === 'pending') continue
    if (result.status === 'failed') throw new Error(result.reason)

    await store.add(name, {
      url: apiUrl,
      token: result.token,
      refreshToken: result.refreshToken,
      authType: 'oauth2',
      tokenExpiresAt: result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined,
      clientId: result.clientId,
      description: 'Added by the Trokky MCP server'
    }, false, replace)
    say(`Added "${name}" with: ${result.scope ?? 'the requested access'}`)
    return
  }
}

async function listSites(store: SiteStore): Promise<void> {
  const { sites, defaultSite } = await store.list()
  const names = Object.keys(sites)
  if (names.length === 0) {
    say('No sites yet. Add one with: trokky-mcp login <site url>')
    return
  }
  for (const name of names) {
    say(`${name === defaultSite ? '*' : ' '} ${name}  ${sites[name].url}`)
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const config = readConfig(process.env, process.cwd())
  const store = new SiteStore(config.configPath)

  if (command === 'login') return login(args, store, config.readOnly ?? false)
  if (command === 'sites') return listSites(store)
  if (command) throw new Error(`Unknown command "${command}". Commands: login, sites (or none, to serve).`)

  const server = createTrokkyMcpServer({ ...config, store })
  await server.connect(new StdioServerTransport())
  const mode = config.readOnly ? 'read-only' : 'read-write'
  const uploads = config.uploadRoots && config.uploadRoots.length > 0 ? config.uploadRoots.join(', ') : 'disabled'
  if (config.apiUrl) {
    say(`trokky-mcp: serving ${config.apiUrl} (${mode}; uploads: ${uploads})`)
    warnIfPlainHttp(config.apiUrl)
  } else {
    const { sites, defaultSite } = await store.list()
    say(`trokky-mcp: serving ${Object.keys(sites).length} site(s) from ${store.configPath}${defaultSite ? `, default ${defaultSite}` : ''} (${mode}; uploads: ${uploads})`)
  }
}

main().catch(error => {
  say(`trokky-mcp: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
