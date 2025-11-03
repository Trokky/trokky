import { Command } from 'commander'
import { writeFile, mkdir, rm } from 'fs/promises'
import { createWriteStream } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import archiver from 'archiver'
import { TrokkyClient } from '../client.js'
import { SchemaAnalyzer } from './schema-analyzer.js'
import type { BackupManifest, SchemaDefinition, MediaIndex, BackupStatistics } from './types.js'

export const backupCommand = new Command('backup')
  .description('Create a schema-driven backup of a Trokky instance')
  .requiredOption('--url <url>', 'Trokky instance URL')
  .requiredOption('--token <token>', 'Authentication token')
  .requiredOption('--output <file>', 'Output file path (e.g., backup.zip)')
  .option('--collections <collections>', 'Comma-separated list of collections to backup (backups all if not specified)')
  .option('--skip-media', 'Skip media files')
  .option('--description <text>', 'Backup description for documentation')
  .action(async (options) => {
    const spinner = ora('Initializing backup...').start()
    const tempDir = join(process.cwd(), `trokky-backup-${Date.now()}`)

    try {
      const client = new TrokkyClient({
        baseUrl: options.url,
        apiToken: options.token
      })

      await mkdir(tempDir, { recursive: true })

      // Step 1: Fetch schemas
      spinner.text = 'Fetching schemas...'
      const allSchemas = await client.getCollections()
      const schemas: SchemaDefinition[] = allSchemas

      if (schemas.length === 0) {
        spinner.fail('No schemas found in target instance')
        process.exit(1)
      }

      // Filter schemas if specific collections requested
      let schemasToBackup = schemas
      if (options.collections) {
        const requestedCollections = options.collections.split(',').map((s: string) => s.trim())
        schemasToBackup = schemas.filter(s => requestedCollections.includes(s.name))

        if (schemasToBackup.length === 0) {
          spinner.fail('None of the requested collections exist')
          process.exit(1)
        }

        spinner.info(`Selected ${schemasToBackup.length} collection(s): ${schemasToBackup.map(s => s.name).join(', ')}`)
      } else {
        spinner.info(`Discovered ${schemas.length} collection(s)`)
      }

      // Step 2: Build dependency graph
      spinner.text = 'Analyzing schema dependencies...'
      const dependencyGraph = SchemaAnalyzer.buildDependencyGraph(schemasToBackup)
      const restoreOrder = SchemaAnalyzer.getRestoreOrder(dependencyGraph)
      spinner.succeed(`Restore order: ${restoreOrder.join(' → ')}`)

      // Step 3: Backup media
      const mediaIndex: MediaIndex = {}
      let mediaCount = 0

      if (!options.skipMedia) {
        spinner.text = 'Backing up media files...'
        const mediaDir = join(tempDir, 'media')
        await mkdir(mediaDir, { recursive: true })

        try {
          const mediaAssets = await client.listMedia()

          for (const asset of mediaAssets) {
            try {
              const mediaUrl = `${options.url}/media/${asset.id}/file`
              const mediaData = await client.downloadMedia(mediaUrl)
              const mediaPath = join(mediaDir, asset.filename)
              await writeFile(mediaPath, Buffer.from(mediaData))

              mediaIndex[asset.id] = {
                filename: asset.filename,
                mimeType: asset.mimeType || 'application/octet-stream',
                size: asset.size || mediaData.byteLength,
                metadata: asset.metadata
              }

              mediaCount++
            } catch (error: any) {
              spinner.warn(`Failed to backup media: ${asset.filename}`)
            }
          }

          spinner.succeed(`Backed up ${mediaCount} media file(s)`)
        } catch (error: any) {
          spinner.warn(`Media backup failed: ${error.message}`)
        }
      }

      // Step 4: Backup documents
      const collectionsDir = join(tempDir, 'collections')
      await mkdir(collectionsDir, { recursive: true })

      const collectionStats: Record<string, number> = {}
      let totalDocuments = 0

      for (const schema of schemasToBackup) {
        spinner.text = `Backing up collection: ${schema.name}...`
        const collectionDir = join(collectionsDir, schema.name)
        await mkdir(collectionDir, { recursive: true })

        try {
          const result = await client.queryDocuments(schema.name, { limit: 10000 })
          const documents = result.documents || []

          for (const doc of documents) {
            const docId = (doc as any).id || (doc as any)._id || `doc-${Date.now()}`
            const docPath = join(collectionDir, `${docId}.json`)
            await writeFile(docPath, JSON.stringify(doc, null, 2))
          }

          collectionStats[schema.name] = documents.length
          totalDocuments += documents.length

          spinner.succeed(`${schema.name}: ${documents.length} document(s)`)
        } catch (error: any) {
          spinner.warn(`Failed to backup ${schema.name}: ${error.message}`)
          collectionStats[schema.name] = 0
        }
      }

      // Step 5: Create manifest
      spinner.text = 'Creating backup manifest...'
      const statistics: BackupStatistics = {
        totalDocuments,
        totalMedia: mediaCount,
        collections: collectionStats,
        backupSizeBytes: 0 // Will be calculated after zip creation
      }

      const manifest: BackupManifest = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        source: {
          url: options.url,
          description: options.description || 'Trokky backup'
        },
        schemas: schemasToBackup,
        dependencyGraph,
        restoreOrder,
        mediaIndex,
        statistics
      }

      await writeFile(join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
      spinner.succeed('Manifest created')

      // Step 6: Create zip archive
      spinner.text = 'Creating archive...'
      const output = createWriteStream(options.output)
      const archive = archiver('zip', { zlib: { level: 9 } })

      archive.pipe(output)
      archive.directory(tempDir, false)
      await archive.finalize()

      await new Promise((resolve, reject) => {
        output.on('close', resolve)
        output.on('error', reject)
      })

      spinner.succeed('Backup completed successfully')

      // Summary
      console.log(chalk.bold('\nBackup Summary'))
      console.log(chalk.gray('─'.repeat(50)))
      console.log(`Output file:     ${chalk.cyan(options.output)}`)
      console.log(`Documents:       ${chalk.cyan(totalDocuments)}`)
      console.log(`Media files:     ${chalk.cyan(mediaCount)}`)
      console.log(`Collections:     ${chalk.cyan(schemasToBackup.length)}`)
      console.log(`Archive size:    ${chalk.cyan((archive.pointer() / 1024 / 1024).toFixed(2) + ' MB')}`)
      console.log(chalk.gray('─'.repeat(50)))

    } catch (error: any) {
      spinner.fail(`Backup failed: ${error.message}`)
      console.error(chalk.red('\nError details:'), error.stack || error.message)
      process.exit(1)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })