/**
 * Create document subcommand
 * trokky documents create <collection> [file] [options]
 */

import { Command } from 'commander'
import { readFile } from 'fs/promises'
import ora from 'ora'
import { createCliClient, credentialOptions } from '../credentials.js'
import {
  outputDocument,
  outputError,
  outputSuccess,
  parseJsonInput,
  hasStdinData,
  readStdin,
  type OutputOptions
} from '../utils/output.js'
import {
  validateData,
  formatValidationErrors,
  isInlineJson
} from '../utils/schema-validation.js'

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
  .option('--no-validate', 'Skip client-side schema validation')
  .action(async (collection: string, file: string | undefined, options) => {
    const { client } = await createCliClient({
      url: options.url,
      token: options.token,
      instance: options.instance,
      quiet: options.quiet
    })

    const outputOpts: OutputOptions = {
      pretty: options.pretty,
      quiet: options.quiet
    }

    // Determine data source: --data flag, inline JSON, file argument, or stdin
    let jsonData: string | undefined

    if (options.data) {
      jsonData = options.data
    } else if (file) {
      // Check if the file argument is actually inline JSON
      if (isInlineJson(file)) {
        jsonData = file
      } else {
        try {
          jsonData = await readFile(file, 'utf-8')
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          outputError(`Failed to read file '${file}': ${message}`)
          process.exit(1)
        }
      }
    } else if (hasStdinData()) {
      jsonData = await readStdin()
    }

    if (!jsonData) {
      outputError('No data provided. Use --data, provide inline JSON, a file path, or pipe JSON via stdin.')
      console.error('\nExamples:')
      console.error('  trokky documents create posts \'{"title":"Hello"}\'')
      console.error('  trokky documents create posts --data \'{"title":"Hello"}\'')
      console.error('  trokky documents create posts ./post.json')
      console.error('  echo \'{"title":"Hello"}\' | trokky documents create posts')
      process.exit(1)
    }

    const spinner = options.quiet ? null : ora('Creating document...').start()

    try {
      const data = parseJsonInput(jsonData, file || '--data') as Record<string, unknown>

      // Validate data against schema (unless --no-validate is passed)
      if (options.validate !== false) {
        const validationResult = await validateData(client, collection, data, { partial: false })
        if (!validationResult.valid) {
          spinner?.stop()
          outputError('Validation failed:')
          console.error(formatValidationErrors(validationResult.errors))
          process.exit(1)
        }
      }

      const result = await client.createDocument(collection, data)
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
