/**
 * Get document subcommand
 * trokky documents get <collection> [id] [options]
 *
 * For singletons, ID is optional (defaults to collection name)
 */

import { Command } from 'commander'
import ora from 'ora'
import { createCliClient, credentialOptions } from '../credentials.js'
import { outputDocument, outputError, type OutputOptions } from '../utils/output.js'
import { checkCollection } from '../utils/collections.js'
import { pickFields, parseFieldsArg, unwrapDocument } from '../utils/dot-path.js'

export const getCommand = new Command('get')
  .description('Get a single document by ID (for singletons, ID is optional)')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('[id]', 'Document ID (optional for singletons)')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--fields <paths>', 'Comma-separated field paths to return (e.g., title,meta.description)')
  .option('--expand <fields>', 'Expand reference fields (comma-separated, or * for all)')
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, id: string | undefined, options) => {
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

    const spinner = options.quiet ? null : ora('Fetching document...').start()

    try {
      // If no ID provided, check if it's a singleton
      let documentId = id
      if (!documentId) {
        const result = await checkCollection(client, collection)
        if (!result.exists) {
          spinner?.fail('Collection not found')
          outputError(`Collection '${collection}' does not exist.`)
          process.exit(1)
        }
        if (result.singleton) {
          documentId = collection // Use collection name as ID for singletons
        } else {
          spinner?.fail('Document ID required')
          outputError(`Collection '${collection}' is not a singleton. Please provide a document ID.`)
          process.exit(1)
        }
      }

      const result = await client.getDocument(collection, documentId, {
        expand: options.expand
      })
      const document = unwrapDocument(result)

      spinner?.stop()

      // Apply field filtering if --fields option is provided
      let output: unknown = document
      if (options.fields) {
        const fieldPaths = parseFieldsArg(options.fields)
        output = pickFields(document, fieldPaths)
      }

      outputDocument(output, outputOpts)
    } catch (error: unknown) {
      spinner?.fail('Failed to get document')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
