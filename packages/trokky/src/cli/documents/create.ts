/**
 * Create document subcommand
 * trokky documents create <collection> [file] [options]
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

export const createCommand = new Command('create')
  .description('Create a new document')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('[file]', 'JSON file path (optional, can use stdin or --data)')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--data <json>', 'Inline JSON data')
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, file: string | undefined, options) => {
    const credentials = await requireCredentials({
      url: options.url,
      token: options.token,
      instance: options.instance
    })

    const outputOpts: OutputOptions = {
      pretty: options.pretty,
      quiet: options.quiet
    }

    // Determine data source: --data flag, file argument, or stdin
    let jsonData: string | undefined

    if (options.data) {
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
      outputError('No data provided. Use --data, provide a file path, or pipe JSON via stdin.')
      console.error('\nExamples:')
      console.error('  trokky documents create posts --data \'{"title":"Hello"}\'')
      console.error('  trokky documents create posts ./post.json')
      console.error('  echo \'{"title":"Hello"}\' | trokky documents create posts')
      process.exit(1)
    }

    const spinner = options.quiet ? null : ora('Creating document...').start()

    try {
      const data = parseJsonInput(jsonData, file || '--data')

      const client = new TrokkyClient({
        baseUrl: credentials.url,
        apiToken: credentials.token
      })

      const result = await client.createDocument(collection, data as Record<string, unknown>)
      // DocumentResult contains the document data directly
      const document = result

      spinner?.stop()

      if (!options.quiet) {
        outputSuccess(`Document created: ${document._id}`, outputOpts)
      }

      outputDocument(document, outputOpts)
    } catch (error: unknown) {
      spinner?.fail('Failed to create document')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
