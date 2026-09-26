#!/usr/bin/env node
/**
 * trokky-mcp: the Trokky MCP server over stdio.
 *
 * stdout carries the protocol, so everything human-readable goes to stderr.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readConfig } from './config.js'
import { createTrokkyMcpServer } from './server.js'

async function main(): Promise<void> {
  const config = readConfig(process.env, process.cwd())
  const server = createTrokkyMcpServer(config)
  await server.connect(new StdioServerTransport())
  const mode = config.readOnly ? 'read-only' : 'read-write'
  const uploads = config.uploadRoots && config.uploadRoots.length > 0 ? config.uploadRoots.join(', ') : 'disabled'
  process.stderr.write(`trokky-mcp: serving ${config.apiUrl} (${mode}; uploads: ${uploads})\n`)
  const { protocol, hostname } = new URL(config.apiUrl)
  if (protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    process.stderr.write('trokky-mcp: warning: plain http to a remote host sends the API token unencrypted\n')
  }
}

main().catch(error => {
  process.stderr.write(`trokky-mcp: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
