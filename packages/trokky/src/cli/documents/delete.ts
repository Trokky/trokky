/**
 * Delete document subcommand
 * trokky documents delete <collection> <id> [...ids] [options]
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import * as prompts from '@clack/prompts'
import { TrokkyClient } from '../../client.js'
import { requireCredentials, credentialOptions } from '../credentials.js'
import { outputError, outputSuccess, type OutputOptions } from '../utils/output.js'

export const deleteCommand = new Command('delete')
  .description('Delete one or more documents')
  .argument('<collection>', 'Collection name (e.g., posts, authors)')
  .argument('<ids...>', 'Document ID(s) to delete')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--confirm', 'Skip confirmation prompt (for scripting)')
  .option('--quiet', 'Suppress status messages')
  .action(async (collection: string, ids: string[], options) => {
    const credentials = await requireCredentials({
      url: options.url,
      token: options.token,
      instance: options.instance
    })

    const outputOpts: OutputOptions = {
      quiet: options.quiet
    }

    // Confirmation prompt unless --confirm is passed or --quiet mode
    if (!options.confirm && !options.quiet) {
      const idList = ids.length <= 3
        ? ids.join(', ')
        : `${ids.slice(0, 3).join(', ')} and ${ids.length - 3} more`

      console.log(chalk.yellow(`\nAbout to delete ${ids.length} document(s) from '${collection}':`))
      console.log(chalk.gray(`  ${idList}\n`))

      const confirmed = await prompts.confirm({
        message: 'Are you sure you want to delete these documents?'
      })

      if (prompts.isCancel(confirmed) || !confirmed) {
        console.log(chalk.gray('Cancelled'))
        process.exit(0)
      }
    }

    const spinner = options.quiet ? null : ora(`Deleting ${ids.length} document(s)...`).start()

    try {
      const client = new TrokkyClient({
        baseUrl: credentials.url,
        apiToken: credentials.token
      })

      let successCount = 0
      let failCount = 0
      const failures: { id: string; error: string }[] = []

      for (const id of ids) {
        try {
          await client.deleteDocument(collection, id)
          successCount++
          if (spinner) {
            spinner.text = `Deleting documents... (${successCount}/${ids.length})`
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
