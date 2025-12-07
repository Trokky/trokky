import { Command } from 'commander'
import { readFile, rm } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import unzipper from 'unzipper'
import { SchemaAnalyzer } from './schema-analyzer.js'
import { ReferenceScanner } from './reference-scanner.js'
import { createCliClient, credentialOptions } from './credentials.js'
import type { BackupManifest, IdMapping, SchemaDefinition } from './types.js'

// Helper function to sanitize document data by removing null values and empty objects
// This handles schema evolution where fields that were nullable are now non-nullable
// or where empty objects would fail validation due to required nested fields
function sanitizeDocument(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj

  if (Array.isArray(obj)) {
    // Filter out null values and empty objects from arrays
    return obj
      .map(item => sanitizeDocument(item))
      .filter(item => {
        if (item === null) return false
        if (typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 0) return false
        return true
      })
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip null values entirely - let the schema provide defaults or treat as undefined
    if (value === null) {
      continue
    }

    // Recursively sanitize nested objects and arrays
    if (typeof value === 'object') {
      const sanitizedValue = sanitizeDocument(value)

      // Skip empty objects - they might have required nested fields
      // An empty object {} will fail validation if it has required nested fields
      if (!Array.isArray(sanitizedValue) && Object.keys(sanitizedValue).length === 0) {
        continue
      }

      // Special case: Skip old media format that has 'src' property
      // Old format: { _type: "media", src: "/path", alt, width, height }
      // New format: { _type: "media", asset: { _ref: "media-xxx" }, alt }
      if (sanitizedValue._type === 'media' && sanitizedValue.src && !sanitizedValue.asset) {
        continue
      }

      sanitized[key] = sanitizedValue
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export const restoreCommand = new Command('restore')
  .description('Restore content from a Trokky backup file')
  .option(credentialOptions.url.flags, credentialOptions.url.description)
  .option(credentialOptions.token.flags, credentialOptions.token.description)
  .option(credentialOptions.instance.flags, credentialOptions.instance.description)
  .requiredOption('--input <file>', 'Backup file path (e.g., backup.zip)')
  .option('--collections <collections>', 'Comma-separated list of collections to restore (restores all if not specified)')
  .option('--with-dependencies', 'Include all dependencies of specified collections')
  .option('--clean', 'Delete all existing content before restore')
  .option('--overwrite', 'Overwrite existing documents')
  .option('--dry-run', 'Preview changes without applying them')
  .action(async (options) => {
    // Resolve credentials from CLI flags, env vars, or config file
    const { client } = await createCliClient({
      url: options.url,
      token: options.token,
      instance: options.instance
    })

    const spinner = ora('Initializing restore...').start()
    const tempDir = join(process.cwd(), `trokky-restore-${Date.now()}`)

    try {

      // Step 1: Extract backup
      spinner.text = 'Extracting backup archive...'
      await createReadStream(options.input)
        .pipe(unzipper.Extract({ path: tempDir }))
        .promise()

      // Step 2: Read manifest
      spinner.text = 'Reading backup manifest...'
      const manifestPath = join(tempDir, 'manifest.json')
      const manifestContent = await readFile(manifestPath, 'utf-8')
      const manifest: BackupManifest = JSON.parse(manifestContent)

      if (manifest.version !== '2.0') {
        spinner.fail(`Unsupported backup version: ${manifest.version}. This tool requires version 2.0`)
        process.exit(1)
      }

      spinner.succeed(`Backup from ${new Date(manifest.timestamp).toLocaleString()}`)

      // Step 3: Determine collections to restore
      let collectionsToRestore = manifest.schemas.map(s => s.name)

      if (options.collections) {
        const requested = options.collections.split(',').map((s: string) => s.trim())

        if (options.withDependencies) {
          // Include dependencies
          const withDeps = new Set<string>()
          for (const coll of requested) {
            withDeps.add(coll)
            const deps = manifest.dependencyGraph[coll] || []
            deps.forEach(d => withDeps.add(d))
          }
          collectionsToRestore = Array.from(withDeps)
        } else {
          collectionsToRestore = requested
        }

        // Validate requested collections exist in backup
        const missing = collectionsToRestore.filter(c =>
          !manifest.schemas.find(s => s.name === c)
        )

        if (missing.length > 0) {
          spinner.fail(`Collections not found in backup: ${missing.join(', ')}`)
          process.exit(1)
        }

        spinner.info(`Selected ${collectionsToRestore.length} collection(s) for restore`)
      }

      // Filter schemas and build restore order
      const schemasToRestore = manifest.schemas.filter(s =>
        collectionsToRestore.includes(s.name)
      )

      const filteredGraph = Object.fromEntries(
        Object.entries(manifest.dependencyGraph).filter(([k]) =>
          collectionsToRestore.includes(k)
        )
      )

      const restoreOrder = SchemaAnalyzer.getRestoreOrder(filteredGraph)
      spinner.info(`Restore order: ${restoreOrder.join(' → ')}`)

      // Step 4: Pre-flight validation
      spinner.text = 'Validating target instance...'
      const targetSchemas = await client.getCollections()
      const targetSchemaMap = new Map(targetSchemas.map((s: any) => [s.name, s]))

      const validation = SchemaAnalyzer.validateSchemaCompatibility(
        schemasToRestore,
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
        spinner.succeed('Schema validation passed')
      }

      if (options.dryRun) {
        console.log(chalk.bold('\n[DRY RUN MODE] - No changes will be made'))
      }

      // Step 5: Clean existing data if requested
      if (options.clean && !options.dryRun) {
        spinner.text = 'Cleaning existing data...'

        // Clean media first
        try {
          const existingMedia = await client.listMedia()
          for (const media of existingMedia) {
            await client.deleteMedia(media.id)
          }
          if (existingMedia.length > 0) {
            spinner.info(`Deleted ${existingMedia.length} media file(s)`)
          }
        } catch (error: any) {
          spinner.warn(`Failed to clean media: ${error.message}`)
        }

        // Clean documents
        let deletedCount = 0
        for (const collection of collectionsToRestore) {
          try {
            const result = await client.queryDocuments(collection, { limit: 10000 })
            for (const doc of result.documents) {
              const docId = (doc as any).id || (doc as any)._id
              await client.deleteDocument(collection, docId)
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

      // Step 6: Restore media
      const idMappings: IdMapping = {}
      let mediaRestored = 0

      const mediaDir = join(tempDir, 'media')
      const mediaEntries = Object.entries(manifest.mediaIndex)

      if (mediaEntries.length > 0 && !options.dryRun) {
        spinner.text = 'Restoring media files...'

        for (const [oldId, mediaInfo] of mediaEntries) {
          try {
            const mediaPath = join(mediaDir, mediaInfo.filename)
            const fileBuffer = await readFile(mediaPath)
            const result = await client.uploadFile(fileBuffer, mediaInfo.filename)

            if (result.files && result.files[0]) {
              const newId = result.files[0].id || result.files[0]._id
              if (newId) {
                idMappings[oldId] = newId
                mediaRestored++
              }
            } else if (result.file) {
              // Handle single file response format
              const newId = result.file.id || result.file._id
              if (newId) {
                idMappings[oldId] = newId
                mediaRestored++
              }
            } else {
              // Try direct id property
              const newId = result.id || result._id
              if (newId) {
                idMappings[oldId] = newId
                mediaRestored++
              }
            }
          } catch (error: any) {
            spinner.warn(`Failed to restore media: ${mediaInfo.filename}`)
          }
        }

        spinner.succeed(`Restored ${mediaRestored} media file(s)`)
      } else if (options.dryRun && mediaEntries.length > 0) {
        spinner.info(`[DRY RUN] Would restore ${mediaEntries.length} media file(s)`)
      }

      // Step 7: Restore documents
      let totalRestored = 0
      let totalReferencesUpdated = 0

      for (const collectionName of restoreOrder) {
        if (!collectionsToRestore.includes(collectionName)) continue

        const schema = schemasToRestore.find(s => s.name === collectionName)
        if (!schema) continue

        spinner.text = `Restoring collection: ${collectionName}...`

        // Read documents from backup
        const collectionDir = join(tempDir, 'collections', collectionName)
        let documents: any[] = []

        try {
          const fs = await import('fs/promises')
          const files = await fs.readdir(collectionDir)

          for (const file of files) {
            if (!file.endsWith('.json')) continue
            const docPath = join(collectionDir, file)
            const docContent = await readFile(docPath, 'utf-8')
            documents.push(JSON.parse(docContent))
          }
        } catch (error: any) {
          spinner.warn(`No documents found for ${collectionName}`)
          continue
        }

        if (documents.length === 0) {
          spinner.info(`${collectionName}: no documents`)
          continue
        }

        if (options.dryRun) {
          spinner.info(`[DRY RUN] Would restore ${documents.length} document(s) to ${collectionName}`)
          continue
        }

        // Check if singleton
        const targetSchema = targetSchemaMap.get(collectionName)
        const isSingleton = targetSchema?.singleton === true

        let restored = 0

        for (const doc of documents) {
          try {
            // Remove system fields
            const { id, _id, _createdAt, _updatedAt, _version, _revision, _collection, _type, ...cleanDoc } = doc
            const originalDocId = id || _id

            // Update references
            const { document: updatedDoc, updateCount } = ReferenceScanner.updateReferences(
              cleanDoc,
              schema,
              idMappings
            )

            totalReferencesUpdated += updateCount

            // Sanitize document to handle schema evolution
            // - Remove null values (schemas may have changed from nullable to non-nullable)
            // - Remove empty objects (may have required nested fields)
            // - Remove old media format (src-based instead of asset._ref)
            const sanitizedDoc = sanitizeDocument(updatedDoc)

            // Restore document
            if (isSingleton && originalDocId) {
              // Preserve ID for singletons using PUT (upsert)
              try {
                await client.updateDocument(collectionName, originalDocId, sanitizedDoc)
                idMappings[originalDocId] = originalDocId // Same ID
              } catch (error: any) {
                // If update fails, try create
                const result = await client.createDocument(collectionName, sanitizedDoc)
                const newId = (result as any).document?.id || (result as any).document?._id || (result as any).id || (result as any)._id
                if (newId) idMappings[originalDocId] = newId
              }
            } else {
              // Regular document - create new
              const result = await client.createDocument(collectionName, sanitizedDoc)
              const newId = (result as any).document?.id || (result as any).document?._id || (result as any).id || (result as any)._id
              if (newId && originalDocId) {
                idMappings[originalDocId] = newId
              }
            }

            restored++
          } catch (error: any) {
            if (options.overwrite && (doc.id || doc._id)) {
              // Try to overwrite existing document
              try {
                const docId = doc.id || doc._id
                const { id, _id, _createdAt, _updatedAt, _version, _revision, _collection, _type, ...cleanDoc } = doc
                const { document: updatedDoc } = ReferenceScanner.updateReferences(cleanDoc, schema, idMappings)
                const sanitizedDoc = sanitizeDocument(updatedDoc)
                await client.updateDocument(collectionName, docId, sanitizedDoc)
                restored++
              } catch (updateError: any) {
                spinner.warn(`Failed to restore document in ${collectionName}: ${error.message}`)
              }
            } else {
              spinner.warn(`Failed to restore document in ${collectionName}: ${error.message}`)
            }
          }
        }

        totalRestored += restored
        spinner.succeed(`${collectionName}: ${restored}/${documents.length} document(s)`)
      }

      // Final summary
      if (options.dryRun) {
        spinner.succeed('Dry run completed - no changes made')
      } else {
        spinner.succeed('Restore completed successfully')
      }

      console.log(chalk.bold('\nRestore Summary'))
      console.log(chalk.gray('─'.repeat(50)))
      console.log(`Documents restored:    ${chalk.cyan(totalRestored)}`)
      console.log(`Media restored:        ${chalk.cyan(mediaRestored)}`)
      console.log(`References updated:    ${chalk.cyan(totalReferencesUpdated)}`)
      console.log(`Collections:           ${chalk.cyan(collectionsToRestore.length)}`)
      console.log(`Mode:                  ${chalk.cyan(options.dryRun ? 'Dry run' : 'Live restore')}`)
      console.log(chalk.gray('─'.repeat(50)))

    } catch (error: any) {
      spinner.fail(`Restore failed: ${error.message}`)
      console.error(chalk.red('\nError details:'), error.stack || error.message)
      process.exit(1)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
