import { Command } from 'commander'
import { readFile, readdir, rm } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import unzipper from 'unzipper'
import { TrokkyClient } from '../client.js'

export const restoreCommand = new Command('restore')
  .description('Import content to a Trokky instance from a backup file')
  .requiredOption('--url <url>', 'Trokky instance URL')
  .requiredOption('--token <token>', 'Authentication token')
  .requiredOption('--input <file>', 'Input backup file (e.g., backup.zip)')
  .option('--collections <collections>', 'Comma-separated list of collections to restore')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--overwrite', 'Overwrite existing documents')
  .option('--clean', 'Delete all existing documents before restoring')
  .action(async (options) => {
    const spinner = ora('Starting restore...').start()
    const tempDir = join(process.cwd(), `restore-temp-${Date.now()}`)

    try {
      const client = new TrokkyClient({
        baseUrl: options.url,
        apiToken: options.token
      })

      // Extract the backup archive
      spinner.text = 'Extracting backup archive...'
      await createReadStream(options.input)
        .pipe(unzipper.Extract({ path: tempDir }))
        .promise()
      spinner.succeed('Backup archive extracted')

      // Read meta file
      spinner.text = 'Reading backup metadata...'
      const meta = JSON.parse(await readFile(join(tempDir, 'meta.json'), 'utf-8'))
      
      const collectionsToRestore = options.collections 
        ? options.collections.split(',')
        : meta.collections

      let totalRestored = 0

      // Restore each collection
      for (const collection of collectionsToRestore) {
        spinner.text = `Restoring ${collection}...`
        const collectionDir = join(tempDir, 'collections', collection)
        
        try {
          const files = await readdir(collectionDir)
          const documents = await Promise.all(files.map(file => readFile(join(collectionDir, file), 'utf-8').then(JSON.parse)))

          if (documents.length === 0) {
            spinner.info(`No documents found for ${collection}`)
            continue
          }

          if (options.clean) {
            spinner.text = `Deleting existing documents in ${collection}...`
            const existingDocs = await client.queryDocuments(collection, { limit: 1000 })
            for (const doc of existingDocs.documents) {
              // Use the correct ID field
              const docId = (doc as any).id || doc._id
              await client.deleteDocument(collection, docId)
            }
            spinner.succeed(`Deleted existing documents in ${collection}`)
          }

          if (options.dryRun) {
            spinner.info(`[DRY RUN] Would restore ${documents.length} ${collection} documents`)
            continue
          }

          let restored = 0
          for (const doc of documents) {
            try {
              // Remove system fields before creating
              const { id, _id, _createdAt, _updatedAt, _version, _revision, _status, _collection, _type, ...cleanDoc } = doc
              
              // Check if this might be a singleton (only one document in collection)
              const isSingleton = documents.length === 1 && (collection === 'homepage' || collection === 'settings')
              
              if (isSingleton) {
                // For singletons, trigger auto-creation by trying to GET the expected singleton ID first
                const originalId = doc.id || doc._id
                try {
                  // Try to get the singleton - this will auto-create it if it doesn't exist
                  await client.getDocument(collection, originalId)
                  // If successful, update it with the backup data
                  await client.updateDocument(collection, originalId, cleanDoc)
                } catch (getError: any) {
                  // If GET fails, the singleton might not auto-create, try regular creation
                  try {
                    await client.createDocument(collection, cleanDoc)
                  } catch (createError: any) {
                    throw createError
                  }
                }
              } else {
                await client.createDocument(collection, cleanDoc)
              }
              restored++
            } catch (error: any) {
              if (options.overwrite && (doc.id || doc._id)) {
                spinner.text = `Overwriting existing document in ${collection}...`
                const docId = doc.id || doc._id
                const { id, _id, _createdAt, _updatedAt, _version, _revision, _status, _collection, _type, ...cleanDoc } = doc
                await client.updateDocument(collection, docId, cleanDoc)
                restored++
              } else {
                spinner.warn(`Skipped existing document in ${collection}: ${error.message}`)
              }
            }
          }

          totalRestored += restored
          spinner.succeed(`Restored ${restored}/${documents.length} ${collection} documents`)
        } catch (error: any) {
          spinner.warn(`Failed to restore ${collection}: ${error.message}`)
        }
      }

      // Restore media
      const mediaDir = join(tempDir, 'media')
      try {
        const files = await readdir(mediaDir)
        const mediaFiles = files.filter(file => !file.endsWith('.meta.json'))

        if (mediaFiles.length > 0) {
          spinner.text = 'Restoring media...'
          let restoredMedia = 0
          for (const file of mediaFiles) {
            try {
              const filePath = join(mediaDir, file)
              const fileBuffer = await readFile(filePath)
              await client.uploadFile(fileBuffer, file)
              restoredMedia++
            } catch (error: any) {
              spinner.warn(`Failed to restore media file ${file}: ${error.message}`)
            }
          }
          if (restoredMedia > 0) {
            spinner.succeed(`Restored ${restoredMedia} media files`)
          } else {
            spinner.info('No media files to restore')
          }
        }
      } catch (error: any) {
        // Ignore if media directory does not exist
      }

      if (options.dryRun) {
        spinner.succeed('Dry run completed - no changes made')
      } else {
        spinner.succeed(`Restore completed: ${totalRestored} documents`)
      }

      // Summary
      console.log(chalk.green(`
Restore Summary:`))
      console.log(chalk.white(`   Documents restored: ${totalRestored}`))
      console.log(chalk.white(`   Collections: ${collectionsToRestore.join(', ')}`))
      console.log(chalk.white(`   Mode: ${options.dryRun ? 'Dry run' : 'Live restore'}`))
      
    } catch (error: any) {
      spinner.fail(`Restore failed: ${error.message}`)
      process.exit(1)
    } finally {
      // Clean up temporary directory
      await rm(tempDir, { recursive: true, force: true })
    }
  })