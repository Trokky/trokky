/**
 * Delete document subcommand
 * trokky documents delete <collection> [ids...] [options]
 *
 * For singletons, IDs are optional (defaults to collection name)
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import * as prompts from '@clack/prompts'
import { createCliClient, credentialOptions } from '../credentials.js'
import { outputError, outputSuccess, type OutputOptions } from '../utils/output.js'
import { checkCollection } from '../utils/collections.js'

export const deleteCommand = new Command('delete')
  .description('Delete one or more documents (for singletons, ID is optional)')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('[ids...]', 'Document ID(s) to delete (optional for singletons)')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--confirm', 'Skip confirmation prompt (for scripting)')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, ids: string[], options) => {
    const { client } = await createCliClient({
      url: options.url,
      token: options.token,
      instance: options.instance,
      quiet: options.quiet
    })

    const outputOpts: OutputOptions = {
      quiet: options.quiet
    }

    // If no IDs provided, check if it's a singleton
    let documentIds = ids
    if (!documentIds || documentIds.length === 0) {
      const result = await checkCollection(client, collection)
      if (!result.exists) {
        outputError(`Collection '${collection}' does not exist.`)
        process.exit(1)
      }
      if (result.singleton) {
        documentIds = [collection] // Use collection name as ID for singletons
      } else {
        outputError(`Collection '${collection}' is not a singleton. Please provide document ID(s).`)
        console.error('\nExamples:')
        console.error('  trokky documents delete posts abc123')
        console.error('  trokky documents delete posts abc123 def456 ghi789')
        console.error('  trokky documents delete settings # singleton')
        process.exit(1)
      }
    }

    // Confirmation prompt unless --confirm is passed or --quiet mode
    if (!options.confirm && !options.quiet) {
      const idList = documentIds.length <= 3
        ? documentIds.join(', ')
        : `${documentIds.slice(0, 3).join(', ')} and ${documentIds.length - 3} more`

      console.log(chalk.yellow(`\nAbout to delete ${documentIds.length} document(s) from '${collection}':`))
      console.log(chalk.gray(`  ${idList}\n`))

      const confirmed = await prompts.confirm({
        message: 'Are you sure you want to delete these documents?'
      })

      if (prompts.isCancel(confirmed) || !confirmed) {
        console.log(chalk.gray('Cancelled'))
        process.exit(0)
      }
    }

    const spinner = options.quiet ? null : ora(`Deleting ${documentIds.length} document(s)...`).start()

    try {
      let successCount = 0
      let failCount = 0
      const failures: { id: string; error: string }[] = []

      for (const id of documentIds) {
        try {
          await client.deleteDocument(collection, id)
          successCount++
          if (spinner) {
            spinner.text = `Deleting documents... (${successCount}/${documentIds.length})`
          }
        } catch (error: unknown) {
          failCount++
          const message = error instanceof Error ? error.message : String(error)
          failures.push({ id, error: message })
        }
      }

      spinner?.stop()

      // Report results
      if (successCount > 0) {
        outputSuccess(`Deleted ${successCount} document(s)`, outputOpts)
      }

      if (failCount > 0) {
        outputError(`Failed to delete ${failCount} document(s):`)
        for (const { id, error } of failures) {
          console.error(chalk.gray(`  ${id}: ${error}`))
        }
        process.exit(1)
      }
    } catch (error: unknown) {
      spinner?.fail('Failed to delete documents')
      const message = error instanceof Error ? error.message : String(error)
      outputError(message)
      process.exit(1)
    }
  })
