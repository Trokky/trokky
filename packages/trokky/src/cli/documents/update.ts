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
import { parseSetArgs, deepMerge, unwrapDocument } from '../utils/dot-path.js'
import {
  validateData,
  formatValidationErrors,
  isInlineJson
} from '../utils/schema-validation.js'

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
  .option('--set <path=value...>', 'Set specific field paths (e.g., --set "title=New Title" --set "meta.published=true")', (value: string, previous: string[]) => {
    return previous ? [...previous, value] : [value]
  }, [])
  .option('--pretty', 'Colorized, formatted output')
  .option('--quiet', 'Suppress status messages')
  .option('--no-validate', 'Skip client-side schema validation')
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
    // If idOrFile looks like inline JSON (starts with { or [), treat it as inline JSON
    let documentId: string | undefined
    let filePath: string | undefined
    let inlineJson: string | undefined

    if (idOrFile) {
      if (isInlineJson(idOrFile)) {
        // First arg after collection is inline JSON (no ID provided)
        inlineJson = idOrFile
      } else if (idOrFile.includes('/') || idOrFile.endsWith('.json')) {
        // First arg after collection is a file path
        filePath = idOrFile
      } else {
        // First arg is an ID
        documentId = idOrFile
        // Check if second arg is inline JSON or file path
        if (file) {
          if (isInlineJson(file)) {
            inlineJson = file
          } else {
            filePath = file
          }
        }
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

    // Determine data source: --set, --data, --patch, inline JSON, file argument, or stdin
    let jsonData: string | undefined
    let isPatch = false
    let isSetUpdate = false
    let setData: Record<string, unknown> | undefined

    // Handle --set option for path-based updates
    if (options.set && options.set.length > 0) {
      setData = parseSetArgs(options.set)
      isSetUpdate = true
      isPatch = true // --set is always a partial update
    } else if (options.patch) {
      jsonData = options.patch
      isPatch = true
    } else if (options.data) {
      jsonData = options.data
    } else if (inlineJson) {
      // Auto-detected inline JSON from positional argument
      jsonData = inlineJson
      isPatch = true // Treat inline JSON as partial update by default
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

    if (!jsonData && !setData) {
      outputError('No data provided. Use --set, --data, --patch, provide a file path, inline JSON, or pipe JSON via stdin.')
      console.error('\nExamples:')
      console.error('  trokky documents update posts abc123 \'{"title":"Updated"}\'')
      console.error('  trokky documents update posts abc123 --patch \'{"status":"published"}\'')
      console.error('  trokky documents update posts abc123 --set "title=New Title"')
      console.error('  trokky documents update posts abc123 --set "meta.published=true" --set "meta.author=John"')
      console.error('  trokky documents update posts abc123 ./updated-post.json')
      process.exit(1)
    }

    const spinner = options.quiet ? null : ora('Updating document...').start()

    try {
      // Get update data from either --set or JSON input
      let data: Record<string, unknown>
      if (isSetUpdate && setData) {
        // For --set, we need to fetch the existing document and deep merge
        // to preserve other fields at the same level
        const existingResult = await client.getDocument(collection, documentId)
        const existingDoc = unwrapDocument(existingResult)

        // Deep merge: existing document + set changes
        data = deepMerge(existingDoc, setData)
      } else if (isPatch) {
        // For --patch, also fetch existing document and deep merge
        const patchData = parseJsonInput(jsonData!, filePath || '--patch') as Record<string, unknown>
        const existingResult = await client.getDocument(collection, documentId)
        const existingDoc = unwrapDocument(existingResult)

        data = deepMerge(existingDoc, patchData)
      } else {
        data = parseJsonInput(jsonData!, filePath || '--data') as Record<string, unknown>
      }

      // Validate data against schema (unless --no-validate is passed)
      if (options.validate !== false) {
        const validationResult = await validateData(client, collection, data, { partial: isPatch })
        if (!validationResult.valid) {
          spinner?.stop()
          outputError('Validation failed:')
          console.error(formatValidationErrors(validationResult.errors))
          process.exit(1)
        }
      }

      const result = await client.updateDocument(collection, documentId, data)
      const document = unwrapDocument(result)

      spinner?.stop()

      if (!options.quiet) {
        const updateType = isSetUpdate ? 'updated (set)' : (isPatch ? 'patched' : 'updated')
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
