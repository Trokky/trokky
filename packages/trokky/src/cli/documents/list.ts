/**
 * List documents subcommand
 * trokky documents list <collection> [options]
 */

import { Command } from 'commander'
import ora from 'ora'
import { createCliClient, credentialOptions } from '../credentials.js'
import { outputDocuments, outputError, type OutputOptions } from '../utils/output.js'

export const listCommand = new Command('list')
  .description('List documents in a collection')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--limit <n>', 'Number of documents to return', parseInt)
  .option('--offset <n>', 'Offset for pagination', parseInt)
  .option('--filter <json>', 'Filter criteria as JSON')
  .option('--sort <json>', 'Sort criteria as JSON')
  .option('--ids-only', 'Output only document IDs (one per line)')
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, options) => {
    const { client } = await createCliClient({
      url: options.url,
      token: options.token,
      instance: options.instance,
      quiet: options.quiet,
      silent: options.idsOnly // Suppress instance info when outputting IDs for piping
    })

    const outputOpts: OutputOptions = {
      pretty: options.pretty,
      quiet: options.quiet,
      idsOnly: options.idsOnly
    }

    const spinner = (options.quiet || options.idsOnly) ? null : ora('Fetching documents...').start()

    try {

      // Build query options
      const queryOptions: Record<string, unknown> = {}
      if (options.limit) queryOptions.limit = options.limit
      if (options.offset) queryOptions.offset = options.offset

      if (options.filter) {
        try {
          queryOptions.filter = JSON.parse(options.filter)
        } catch {
          throw new Error(`Invalid filter JSON: ${options.filter}`)
        }
      }

      if (options.sort) {
        try {
          queryOptions.sort = JSON.parse(options.sort)
        } catch {
          throw new Error(`Invalid sort JSON: ${options.sort}`)
        }
      }

      const result = await client.queryDocuments(collection, queryOptions)
      const documents = result.documents || []

      spinner?.stop()

      outputDocuments(documents, outputOpts)

      if (!options.quiet && !options.idsOnly) {
        const total = result.pagination?.total ?? result.meta?.total ?? documents.length
        process.stderr.write(`\n${documents.length} document(s) returned (${total} total)\n`)
      }
    } catch (error: unknown) {
      spinner?.fail('Failed to list documents')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
