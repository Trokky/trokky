import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { TrokkyClient } from '../client.js'
import { SchemaAnalyzer } from './schema-analyzer.js'
import { ReferenceScanner } from './reference-scanner.js'
import { resolveCredentials } from './config-manager.js'
import type { IdMapping, SchemaDefinition } from './types.js'

export const migrateCommand = new Command('migrate')
  .description('Migrate content between Trokky instances with schema-driven reference mapping')
  .option('--from <url>', 'Source Trokky instance URL (or use --from-instance)')
  .option('--to <url>', 'Target Trokky instance URL (or use --to-instance)')
  .option('--from-token <token>', 'Source authentication token')
  .option('--to-token <token>', 'Target authentication token')
  .option('--from-instance <name>', 'Use a configured instance as source')
  .option('--to-instance <name>', 'Use a configured instance as target')
  .option('--collections <collections>', 'Comma-separated list of collections to migrate (migrates all if not specified)')
  .option('--skip-media', 'Skip media files')
  .option('--clean', 'Delete all content in target before migration')
  .option('--dry-run', 'Preview changes without applying them')
  .action(async (options) => {
    // Resolve source credentials
    const sourceCredentials = await resolveCredentials({
      url: options.from,
      token: options.fromToken,
      instance: options.fromInstance
    })

    if (!sourceCredentials) {
      console.error(chalk.red('Source credentials not found.'))
      console.error(chalk.gray('Provide --from and --from-token, or use --from-instance with a configured instance.'))
      process.exit(1)
    }

    // Resolve target credentials
    const targetCredentials = await resolveCredentials({
      url: options.to,
      token: options.toToken,
      instance: options.toInstance
    })

    if (!targetCredentials) {
      console.error(chalk.red('Target credentials not found.'))
      console.error(chalk.gray('Provide --to and --to-token, or use --to-instance with a configured instance.'))
      process.exit(1)
    }

    const spinner = ora('Initializing migration...').start()

    try {
      const sourceClient = new TrokkyClient({
        baseUrl: sourceCredentials.url,
        apiToken: sourceCredentials.token
      })

      const targetClient = new TrokkyClient({
        baseUrl: targetCredentials.url,
        apiToken: targetCredentials.token
      })

      // Step 1: Fetch schemas from source
      spinner.text = 'Fetching source schemas...'
      const sourceSchemas = await sourceClient.getCollections()

      if (sourceSchemas.length === 0) {
        spinner.fail('No schemas found in source instance')
        process.exit(1)
      }

      // Filter schemas if specific collections requested
      let schemasToMigrate: SchemaDefinition[] = sourceSchemas
      if (options.collections) {
        const requested = options.collections.split(',').map((s: string) => s.trim())
        schemasToMigrate = sourceSchemas.filter((s: any) => requested.includes(s.name))

        if (schemasToMigrate.length === 0) {
          spinner.fail('None of the requested collections exist in source')
          process.exit(1)
        }
      }

      spinner.succeed(`Source: ${schemasToMigrate.length} collection(s)`)

      // Step 2: Validate target schemas
      spinner.text = 'Validating target instance...'
      const targetSchemas = await targetClient.getCollections()
      const targetSchemaMap = new Map(targetSchemas.map((s: any) => [s.name, s]))

      const validation = SchemaAnalyzer.validateSchemaCompatibility(
        schemasToMigrate,
        targetSchemas
      )

      if (!validation.compatible) {
        spinner.fail('Schema validation failed')
        console.log(chalk.red('\nErrors:'))
        validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)))
        process.exit(1)
      }

      if (validation.warnings.length > 0) {
        spinner.warn('Schema validation warnings:')
        validation.warnings.forEach(warn => console.log(chalk.yellow(`  - ${warn}`)))
      } else {
        spinner.succeed('Target schema validation passed')
      }

      // Step 3: Build migration order
      const dependencyGraph = SchemaAnalyzer.buildDependencyGraph(schemasToMigrate)
      const migrationOrder = SchemaAnalyzer.getRestoreOrder(dependencyGraph)
      spinner.info(`Migration order: ${migrationOrder.join(' → ')}`)

      if (options.dryRun) {
        console.log(chalk.bold('\n[DRY RUN MODE] - No changes will be made'))
      }

      // Step 4: Clean target if requested
      if (options.clean && !options.dryRun) {
        spinner.text = 'Cleaning target instance...'

        try {
          const existingMedia = await targetClient.listMedia()
          for (const media of existingMedia) {
            await targetClient.deleteMedia(media.id)
          }
          if (existingMedia.length > 0) {
            spinner.info(`Deleted ${existingMedia.length} media file(s)`)
          }
        } catch (error: any) {
          spinner.warn(`Failed to clean media: ${error.message}`)
        }

        let deletedCount = 0
        for (const schema of schemasToMigrate) {
          try {
            const result = await targetClient.queryDocuments(schema.name, { limit: 10000 })
            for (const doc of result.documents) {
              const docId = (doc as any).id || (doc as any)._id
              await targetClient.deleteDocument(schema.name, docId)
              deletedCount++
            }
          } catch (error: any) {
            // Continue if collection doesn't exist
          }
        }

        if (deletedCount > 0) {
          spinner.succeed(`Cleaned ${deletedCount} document(s)`)
        }
      }

      // Step 5: Migrate media
      const idMappings: IdMapping = {}
      let mediaCount = 0

      if (!options.skipMedia) {
        spinner.text = 'Migrating media files...'

        try {
          const mediaAssets = await sourceClient.listMedia()

          if (options.dryRun) {
            spinner.info(`[DRY RUN] Would migrate ${mediaAssets.length} media file(s)`)
            mediaCount = mediaAssets.length
          } else {
            for (const asset of mediaAssets) {
              try {
                const mediaUrl = `${sourceCredentials.url}/media/${asset.id}/file`
                const mediaData = await sourceClient.downloadMedia(mediaUrl)
                const result = await targetClient.uploadFile(Buffer.from(mediaData), asset.filename)

                if (result.files && result.files[0]) {
                  const newId = result.files[0].id
                  idMappings[asset.id] = newId
                  mediaCount++
                }
              } catch (error: any) {
                spinner.warn(`Failed to migrate media: ${asset.filename}`)
              }
            }

            spinner.succeed(`Migrated ${mediaCount} media file(s)`)
          }
        } catch (error: any) {
          spinner.warn(`Media migration failed: ${error.message}`)
        }
      }

      // Step 6: Migrate documents
      let totalDocuments = 0
      let totalReferencesUpdated = 0

      for (const collectionName of migrationOrder) {
        const schema = schemasToMigrate.find(s => s.name === collectionName)
        if (!schema) continue

        spinner.text = `Migrating collection: ${collectionName}...`

        try {
          const result = await sourceClient.queryDocuments(collectionName, { limit: 10000 })
          const documents = result.documents || []

          if (documents.length === 0) {
            spinner.info(`${collectionName}: no documents`)
            continue
          }

          if (options.dryRun) {
            spinner.info(`[DRY RUN] Would migrate ${documents.length} document(s) from ${collectionName}`)
            totalDocuments += documents.length
            continue
          }

          const targetSchema = targetSchemaMap.get(collectionName)
          const isSingleton = targetSchema?.singleton === true

          let migrated = 0

          for (const doc of documents) {
            try {
              const { id, _id, _createdAt, _updatedAt, _version, _revision, _collection, _type, ...cleanDoc } = doc as any
              const originalDocId = id || _id

              // Update references
              const { document: updatedDoc, updateCount } = ReferenceScanner.updateReferences(
                cleanDoc,
                schema,
                idMappings
              )

              totalReferencesUpdated += updateCount

              // Migrate document
              if (isSingleton && originalDocId) {
                // Preserve ID for singletons
                try {
                  await targetClient.updateDocument(collectionName, originalDocId, updatedDoc)
                  idMappings[originalDocId] = originalDocId
                } catch (error: any) {
                  const result = await targetClient.createDocument(collectionName, updatedDoc)
                  const newId = (result as any).document?.id || (result as any).id
                  if (newId) idMappings[originalDocId] = newId
                }
              } else {
                // Regular document
                const result = await targetClient.createDocument(collectionName, updatedDoc)
                const newId = (result as any).document?.id || (result as any).id
                if (newId && originalDocId) {
                  idMappings[originalDocId] = newId
                }
              }

              migrated++
            } catch (error: any) {
              spinner.warn(`Failed to migrate document in ${collectionName}: ${error.message}`)
            }
          }

          totalDocuments += migrated
          spinner.succeed(`${collectionName}: ${migrated}/${documents.length} document(s)`)

        } catch (error: any) {
          spinner.warn(`Failed to migrate ${collectionName}: ${error.message}`)
        }
      }

      // Final summary
      if (options.dryRun) {
        spinner.succeed('Migration dry run completed - no changes made')
      } else {
        spinner.succeed('Migration completed successfully')
      }

      console.log(chalk.bold('\nMigration Summary'))
      console.log(chalk.gray('─'.repeat(50)))
      console.log(`Source:                ${chalk.cyan(sourceCredentials.url)}`)
      console.log(`Target:                ${chalk.cyan(targetCredentials.url)}`)
      console.log(`Documents migrated:    ${chalk.cyan(totalDocuments)}`)
      console.log(`Media migrated:        ${chalk.cyan(mediaCount)}`)
      console.log(`References updated:    ${chalk.cyan(totalReferencesUpdated)}`)
      console.log(`Collections:           ${chalk.cyan(schemasToMigrate.length)}`)
      console.log(`Mode:                  ${chalk.cyan(options.dryRun ? 'Dry run' : 'Live migration')}`)
      console.log(chalk.gray('─'.repeat(50)))

    } catch (error: any) {
      spinner.fail(`Migration failed: ${error.message}`)
      console.error(chalk.red('\nError details:'), error.stack || error.message)
      process.exit(1)
    }
  })
