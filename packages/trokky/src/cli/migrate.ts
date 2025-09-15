import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { TrokkyClient } from '../client.js'

export const migrateCommand = new Command('migrate')
  .description('Migrate content between Trokky instances')
  .requiredOption('--from <url>', 'Source Trokky instance URL')
  .requiredOption('--to <url>', 'Target Trokky instance URL')
  .requiredOption('--from-token <token>', 'Source authentication token')
  .requiredOption('--to-token <token>', 'Target authentication token')
  .option('--collections <collections>', 'Comma-separated list of collections')
  .option('--include-media', 'Include media files in migration')
  .option('--dry-run', 'Preview changes without applying them')
  .action(async (options) => {
    const spinner = ora('Starting migration...').start()
    
    try {
      const sourceClient = new TrokkyClient({
        baseUrl: options.from,
        apiToken: options.fromToken
      })

      const targetClient = new TrokkyClient({
        baseUrl: options.to,
        apiToken: options.toToken
      })

      const collections = options.collections ? options.collections.split(',') : ['article', 'page']
      let totalMigrated = 0

      // Migrate each collection
      for (const collection of collections) {
        spinner.text = `Migrating ${collection}...`
        
        try {
          // Fetch from source
          const result = await sourceClient.queryDocuments(collection, { limit: 1000 })
          const documents = result.documents || []

          if (documents.length === 0) {
            spinner.info(`No documents found in source ${collection}`)
            continue
          }

          if (options.dryRun) {
            spinner.info(`[DRY RUN] Would migrate ${documents.length} ${collection} documents`)
            continue
          }

          // Create in target
          let migrated = 0
          for (const doc of documents) {
            try {
              const { _id, _createdAt, _updatedAt, _version, ...cleanDoc } = doc
              await targetClient.createDocument(collection, cleanDoc)
              migrated++
            } catch (error: any) {
              spinner.warn(`Failed to migrate document in ${collection}: ${error.message}`)
            }
          }

          totalMigrated += migrated
          spinner.succeed(`Migrated ${migrated}/${documents.length} ${collection} documents`)
          
        } catch (error: any) {
          spinner.warn(`Failed to migrate ${collection}: ${error.message}`)
        }
      }

      if (options.dryRun) {
        spinner.succeed('Migration dry run completed - no changes made')
      } else {
        spinner.succeed(`Migration completed: ${totalMigrated} documents`)
      }

      // Summary
      console.log(chalk.green(`\nMigration Summary:`))
      console.log(chalk.white(`   Documents migrated: ${totalMigrated}`))
      console.log(chalk.white(`   Collections: ${collections.join(', ')}`))
      console.log(chalk.white(`   From: ${options.from}`))
      console.log(chalk.white(`   To: ${options.to}`))
      console.log(chalk.white(`   Mode: ${options.dryRun ? 'Dry run' : 'Live migration'}`))
      
    } catch (error: any) {
      spinner.fail(`Migration failed: ${error.message}`)
      process.exit(1)
    }
  })
