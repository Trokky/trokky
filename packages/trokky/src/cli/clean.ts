import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { createCliClient, credentialOptions } from './credentials.js'

export const cleanCommand = new Command('clean')
  .description('Clean (delete) all content from a Trokky instance')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .option('--collections <collections>', 'Comma-separated list of collections to clean (cleans all if not specified)')
  .option('--media-only', 'Clean only media files, leave documents intact')
  .option('--documents-only', 'Clean only documents, leave media files intact')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--confirm', 'Confirm destructive operation (required for actual deletion)')
  .action(async (options) => {
    // Resolve credentials from CLI flags, env vars, or config file
    const { client, credentials } = await createCliClient({
      url: options.url,
      token: options.token,
      instance: options.instance
    })

    const spinner = ora('Starting clean operation...').start()

    try {

      // Require confirmation for non-dry-run operations
      if (!options.dryRun && !options.confirm) {
        spinner.fail('Confirmation required for destructive operation')
        console.log(chalk.red(`
WARNING: This operation will PERMANENTLY DELETE content from:
   ${credentials.url}

To proceed, add --confirm flag:
   trokky clean --url ${credentials.url} --token <token> --confirm

Or use --dry-run to preview what would be deleted first.`))
        process.exit(1)
      }

      if (options.dryRun) {
        spinner.info('DRY RUN MODE - No actual deletions will be performed')
      }

      let totalDocsDeleted = 0
      let totalMediaDeleted = 0
      const failedDeletions: Array<{ id: string; filename: string; error: string }> = []

      // Clean documents (unless media-only flag is set)
      if (!options.mediaOnly) {
        spinner.text = 'Discovering collections...'

        try {
          const collectionsData = await client.getCollections()
          const allCollections = collectionsData.map((c: any) => c.name)
          const collectionsToClean = options.collections
            ? options.collections.split(',').map((s: string) => s.trim())
            : allCollections

          spinner.info(`Found collections: ${allCollections.join(', ')}`)
          spinner.info(`Will clean: ${collectionsToClean.join(', ')}`)

          for (const collection of collectionsToClean) {
            spinner.text = `Cleaning documents in ${collection}...`

            try {
              const result = await client.queryDocuments(collection, { limit: 1000 })
              const documents = result.documents || []

              if (documents.length === 0) {
                spinner.info(`No documents in ${collection}`)
                continue
              }

              if (options.dryRun) {
                spinner.info(`[DRY RUN] Would delete ${documents.length} documents in ${collection}`)
                totalDocsDeleted += documents.length
                continue
              }

              let deletedInCollection = 0
              for (const doc of documents) {
                try {
                  const docId = (doc as any).id || doc._id
                  await client.deleteDocument(collection, docId)
                  deletedInCollection++
                } catch (error: any) {
                  spinner.warn(`Failed to delete document in ${collection}: ${error.message}`)
                }
              }

              totalDocsDeleted += deletedInCollection
              if (deletedInCollection > 0) {
                spinner.succeed(`Deleted ${deletedInCollection}/${documents.length} documents in ${collection}`)
              }
            } catch (error: any) {
              spinner.warn(`Failed to clean collection ${collection}: ${error.message}`)
            }
          }
        } catch (error: any) {
          spinner.warn(`Failed to discover collections: ${error.message}`)
        }
      }

      // Clean media (unless documents-only flag is set)
      if (!options.documentsOnly) {
        spinner.text = 'Cleaning media files...'

        try {
          const mediaAssets = await client.listMedia()

          if (mediaAssets.length === 0) {
            spinner.info('No media files to clean')
          } else {
            if (options.dryRun) {
              spinner.info(`[DRY RUN] Would delete ${mediaAssets.length} media files`)
              totalMediaDeleted = mediaAssets.length
            } else {
              // Delete files sequentially for reliability
              // Sequential deletion ensures each file is fully processed before moving to the next
              for (let i = 0; i < mediaAssets.length; i++) {
                const asset = mediaAssets[i]
                spinner.text = `Deleting media files (${i + 1}/${mediaAssets.length})...`

                try {
                  await client.deleteMedia(asset.id)
                  totalMediaDeleted++
                } catch (error: any) {
                  const errorMessage = error?.message || 'Unknown error'
                  spinner.warn(`Failed to delete ${asset.filename}: ${errorMessage}`)
                  failedDeletions.push({
                    id: asset.id,
                    filename: asset.filename,
                    error: errorMessage
                  })
                }
              }

              if (totalMediaDeleted > 0) {
                spinner.succeed(`Deleted ${totalMediaDeleted}/${mediaAssets.length} media files`)
              }

              // Verify cleanup
              if (failedDeletions.length === 0) {
                try {
                  const remainingMedia = await client.listMedia()
                  if (remainingMedia.length > 0) {
                    spinner.warn(`${remainingMedia.length} media files remain after deletion`)
                  }
                } catch (error: any) {
                  // Ignore verification errors
                }
              }
            }
          }
        } catch (error: any) {
          spinner.warn(`Failed to clean media: ${error.message}`)
        }
      }

      // Final summary
      if (options.dryRun) {
        spinner.succeed('Dry run completed - no actual deletions performed')
      } else {
        spinner.succeed(`Clean operation completed`)
      }

      // Summary
      const mode = options.dryRun ? 'DRY RUN - Would delete' : 'Deleted'
      console.log(chalk.green(`
Clean Summary:`))

      if (!options.mediaOnly) {
        console.log(chalk.white(`   Documents: ${mode.toLowerCase()} ${totalDocsDeleted}`))
      }

      if (!options.documentsOnly) {
        console.log(chalk.white(`   Media files: ${mode.toLowerCase()} ${totalMediaDeleted}`))
      }

      console.log(chalk.white(`   Instance: ${credentials.url}`))
      console.log(chalk.white(`   Mode: ${options.dryRun ? 'Dry run' : 'Live deletion'}`))

      if (failedDeletions.length > 0) {
        console.log(chalk.red(`\nFailed Deletions: ${failedDeletions.length}`))
        failedDeletions.slice(0, 5).forEach(failure => {
          console.log(chalk.red(`   - ${failure.filename}: ${failure.error}`))
        })
        if (failedDeletions.length > 5) {
          console.log(chalk.red(`   ... and ${failedDeletions.length - 5} more`))
        }
        console.log(chalk.yellow(`\nTo retry failed deletions, run the clean command again.`))
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`
To actually perform the deletion, run:
   trokky clean --url ${credentials.url} --token <token> --confirm`))
      }

    } catch (error: any) {
      spinner.fail(`Clean operation failed: ${error.message}`)
      process.exit(1)
    }
  })