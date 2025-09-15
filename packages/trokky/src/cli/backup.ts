import { Command } from 'commander'
import { writeFile, mkdir, rm } from 'fs/promises'
import { createWriteStream } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import archiver from 'archiver'
import { TrokkyClient } from '../client.js'

export const backupCommand = new Command('backup')
  .description('Export content from a Trokky instance')
  .requiredOption('--url <url>', 'Trokky instance URL')
  .requiredOption('--token <token>', 'Authentication token')
  .requiredOption('--output <file>', 'Output file path (e.g., backup.zip)')
  .option('--collections <collections>', 'Comma-separated list of collections (auto-discovers if not specified)')
  .option('--include-media', 'Include media files in backup')
  .action(async (options) => {
    const spinner = ora('Starting backup...').start()
    const tempDir = join(process.cwd(), `backup-temp-${Date.now()}`)

    try {
      const client = new TrokkyClient({
        baseUrl: options.url,
        apiToken: options.token
      })

      // Create temporary directory
      await mkdir(tempDir, { recursive: true })

      // Discover collections if not specified
      let collections: string[]
      if (options.collections) {
        collections = options.collections.split(',')
        spinner.info(`Using specified collections: ${collections.join(', ')}`)
      } else {
        spinner.text = 'Discovering collections...'
        const collectionsData = await client.getCollections()
        collections = collectionsData.map((c: any) => c.name)
        spinner.info(`Discovered ${collections.length} collections: ${collections.join(', ')}`)
      }

      const meta = {
        timestamp: new Date().toISOString(),
        collections: collections,
      }

      await writeFile(join(tempDir, 'meta.json'), JSON.stringify(meta, null, 2))

      let totalDocs = 0

      // Backup each collection
      const collectionsDir = join(tempDir, 'collections')
      await mkdir(collectionsDir, { recursive: true })
      for (const collection of collections) {
        spinner.text = `Backing up ${collection}...`
        const collectionDir = join(collectionsDir, collection)
        await mkdir(collectionDir, { recursive: true })
        
        try {
          const result = await client.queryDocuments(collection, { limit: 1000 })
          const documents = result.documents || []
          
          for (const doc of documents) {
            // Handle both id and _id fields (API inconsistency)
            const docId = (doc as any).id || doc._id || 'unknown'
            const docPath = join(collectionDir, `${docId}.json`)
            await writeFile(docPath, JSON.stringify(doc, null, 2))
          }

          const count = documents.length
          totalDocs += count
          if (count > 0) {
            spinner.succeed(`Backed up ${count} ${collection} documents`)
          } else {
            spinner.info(`No documents in ${collection}`)
          }
        } catch (error: any) {
          spinner.warn(`Failed to backup ${collection}: ${error.message}`)
        }
      }

      // Backup media if --include-media flag is set
      if (options.includeMedia) {
        spinner.text = 'Backing up media...'
        const mediaDir = join(tempDir, 'media')
        await mkdir(mediaDir, { recursive: true })

        try {
          const mediaAssets = await client.listMedia()
          let backedUpMedia = 0

          for (const asset of mediaAssets) {
            try {
              // Construct media URL using the correct pattern: /media/{id}/file
              const mediaUrl = `${options.url}/media/${asset.id}/file`
              const mediaData = await client.downloadMedia(mediaUrl)
              const mediaPath = join(mediaDir, asset.filename)
              await writeFile(mediaPath, Buffer.from(mediaData))

              const metaPath = join(mediaDir, `${asset.id}.meta.json`)
              await writeFile(metaPath, JSON.stringify(asset, null, 2))
              backedUpMedia++
            } catch (error: any) {
              spinner.warn(`Failed to backup media file ${asset.filename}: ${error.message}`)
            }
          }

          if (backedUpMedia > 0) {
            spinner.succeed(`Backed up ${backedUpMedia} media files`)
          } else {
            spinner.info('No media files to backup')
          }
        } catch (error: any) {
          spinner.warn(`Failed to backup media: ${error.message}`)
        }
      }

      // Create a zip archive
      spinner.text = 'Creating backup archive...'
      const output = createWriteStream(options.output)
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      archive.pipe(output)
      archive.directory(tempDir, false)
      await archive.finalize()

      spinner.succeed(`Backup completed: ${options.output}`)
      
      // Summary
      console.log(chalk.green(`
Backup Summary:`))
      console.log(chalk.white(`   Documents: ${totalDocs}`))
      console.log(chalk.white(`   Collections: ${collections.join(', ')}`))
      console.log(chalk.white(`   File: ${options.output}`))
      
    } catch (error: any) {
      spinner.fail(`Backup failed: ${error.message}`)
      process.exit(1)
    } finally {
      // Clean up temporary directory
      await rm(tempDir, { recursive: true, force: true })
    }
  })