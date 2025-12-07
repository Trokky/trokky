/**
 * Get document subcommand
 * trokky documents get <collection> <id> [options]
 */

import { Command } from 'commander'
import ora from 'ora'
import { TrokkyClient } from '../../client.js'
import { requireCredentials, credentialOptions } from '../credentials.js'
import { outputDocument, outputError, type OutputOptions } from '../utils/output.js'

export const getCommand = new Command('get')
  .description('Get a single document by ID')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('<id>', 'Document ID')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, id: string, options) => {
    const credentials = await requireCredentials({
      url: options.url,
      token: options.token,
      instance: options.instance
    })

    const outputOpts: OutputOptions = {
      pretty: options.pretty,
      quiet: options.quiet
    }

    const spinner = options.quiet ? null : ora('Fetching document...').start()

    try {
      const client = new TrokkyClient({
        baseUrl: credentials.url,
        apiToken: credentials.token
      })

      const result = await client.getDocument(collection, id)
      // DocumentResult contains the document data directly
      const document = result

      spinner?.stop()

      outputDocument(document, outputOpts)
    } catch (error: unknown) {
      spinner?.fail('Failed to get document')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
