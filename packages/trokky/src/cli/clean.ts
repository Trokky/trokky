import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { TrokkyClient } from '../client.js'

// Helper to prompt for user confirmation
async function promptConfirmation(message: string): Promise<boolean> {
  // In a real implementation, we'd use a proper prompt library like inquirer
  // For now, we'll require explicit --confirm flag for safety
  console.log(chalk.yellow(`⚠️  ${message}`))
  console.log(chalk.red('Use --confirm flag to proceed with this destructive operation'))
  return false
}

// Helper to detect if URL looks like production
function isProductionUrl(url: string): boolean {
  const productionPatterns = [
    /^https:\/\/(?!.*\b(?:dev|test|staging|local)\b).*\.com/i,
    /^https:\/\/(?!.*\b(?:dev|test|staging|local)\b).*\.org/i,
    /^https:\/\/(?!.*\b(?:dev|test|staging|local)\b).*\.io/i,
    /production/i,
    /prod\./i
  ]

  return productionPatterns.some(pattern => pattern.test(url))
}

export const cleanCommand = new Command('clean')
  .description('Clean (delete) all content from a Trokky instance')
  .requiredOption('--url <url>', 'Trokky instance URL')
  .requiredOption('--token <token>', 'Authentication token (write permissions required)')
  .option('--collections <collections>', 'Comma-separated list of collections to clean (cleans all if not specified)')
  .option('--media-only', 'Clean only media files, leave documents intact')
  .option('--documents-only', 'Clean only documents, leave media files intact')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--confirm', 'Confirm destructive operation (required for actual deletion)')
  .option('--force', 'Skip production URL warnings (use with extreme caution)')
  .action(async (options) => {
    const spinner = ora('Starting clean operation...').start()

    try {
      const client = new TrokkyClient({
        baseUrl: options.url,
        apiToken: options.token
      })

      // Safety check: detect production-like URLs
      if (!options.force && isProductionUrl(options.url)) {
        spinner.fail('Production URL detected!')
        console.log(chalk.red(`
🚨 DANGER: This appears to be a production URL!
   ${options.url}

Production URLs typically include:
- Main domain names (.com, .org, .io) without dev/test/staging
- "production" or "prod" in the URL

If you really want to clean a production instance:
1. Create a backup first: trokky backup --url ${options.url} --token <token> --output backup.zip
2. Use --force flag to override this safety check

Aborting for safety.`))
        process.exit(1)
      }

      // Require confirmation for non-dry-run operations
      if (!options.dryRun && !options.confirm) {
        spinner.fail('Confirmation required for destructive operation')
        console.log(chalk.red(`
🗑️  This operation will PERMANENTLY DELETE content from:
   ${options.url}

To proceed, add --confirm flag:
   trokky clean --url ${options.url} --token <token> --confirm

Or use --dry-run to preview what would be deleted first.`))
        process.exit(1)
      }

      if (options.dryRun) {
        spinner.info('DRY RUN MODE - No actual deletions will be performed')
      }

      let totalDocsDeleted = 0
      let totalMediaDeleted = 0

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
              for (const asset of mediaAssets) {
                try {
                  await client.deleteMedia(asset.id)
                  totalMediaDeleted++
                } catch (error: any) {
                  spinner.warn(`Failed to delete media file ${asset.filename}: ${error.message}`)
                }
              }

              if (totalMediaDeleted > 0) {
                spinner.succeed(`Deleted ${totalMediaDeleted}/${mediaAssets.length} media files`)
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

      console.log(chalk.white(`   Instance: ${options.url}`))
      console.log(chalk.white(`   Mode: ${options.dryRun ? 'Dry run' : 'Live deletion'}`))

      if (options.dryRun) {
        console.log(chalk.yellow(`
To actually perform the deletion, run:
   trokky clean --url ${options.url} --token <token> --confirm`))
      }

    } catch (error: any) {
      spinner.fail(`Clean operation failed: ${error.message}`)
      process.exit(1)
    }
  })