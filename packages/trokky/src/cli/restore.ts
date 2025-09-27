import { Command } from 'commander'
import { readFile, readdir, rm } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import unzipper from 'unzipper'
import { TrokkyClient } from '../client.js'

// Helper function to find all references in a document (matches backup logic)
function findDocumentReferences(obj: any, refs: string[] = []): string[] {
  if (typeof obj !== 'object' || obj === null) return refs

  if (Array.isArray(obj)) {
    obj.forEach(item => findDocumentReferences(item, refs))
  } else {
    for (const [key, value] of Object.entries(obj)) {
      if (key === '_ref' && typeof value === 'string') {
        refs.push(value)
      } else if (key === 'asset' && typeof value === 'object' && value !== null &&
                 (value as any)._ref && typeof (value as any)._ref === 'string') {
        // Handle media field references: { asset: { _ref: 'media-id', _type: 'mediaAsset' } }
        refs.push((value as any)._ref)
      } else if (typeof value === 'object') {
        findDocumentReferences(value, refs)
      }
    }
  }

  return refs
}

// Helper function to update references in a document
function updateReferences(obj: any, idMappings: Record<string, string>): any {
  if (typeof obj !== 'object' || obj === null) return obj

  if (Array.isArray(obj)) {
    return obj.map(item => updateReferences(item, idMappings))
  }

  const updated: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_ref' && typeof value === 'string' && idMappings[value]) {
      // Handle direct references
      updated[key] = idMappings[value]
    } else if (key === 'asset' && typeof value === 'object' && value !== null &&
               (value as any)._ref && typeof (value as any)._ref === 'string' &&
               idMappings[(value as any)._ref]) {
      // Handle media field references: { asset: { _ref: 'media-id', _type: 'mediaAsset' } }
      updated[key] = {
        ...(value as any),
        _ref: idMappings[(value as any)._ref]
      }
    } else if (typeof value === 'object') {
      updated[key] = updateReferences(value, idMappings)
    } else {
      updated[key] = value
    }
  }

  return updated
}

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

      // Read meta file and reference map
      spinner.text = 'Reading backup metadata...'
      const meta = JSON.parse(await readFile(join(tempDir, 'meta.json'), 'utf-8'))
      
      let referenceMap: Record<string, string[]> = {}
      try {
        referenceMap = JSON.parse(await readFile(join(tempDir, 'references.json'), 'utf-8'))
      } catch (error) {
        // Reference map might not exist in older backups
        spinner.info('No reference map found - references may not be preserved')
      }
      
      const collectionsToRestore = options.collections 
        ? options.collections.split(',')
        : meta.collections

      // Track ID mappings for reference updates
      const idMappings: Record<string, string> = {}
      let totalRestored = 0
      let totalReferencesUpdated = 0

      // Clean existing media if --clean flag is set
      if (options.clean) {
        spinner.text = 'Cleaning existing media...'
        try {
          const existingMedia = await client.listMedia()
          for (const media of existingMedia) {
            await client.deleteMedia(media.id)
          }
          if (existingMedia.length > 0) {
            spinner.succeed(`Deleted ${existingMedia.length} existing media files`)
          }
        } catch (error: any) {
          spinner.warn(`Failed to clean existing media: ${error.message}`)
        }
      }

      // First, restore media to get ID mappings
      const mediaDir = join(tempDir, 'media')
      try {
        const files = await readdir(mediaDir)
        const mediaFiles = files.filter(file => !file.endsWith('.meta.json'))

        if (mediaFiles.length > 0) {
          spinner.text = 'Restoring media and tracking ID mappings...'
          let restoredMedia = 0
          for (const file of mediaFiles) {
            try {
              const filePath = join(mediaDir, file)
              const fileBuffer = await readFile(filePath)
              const result = await client.uploadFile(fileBuffer, file)
              
              // Find corresponding metadata file by filename
              const metaFiles = files.filter(f => f.endsWith('.meta.json'))
              let oldId: string | null = null
              
              for (const metaFile of metaFiles) {
                const metaContent = JSON.parse(await readFile(join(mediaDir, metaFile), 'utf-8'))
                if (metaContent.filename === file) {
                  oldId = metaContent.id
                  break
                }
              }
              
              if (oldId && result.files && result.files[0]) {
                const newId = result.files[0].id
                idMappings[oldId] = newId
                spinner.info(`📸 Media mapping: ${oldId} -> ${newId} (${file})`)
              } else {
                spinner.warn(`⚠️  Failed to map media file ${file} - no metadata found`)
              }
              
              restoredMedia++
            } catch (error: any) {
              spinner.warn(`Failed to restore media file ${file}: ${error.message}`)
            }
          }
          if (restoredMedia > 0) {
            spinner.succeed(`Restored ${restoredMedia} media files with ID tracking`)
          }
        }
      } catch (error: any) {
        // Ignore if media directory does not exist
      }

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

              // Track document ID mapping for cross-document references
              const originalDocId = doc.id || doc._id

              // Update references with new IDs
              const originalRefs = findDocumentReferences(cleanDoc)
              const updatedDoc = updateReferences(cleanDoc, idMappings)
              const updatedRefs = findDocumentReferences(updatedDoc)

              if (originalRefs.length > 0) {
                let refsUpdatedInDoc = 0
                spinner.info(`🔗 Updating ${originalRefs.length} references in document ${originalDocId}`)
                for (let i = 0; i < originalRefs.length; i++) {
                  if (originalRefs[i] !== updatedRefs[i]) {
                    spinner.info(`   ${originalRefs[i]} -> ${updatedRefs[i]}`)
                    refsUpdatedInDoc++
                  }
                }
                totalReferencesUpdated += refsUpdatedInDoc
              }

              // Check if this might be a singleton (only one document in collection)
              const isSingleton = documents.length === 1 && (collection === 'homepage' || collection === 'settings')
              
              if (isSingleton) {
                // For singletons, trigger auto-creation by trying to GET the expected singleton ID first
                try {
                  // Try to get the singleton - this will auto-create it if it doesn't exist
                  await client.getDocument(collection, originalDocId)
                  // If successful, update it with the backup data
                  await client.updateDocument(collection, originalDocId, updatedDoc)
                  // Track singleton ID mapping (same ID)
                  idMappings[originalDocId] = originalDocId
                } catch (getError: any) {
                  // If GET fails, the singleton might not auto-create, try regular creation
                  try {
                    const result = await client.createDocument(collection, updatedDoc)
                    const newDocId = (result as any).document?.id || (result as any).id
                    if (newDocId) idMappings[originalDocId] = newDocId
                  } catch (createError: any) {
                    throw createError
                  }
                }
              } else {
                const result = await client.createDocument(collection, updatedDoc)
                const newDocId = (result as any).document?.id || (result as any).id
                if (newDocId) idMappings[originalDocId] = newDocId
              }
              restored++
            } catch (error: any) {
              if (options.overwrite && (doc.id || doc._id)) {
                spinner.text = `Overwriting existing document in ${collection}...`
                const docId = doc.id || doc._id
                const { id, _id, _createdAt, _updatedAt, _version, _revision, _status, _collection, _type, ...cleanDoc } = doc
                const updatedDoc = updateReferences(cleanDoc, idMappings)
                await client.updateDocument(collection, docId, updatedDoc)
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

      if (options.dryRun) {
        spinner.succeed('Dry run completed - no changes made')
      } else {
        spinner.succeed(`Restore completed: ${totalRestored} documents`)
      }

      // Summary
      console.log(chalk.green(`
Restore Summary:`))
      console.log(chalk.white(`   Documents restored: ${totalRestored}`))
      console.log(chalk.white(`   Media mappings: ${Object.keys(idMappings).length}`))
      console.log(chalk.white(`   References updated: ${totalReferencesUpdated}`))
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