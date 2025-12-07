/**
 * Shared output formatting utilities for CLI commands
 */

import chalk from 'chalk'

export interface OutputOptions {
  pretty?: boolean
  json?: boolean
  quiet?: boolean
  idsOnly?: boolean
}

/**
 * Format JSON output with optional colorization
 */
export function formatJson(data: unknown, pretty: boolean = false): string {
  if (pretty) {
    return colorizeJson(JSON.stringify(data, null, 2))
  }
  return JSON.stringify(data)
}

/**
 * Colorize JSON output for terminal display
 */
function colorizeJson(json: string): string {
  return json
    // Strings (values)
    .replace(/"([^"]+)":/g, chalk.cyan('"$1"') + ':')
    // String values
    .replace(/: "([^"]*)"([,\n\r}])/g, `: ${chalk.green('"$1"')}$2`)
    // Numbers
    .replace(/: (\d+\.?\d*)([,\n\r}])/g, `: ${chalk.yellow('$1')}$2`)
    // Booleans
    .replace(/: (true|false)([,\n\r}])/g, `: ${chalk.magenta('$1')}$2`)
    // Null
    .replace(/: (null)([,\n\r}])/g, `: ${chalk.gray('$1')}$2`)
}

/**
 * Output a single document
 */
export function outputDocument(doc: unknown, options: OutputOptions): void {
  if (options.quiet) return

  if (options.idsOnly && doc && typeof doc === 'object') {
    const id = (doc as Record<string, unknown>).id || (doc as Record<string, unknown>)._id
    if (id) {
      console.log(id)
      return
    }
  }

  console.log(formatJson(doc, options.pretty))
}

/**
 * Output multiple documents
 */
export function outputDocuments(docs: unknown[], options: OutputOptions): void {
  if (options.quiet) return

  if (options.idsOnly) {
    for (const doc of docs) {
      if (doc && typeof doc === 'object') {
        const id = (doc as Record<string, unknown>).id || (doc as Record<string, unknown>)._id
        if (id) {
          console.log(id)
        }
      }
    }
    return
  }

  console.log(formatJson(docs, options.pretty))
}

/**
 * Output success message (respects quiet mode)
 */
export function outputSuccess(message: string, options: OutputOptions): void {
  if (options.quiet) return
  console.log(chalk.green(`✓ ${message}`))
}

/**
 * Output error message
 */
export function outputError(message: string): void {
  console.error(chalk.red(`✗ ${message}`))
}

/**
 * Output info message (respects quiet mode)
 */
export function outputInfo(message: string, options: OutputOptions): void {
  if (options.quiet) return
  console.log(chalk.gray(message))
}

/**
 * Parse JSON from string, file content, or throw helpful error
 */
export function parseJsonInput(input: string, source: string = 'input'): unknown {
  try {
    return JSON.parse(input)
  } catch {
    throw new Error(`Invalid JSON in ${source}: ${input.slice(0, 50)}${input.length > 50 ? '...' : ''}`)
  }
}

/**
 * Check if stdin has piped data
 */
export function hasStdinData(): boolean {
  return !process.stdin.isTTY
}

/**
 * Read data from stdin
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''

    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data.trim())
    })
    process.stdin.on('error', reject)
  })
}
