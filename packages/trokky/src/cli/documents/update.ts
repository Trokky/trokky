/**
 * Update document subcommand
 * trokky documents update <collection> [id] [file] [options]
 *
 * For singletons, ID is optional (defaults to collection name)
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
import { checkCollection } from '../utils/collections.js'

export const updateCommand = new Command('update')
  .description('Update an existing document (for singletons, ID is optional)')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('[id]', 'Document ID (optional for singletons)')
  .argument('[file]', 'JSON file path (optional)')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--data <json>', 'Full document data (replaces)')
  .option('--patch <json>', 'Partial update data (merges)')
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, idOrFile: string | undefined, file: string | undefined, options) => {
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

    // Resolve ID and file arguments
    // If idOrFile looks like a file path (contains / or ends with .json), treat it as file
    let documentId: string | undefined
    let filePath: string | undefined

    if (idOrFile) {
      if (idOrFile.includes('/') || idOrFile.endsWith('.json')) {
        // First arg after collection is a file path
        filePath = idOrFile
      } else {
        // First arg is an ID
        documentId = idOrFile
        filePath = file
      }
    }

    // If no ID, check if it's a singleton
    if (!documentId) {
      const result = await checkCollection(client, collection)
      if (!result.exists) {
        outputError(`Collection '${collection}' does not exist.`)
        process.exit(1)
      }
      if (result.singleton) {
        documentId = collection // Use collection name as ID for singletons
      } else {
        outputError(`Collection '${collection}' is not a singleton. Please provide a document ID.`)
        console.error('\nExamples:')
        console.error('  trokky documents update posts abc123 --patch \'{"status":"published"}\'')
        console.error('  trokky documents update settings --patch \'{"theme":"dark"}\' # singleton')
        process.exit(1)
      }
    }

    // Determine data source: --data, --patch, file argument, or stdin
    let jsonData: string | undefined
    let isPatch = false

    if (options.patch) {
      jsonData = options.patch
      isPatch = true
    } else if (options.data) {
      jsonData = options.data
    } else if (filePath) {
      try {
        jsonData = await readFile(filePath, 'utf-8')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        outputError(`Failed to read file '${filePath}': ${message}`)
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
      const data = parseJsonInput(jsonData, filePath || (isPatch ? '--patch' : '--data'))

      // For patch updates, we might need to fetch the existing document first
      // and merge the changes. However, the API might support partial updates directly.
      // For now, we pass the data as-is to updateDocument which does a partial update.
      const result = await client.updateDocument(collection, documentId, data as Record<string, unknown>)
      // DocumentResult contains the document data directly
      const document = result

      spinner?.stop()

      if (!options.quiet) {
        const updateType = isPatch ? 'patched' : 'updated'
        outputSuccess(`Document ${updateType}: ${documentId}`, outputOpts)
      }

      outputDocument(document, outputOpts)
    } catch (error: unknown) {
      spinner?.fail('Failed to update document')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
