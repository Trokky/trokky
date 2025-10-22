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

// Helper function to sanitize document data by removing null values
// This handles schema evolution where fields that were nullable are now non-nullable
function sanitizeDocument(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeDocument(item)).filter(item => item !== null)
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip null values entirely - let the schema provide defaults or treat as undefined
    if (value === null) {
      continue
    }

    // Recursively sanitize nested objects and arrays
    if (typeof value === 'object') {
      sanitized[key] = sanitizeDocument(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

// Helper function to analyze dependencies and sort collections using topological sort
async function sortCollectionsByDependencies(
  collections: string[],
  tempDir: string,
  referenceMap: Record<string, string[]>
): Promise<string[]> {
  // Build dependency graph by analyzing documents in each collection
  const dependencies: Record<string, Set<string>> = {}

  for (const collection of collections) {
    dependencies[collection] = new Set()

    try {
      const collectionDir = join(tempDir, 'collections', collection)
      const files = await readdir(collectionDir)
      const documents = await Promise.all(
        files.map(file => readFile(join(collectionDir, file), 'utf-8').then(JSON.parse))
      )

      // Find all references in documents of this collection
      for (const doc of documents) {
        const refs = findDocumentReferences(doc)
        for (const ref of refs) {
          // Skip media references (they're handled separately)
          if (ref.startsWith('media-')) continue

          // Extract collection name from reference ID pattern
          // Most Trokky IDs follow pattern: collectionName-randomid or prefix-randomid
          // Try to match against known collection names
          let refCollection: string | null = null

          // Try to extract from ID pattern
          const parts = ref.split('-')
          if (parts.length >= 2) {
            // Try first part as collection name
            const possibleCollection = parts[0]
            if (collections.includes(possibleCollection)) {
              refCollection = possibleCollection
            }
          }

          if (refCollection && refCollection !== collection) {
            dependencies[collection].add(refCollection)
          }
        }
      }
    } catch (error) {
      // Collection directory might not exist, skip
    }
  }

  // Topological sort using Kahn's algorithm
  const sorted: string[] = []
  const inDegree: Record<string, number> = {}

  // Initialize in-degree counts
  for (const collection of collections) {
    inDegree[collection] = 0
  }

  // Calculate in-degrees
  for (const collection of collections) {
    for (const dep of dependencies[collection]) {
      if (collections.includes(dep)) {
        inDegree[collection]++
      }
    }
  }

  // Queue of collections with no dependencies
  const queue: string[] = []
  for (const collection of collections) {
    if (inDegree[collection] === 0) {
      queue.push(collection)
    }
  }

  // Process queue
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)

    // For each collection that depends on current
    for (const collection of collections) {
      if (dependencies[collection].has(current)) {
        inDegree[collection]--
        if (inDegree[collection] === 0) {
          queue.push(collection)
        }
      }
    }
  }

  // If there are cycles or remaining collections, add them at the end
  for (const collection of collections) {
    if (!sorted.includes(collection)) {
      sorted.push(collection)
    }
  }

  return sorted
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

      // ============================================================
      // PRE-FLIGHT CHECKS - All validation before destructive ops
      // ============================================================

      spinner.text = 'Running pre-flight compatibility checks...'

      // Pre-flight check 1: Validate target instance has required collections
      spinner.text = 'Validating target instance schema...'
      let availableCollections: string[] = []
      const singletonCollections: Set<string> = new Set() // Track which collections are singletons
      try {
        const collectionsData = await client.getCollections()
        availableCollections = collectionsData.map((c: any) => c.name)

        // Build singleton set from schema metadata
        for (const collectionData of collectionsData) {
          if (collectionData.singleton) {
            singletonCollections.add(collectionData.name)
            spinner.info(`📌 Detected singleton: ${collectionData.name}`)
          }
        }

        spinner.info(`Target instance has ${availableCollections.length} collections (${singletonCollections.size} singletons)`)
      } catch (error: any) {
        spinner.warn(`Failed to fetch target collections: ${error.message}`)
      }

      // Check for missing collections
      const missingCollections = collectionsToRestore.filter(
        (col: string) => !availableCollections.includes(col)
      )

      if (missingCollections.length > 0) {
        spinner.fail('Schema validation failed!')
        console.log(chalk.red(`
❌ Target instance is missing ${missingCollections.length} collection(s) from the backup:

Missing collections:
${missingCollections.map((c: string) => `   - ${c}`).join('\n')}

Available collections in target:
${availableCollections.map((c: string) => `   - ${c}`).join('\n')}

Backup collections:
${collectionsToRestore.map((c: string) => `   - ${c}`).join('\n')}

This usually means:
1. You're restoring to the wrong Trokky instance
2. The target instance has a different schema configuration

Solutions:
- Restore to the correct instance (the one this backup came from)
- Update the target instance's schema configuration to include missing collections
- Use --collections flag to restore only matching collections

Example:
   trokky restore --url ${options.url} --token <token> --input ${options.input} --collections ${availableCollections.join(',')}
`))
        process.exit(1)
      }

      spinner.succeed(`✅ All ${collectionsToRestore.length} collections exist in target instance`)

      // Pre-flight check 2: Verify media variant compatibility
      const mediaDir = join(tempDir, 'media')
      try {
        spinner.text = 'Checking media variant compatibility...'
        const files = await readdir(mediaDir)
        const metaFiles = files.filter(f => f.endsWith('.meta.json'))

        if (metaFiles.length > 0) {
          // Collect all unique variants from backup media
          const backupVariants = new Set<string>()

          for (const metaFile of metaFiles) {
            const metaContent = JSON.parse(await readFile(join(mediaDir, metaFile), 'utf-8'))
            if (metaContent.metadata?.imageVariants) {
              Object.keys(metaContent.metadata.imageVariants).forEach(variant => {
                backupVariants.add(variant)
              })
            }
          }

          if (backupVariants.size > 0) {
            // Fetch target system's configured variants
            const configResponse = await client.getStudioConfig()
            const targetVariants = new Set<string>(
              configResponse.studioConfig?.media?.variants?.map((v: any) => v.name) || []
            )

            // Check for missing variants
            const missingVariants = Array.from(backupVariants).filter(v => !targetVariants.has(v))

            if (missingVariants.length > 0) {
              spinner.fail('Media variant compatibility check failed')
              console.log(chalk.red(`
❌ Media Variant Mismatch Detected

The backup contains media files with variants that don't exist in your target system configuration.

Backup variants found: ${Array.from(backupVariants).join(', ')}
Target variants configured: ${Array.from(targetVariants).join(', ')}
Missing variants: ${missingVariants.join(', ')}

This will cause media thumbnails to not display correctly after restore.

To fix this, update your trokky.config.ts media variants configuration to include:

${missingVariants.map(v => `  {
    name: '${v}',
    width: 800,    // adjust to your needs
    height: 600,   // adjust to your needs
    format: 'webp' as const,
    quality: 85,
    fit: 'cover' as const,
  },`).join('\n')}

Then restart your Trokky instance and run the restore command again.
`))
              process.exit(1)
            }

            spinner.succeed(`Media variants compatible (${Array.from(backupVariants).join(', ')})`)
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          spinner.warn(`Could not verify media variant compatibility: ${error.message}`)
        }
        // Continue if media directory doesn't exist
      }

      // ============================================================
      // All pre-flight checks passed - Begin restoration
      // ============================================================

      // Track ID mappings for reference updates
      const idMappings: Record<string, string> = {}
      let totalRestored = 0
      let totalReferencesUpdated = 0

      // Clean ALL existing data if --clean flag is set (before any restore)
      if (options.clean) {
        // Clean media first
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

        // Clean all collections that will be restored
        spinner.text = 'Cleaning existing documents...'
        let totalDeleted = 0
        for (const collection of collectionsToRestore) {
          try {
            const existingDocs = await client.queryDocuments(collection, { limit: 10000 })
            for (const doc of existingDocs.documents) {
              const docId = (doc as any).id || doc._id
              try {
                await client.deleteDocument(collection, docId)
                totalDeleted++
              } catch (delError: any) {
                spinner.warn(`Failed to delete ${collection}/${docId}: ${delError.message}`)
              }
            }
          } catch (error: any) {
            // Collection might not exist or be accessible, continue
          }
        }
        if (totalDeleted > 0) {
          spinner.succeed(`Deleted ${totalDeleted} existing documents`)
        }
      }

      // First, restore media to get ID mappings
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

      // Sort collections by dependency order to avoid reference validation errors
      spinner.text = 'Analyzing collection dependencies...'
      const sortedCollections = await sortCollectionsByDependencies(collectionsToRestore, tempDir, referenceMap)
      spinner.info(`Restore order: ${sortedCollections.join(' → ')}`)

      // Restore each collection
      for (const collection of sortedCollections) {
        spinner.text = `Restoring ${collection}...`
        const collectionDir = join(tempDir, 'collections', collection)

        try {
          // Check if collection directory exists
          let files: string[]
          try {
            files = await readdir(collectionDir)
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              spinner.info(`No backup data found for ${collection} - skipping`)
              continue
            }
            throw error
          }

          const documents = await Promise.all(files.map(file => readFile(join(collectionDir, file), 'utf-8').then(JSON.parse)))

          if (documents.length === 0) {
            spinner.info(`No documents found for ${collection}`)
            continue
          }

          if (options.dryRun) {
            spinner.info(`[DRY RUN] Would restore ${documents.length} ${collection} documents`)
            continue
          }

          let restored = 0
          for (const doc of documents) {
            try {
              // Remove system fields before creating (but preserve _status for published state)
              const { id, _id, _createdAt, _updatedAt, _version, _revision, _collection, _type, _createdBy, _updatedBy, _createdByType, _updatedByType, ...cleanDoc } = doc

              // Track document ID mapping for cross-document references
              const originalDocId = doc.id || doc._id

              // Update references with new IDs
              const originalRefs = findDocumentReferences(cleanDoc)
              let updatedDoc = updateReferences(cleanDoc, idMappings)

              // Sanitize document to remove null values (handles schema evolution)
              updatedDoc = sanitizeDocument(updatedDoc)

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

              // Check if this is a singleton collection
              const isSingleton = singletonCollections.has(collection)

              if (isSingleton) {
                // For singletons, we need to preserve the ID from the backup
                // Try to create with the specific ID first
                const singletonId = originalDocId
                spinner.info(`📌 Restoring singleton ${collection} with ID: ${singletonId}`)

                try {
                  // Create document with explicit ID
                  const docWithId = { ...updatedDoc, id: singletonId }
                  await client.createDocument(collection, docWithId)
                  idMappings[originalDocId] = singletonId
                  spinner.info(`   ID preserved: ${singletonId}`)
                } catch (createError: any) {
                  // If creation failed, try to update existing document
                  if (createError.message && createError.message.includes('409')) {
                    try {
                      await client.updateDocument(collection, singletonId, updatedDoc)
                      idMappings[originalDocId] = singletonId
                      spinner.info(`   ID preserved (updated): ${singletonId}`)
                    } catch (updateError: any) {
                      spinner.warn(`   Failed to restore singleton ${collection}: ${updateError.message}`)
                      throw updateError
                    }
                  } else {
                    // Show detailed validation errors if available
                    if (createError.details && createError.details.errors) {
                      spinner.warn(`   Failed to restore singleton ${collection}:`)
                      spinner.warn(`   ${createError.message}`)
                      createError.details.errors.forEach((err: any) => {
                        spinner.warn(`      - ${err.field}: ${err.message} (${err.code})`)
                      })
                    } else {
                      spinner.warn(`   Failed to restore singleton ${collection}: ${createError.message}`)
                    }
                    throw createError
                  }
                }
              } else {
                // Regular document - create new with new ID
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
                // Show detailed error information for debugging
                spinner.warn(`Skipped existing document in ${collection}: ${error.message}`)
                if (error.details && error.details.errors) {
                  error.details.errors.forEach((err: any) => {
                    spinner.warn(`   - ${err.field || err.path?.join('.')}: ${err.message}`)
                  })
                }
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