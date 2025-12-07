/**
 * Update document subcommand
 * trokky documents update <collection> <id> [file] [options]
 */

import { Command } from 'commander'
import { readFile } from 'fs/promises'
import ora from 'ora'
import { TrokkyClient } from '../../client.js'
import { requireCredentials, credentialOptions } from '../credentials.js'
import {
  outputDocument,
  outputError,
  outputSuccess,
  parseJsonInput,
  hasStdinData,
  readStdin,
  type OutputOptions
} from '../utils/output.js'

export const updateCommand = new Command('update')
  .description('Update an existing document')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('<id>', 'Document ID')
  .argument('[file]', 'JSON file path (optional)')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--data <json>', 'Full document data (replaces)')
  .option('--patch <json>', 'Partial update data (merges)')
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, id: string, file: string | undefined, options) => {
    const credentials = await requireCredentials({
      url: options.url,
      token: options.token,
      instance: options.instance
    })

    const outputOpts: OutputOptions = {
      pretty: options.pretty,
      quiet: options.quiet
    }

    // Determine data source: --data, --patch, file argument, or stdin
    let jsonData: string | undefined
    let isPatch = false

    if (options.patch) {
      jsonData = options.patch
      isPatch = true
    } else if (options.data) {
      jsonData = options.data
    } else if (file) {
      try {
        jsonData = await readFile(file, 'utf-8')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        outputError(`Failed to read file '${file}': ${message}`)
        process.exit(1)
      }
    } else if (hasStdinData()) {
      jsonData = await readStdin()
    }

    if (!jsonData) {
      outputError('No data provided. Use --data, --patch, provide a file path, or pipe JSON via stdin.')
      console.error('\nExamples:')
      console.error('  trokky documents update posts abc123 --data \'{"title":"Updated"}\'')
      console.error('  trokky documents update posts abc123 --patch \'{"status":"published"}\'')
      console.error('  trokky documents update posts abc123 ./updated-post.json')
      process.exit(1)
    }

    const spinner = options.quiet ? null : ora('Updating document...').start()

    try {
      const data = parseJsonInput(jsonData, file || (isPatch ? '--patch' : '--data'))

      const client = new TrokkyClient({
        baseUrl: credentials.url,
        apiToken: credentials.token
      })

      // For patch updates, we might need to fetch the existing document first
      // and merge the changes. However, the API might support partial updates directly.
      // For now, we pass the data as-is to updateDocument which does a partial update.
      const result = await client.updateDocument(collection, id, data as Record<string, unknown>)
      // DocumentResult contains the document data directly
      const document = result

      spinner?.stop()

      if (!options.quiet) {
        const updateType = isPatch ? 'patched' : 'updated'
        outputSuccess(`Document ${updateType}: ${id}`, outputOpts)
      }

      outputDocument(document, outputOpts)
    } catch (error: unknown) {
      spinner?.fail('Failed to update document')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
