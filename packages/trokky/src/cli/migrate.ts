import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { TrokkyClient } from '../client.js'

// Helper function to find all references in a document (same as backup/restore)
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

export const migrateCommand = new Command('migrate')
  .description('Migrate content between Trokky instances with smart reference mapping')
  .requiredOption('--from <url>', 'Source Trokky instance URL')
  .requiredOption('--to <url>', 'Target Trokky instance URL')
  .requiredOption('--from-token <token>', 'Source authentication token (read permissions)')
  .requiredOption('--to-token <token>', 'Target authentication token (write permissions)')
  .option('--collections <collections>', 'Comma-separated list of collections (auto-discovers if not specified)')
  .option('--skip-media', 'Skip media files (not recommended - may break references)')
  .option('--clean', 'Clean target instance before migration')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--force', 'Skip production URL warnings (use with extreme caution)')
  .action(async (options) => {
    const spinner = ora('Starting migration...').start()

    try {
      // Safety check: detect production-like URLs
      if (!options.force && (isProductionUrl(options.from) || isProductionUrl(options.to))) {
        spinner.fail('Production URL detected!')
        console.log(chalk.red(`
🚨 DANGER: Production URLs detected!
   From: ${options.from}
   To: ${options.to}

Migration can permanently alter content. If you really want to proceed:
1. Create backups first
2. Use --force flag to override this safety check

Aborting for safety.`))
        process.exit(1)
      }

      const sourceClient = new TrokkyClient({
        baseUrl: options.from,
        apiToken: options.fromToken
      })

      const targetClient = new TrokkyClient({
        baseUrl: options.to,
        apiToken: options.toToken
      })

      // Discover collections if not specified
      let collections: string[]
      if (options.collections) {
        collections = options.collections.split(',').map((s: string) => s.trim())
        spinner.info(`Using specified collections: ${collections.join(', ')}`)
      } else {
        spinner.text = 'Discovering collections from source...'
        try {
          const collectionsData = await sourceClient.getCollections()
          collections = collectionsData.map((c: any) => c.name)
          spinner.info(`Discovered ${collections.length} collections: ${collections.join(', ')}`)
        } catch (error: any) {
          spinner.warn(`Failed to discover collections, using defaults: ${error.message}`)
          collections = ['article', 'page'] // Fallback only if discovery fails
        }
      }

      if (options.dryRun) {
        spinner.info('DRY RUN MODE - No actual changes will be made')
      }

      // Track ID mappings for reference updates
      const idMappings: Record<string, string> = {}
      let totalDocuments = 0
      let totalMedia = 0
      let totalReferencesUpdated = 0

      // Clean target instance if requested
      if (options.clean && !options.dryRun) {
        spinner.text = 'Cleaning target instance...'
        try {
          // Clean media first
          const existingMedia = await targetClient.listMedia()
          for (const media of existingMedia) {
            await targetClient.deleteMedia(media.id)
          }

          // Clean documents
          let totalDocsDeleted = 0
          for (const collection of collections) {
            const result = await targetClient.queryDocuments(collection, { limit: 1000 })
            const documents = result.documents || []
            for (const doc of documents) {
              const docId = (doc as any).id || (doc as any)._id
              await targetClient.deleteDocument(collection, docId)
              totalDocsDeleted++
            }
          }

          if (existingMedia.length > 0 || totalDocsDeleted > 0) {
            spinner.succeed(`Cleaned target: ${existingMedia.length} media files, ${totalDocsDeleted} documents from ${collections.length} collections`)
          }
        } catch (error: any) {
          spinner.warn(`Failed to clean target: ${error.message}`)
        }
      }

      // Step 1: Discover all referenced media IDs from documents
      spinner.text = 'Discovering media references in documents...'
      const referencedMediaIds = new Set<string>()

      for (const collection of collections) {
        try {
          const result = await sourceClient.queryDocuments(collection, { limit: 1000 })
          const documents = result.documents || []

          for (const doc of documents) {
            const { id, _id, _createdAt, _updatedAt, _version, _revision, _status, _collection, _type, ...cleanDoc } = doc as any
            const refs = findDocumentReferences(cleanDoc)

            refs.forEach(ref => {
              if (ref.startsWith('media-')) {
                referencedMediaIds.add(ref)
              }
            })
          }
        } catch (error: any) {
          spinner.warn(`Failed to scan ${collection} for references: ${error.message}`)
        }
      }

      spinner.info(`📋 Found ${referencedMediaIds.size} unique media references in documents`)

      // Step 2: Migrate media files (both available and referenced)
      if (!options.skipMedia) {
        spinner.text = 'Migrating media files...'
        try {
          const mediaAssets = await sourceClient.listMedia()
          const availableMediaIds = new Set(mediaAssets.map(asset => asset.id))

          spinner.info(`📁 Available media files: ${mediaAssets.length}`)
          spinner.info(`🔗 Referenced media IDs: ${Array.from(referencedMediaIds).slice(0, 3).join(', ')}...`)

          // Check for missing media
          const missingMedia = Array.from(referencedMediaIds).filter(id => !availableMediaIds.has(id))
          if (missingMedia.length > 0) {
            spinner.warn(`⚠️ ${missingMedia.length} referenced media files are missing from source:`)
            missingMedia.slice(0, 5).forEach(id => spinner.warn(`   Missing: ${id}`))
          }

          if (mediaAssets.length === 0) {
            spinner.info('No media files to migrate')
          } else {
            if (options.dryRun) {
              spinner.info(`[DRY RUN] Would migrate ${mediaAssets.length} media files`)
              totalMedia = mediaAssets.length
            } else {
              for (const asset of mediaAssets) {
                try {
                  // Download media from source
                  const mediaUrl = `${options.from}/media/${asset.id}/file`
                  const mediaData = await sourceClient.downloadMedia(mediaUrl)

                  // Upload to target
                  const result = await targetClient.uploadFile(Buffer.from(mediaData), asset.filename)

                  if (result.files && result.files[0]) {
                    const newId = result.files[0].id
                    idMappings[asset.id] = newId
                    const isReferenced = referencedMediaIds.has(asset.id) ? '🔗' : '📁'
                    spinner.info(`📸 Media mapping: ${asset.id} -> ${newId} (${asset.filename}) ${isReferenced}`)
                    totalMedia++
                  }
                } catch (error: any) {
                  spinner.warn(`Failed to migrate media file ${asset.filename}: ${error.message}`)
                }
              }

              if (totalMedia > 0) {
                spinner.succeed(`Migrated ${totalMedia}/${mediaAssets.length} media files`)
              }
            }
          }
        } catch (error: any) {
          spinner.warn(`Failed to migrate media: ${error.message}`)
        }
      }

      // Step 2: Migrate documents with reference updates
      for (const collection of collections) {
        spinner.text = `Migrating ${collection} documents...`

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
            totalDocuments += documents.length
            continue
          }

          // Migrate documents with reference updates
          let migrated = 0
          for (const doc of documents) {
            try {
              // Remove system fields
              const { id, _id, _createdAt, _updatedAt, _version, _revision, _status, _collection, _type, ...cleanDoc } = doc as any
              const originalDocId = id || _id

              // Debug: Show document structure for first few documents
              if (collection === 'homepage') {
                spinner.info(`📄 Homepage document structure preview:`)
                const preview = JSON.stringify(cleanDoc, null, 2).substring(0, 500) + '...'
                console.log(preview)
              }

              // Update references with new IDs
              const originalRefs = findDocumentReferences(cleanDoc)
              const updatedDoc = updateReferences(cleanDoc, idMappings)
              const updatedRefs = findDocumentReferences(updatedDoc)

              // Debug logging
              if (originalRefs.length > 0) {
                spinner.info(`🔍 Found ${originalRefs.length} references in ${collection} document: ${originalRefs.join(', ')}`)
                spinner.info(`🗂️ Available mappings: ${Object.keys(idMappings).length} (${Object.keys(idMappings).slice(0, 3).join(', ')}...)`)

                let refsUpdatedInDoc = 0
                for (let i = 0; i < originalRefs.length; i++) {
                  const oldRef = originalRefs[i]
                  const newRef = updatedRefs[i]

                  if (oldRef !== newRef) {
                    spinner.info(`🔗 Reference updated: ${oldRef} -> ${newRef}`)
                    refsUpdatedInDoc++
                  } else if (idMappings[oldRef]) {
                    spinner.warn(`⚠️ Reference ${oldRef} has mapping ${idMappings[oldRef]} but wasn't updated`)
                  } else {
                    spinner.info(`ℹ️ Reference ${oldRef} has no mapping (may be document reference)`)
                  }
                }

                if (refsUpdatedInDoc > 0) {
                  spinner.info(`🔗 Updated ${refsUpdatedInDoc} references in ${collection} document`)
                  totalReferencesUpdated += refsUpdatedInDoc
                } else {
                  spinner.warn(`⚠️ No references were actually updated despite finding ${originalRefs.length} references`)
                }
              } else {
                spinner.info(`ℹ️ No references found in ${collection} document`)
              }

              // Check if this might be a singleton (only one document in collection)
              const isSingleton = documents.length === 1 && (collection === 'homepage' || collection === 'settings')

              if (isSingleton) {
                spinner.info(`🏠 Handling singleton document in ${collection}`)
                // For singletons, try to update if exists, otherwise create
                try {
                  // Try to get the singleton first
                  await targetClient.getDocument(collection, originalDocId)
                  // If successful, update it with the migration data
                  await targetClient.updateDocument(collection, originalDocId, updatedDoc)
                  spinner.info(`Updated existing singleton in ${collection}`)
                } catch (getError: any) {
                  // If GET fails, try regular creation
                  try {
                    await targetClient.createDocument(collection, updatedDoc)
                    spinner.info(`Created new singleton in ${collection}`)
                  } catch (createError: any) {
                    // If create also fails, provide detailed error info
                    const errorDetails = createError.response?.data || createError.message
                    throw new Error(`Singleton creation failed: ${JSON.stringify(errorDetails)}`)
                  }
                }
              } else {
                // Regular document creation
                await targetClient.createDocument(collection, updatedDoc)
              }

              migrated++
            } catch (error: any) {
              const docId = (doc as any).id || (doc as any)._id || 'unknown'
              // Provide more detailed error information
              const errorDetails = error.response?.data || error.message
              spinner.warn(`Failed to migrate ${collection} document ${docId}: ${JSON.stringify(errorDetails)}`)
            }
          }

          totalDocuments += migrated
          if (migrated > 0) {
            spinner.succeed(`Migrated ${migrated}/${documents.length} ${collection} documents`)
          }

        } catch (error: any) {
          spinner.warn(`Failed to migrate collection ${collection}: ${error.message}`)
        }
      }

      if (options.dryRun) {
        spinner.succeed('Migration dry run completed - no changes made')
      } else {
        spinner.succeed(`Migration completed successfully`)
      }

      // Enhanced summary
      const mode = options.dryRun ? 'Would migrate' : 'Migrated'
      console.log(chalk.green(`
Migration Summary:`))
      console.log(chalk.white(`   Documents: ${mode.toLowerCase()} ${totalDocuments}`))

      if (!options.skipMedia) {
        console.log(chalk.white(`   Media files: ${mode.toLowerCase()} ${totalMedia}`))
        console.log(chalk.white(`   Media mappings: ${Object.keys(idMappings).length}`))
        console.log(chalk.white(`   Referenced media: ${referencedMediaIds.size}`))

        const missingCount = Array.from(referencedMediaIds).filter(id => !Object.keys(idMappings).includes(id)).length
        if (missingCount > 0) {
          console.log(chalk.yellow(`   ⚠️ Missing referenced media: ${missingCount}`))
        }
      }

      if (!options.dryRun) {
        console.log(chalk.white(`   References updated: ${totalReferencesUpdated}`))
      }

      console.log(chalk.white(`   Collections: ${collections.join(', ')}`))
      console.log(chalk.white(`   From: ${options.from}`))
      console.log(chalk.white(`   To: ${options.to}`))
      console.log(chalk.white(`   Mode: ${options.dryRun ? 'Dry run' : 'Live migration'}`))

      if (options.dryRun) {
        console.log(chalk.yellow(`
To actually perform the migration, remove --dry-run:
   trokky migrate --from ${options.from} --to ${options.to} --from-token <token> --to-token <token>`))
      }

    } catch (error: any) {
      spinner.fail(`Migration failed: ${error.message}`)
      process.exit(1)
    }
  })
