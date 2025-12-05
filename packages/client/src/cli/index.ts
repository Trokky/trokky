#!/usr/bin/env node

/**
 * Trokky Client CLI
 * Command-line tool for generating types and test data
 */

import { program } from 'commander'
import { TypeGenerator, generateTypesFromPath } from '../generator/index.js'
import { DocumentGenerator } from '../generator/document-generator.js'
import type { TypeGeneratorOptions, DocumentGeneratorOptions } from '../types/index.js'

// Types command
program
  .command('generate-types')
  .description('Generate TypeScript types from Trokky schemas')
  .option('-p, --schema-path <path>', 'Local path to schemas directory (e.g., ../cms/schemas)')
  .option('-u, --schema-url <url>', 'Schema URL to fetch from (alternative to --schema-path)')
  .option('-o, --output-dir <dir>', 'Output directory for generated types', './src/types/trokky')
  .option('-n, --namespace <name>', 'TypeScript namespace', 'Trokky')
  .option('-e, --extension <ext>', 'File extension (ts|d.ts)', 'ts')
  .option('--no-validation', 'Skip validation schema generation')
  .option('-t, --auth-token <token>', 'Authentication token (for --schema-url)')
  .option('--username <username>', 'Username for authentication (for --schema-url)')
  .option('--password <password>', 'Password for authentication (for --schema-url)')
  .action(async (options: any) => {
    try {
      // Prefer local schema path over URL
      if (options.schemaPath) {
        console.log(`Reading schemas from: ${options.schemaPath}`)
        await generateTypesFromPath({
          schemaPath: options.schemaPath,
          outputDir: options.outputDir,
          namespace: options.namespace,
          fileExtension: options.extension,
          includeValidation: options.validation
        })
      } else if (options.schemaUrl) {
        console.log(`Fetching schemas from: ${options.schemaUrl}`)
        const generatorOptions: TypeGeneratorOptions = {
          schemaUrl: options.schemaUrl,
          outputDir: options.outputDir,
          namespace: options.namespace,
          fileExtension: options.extension,
          includeValidation: options.validation,
          authToken: options.authToken,
          username: options.username,
          password: options.password
        }

        const generator = new TypeGenerator(generatorOptions)
        await generator.generateFromUrl()
      } else {
        console.error('Error: Please provide either --schema-path or --schema-url')
        console.log('\nExamples:')
        console.log('  npx trokky-client generate-types --schema-path ../cms/schemas -o ./src/types/cms')
        console.log('  npx trokky-client generate-types --schema-url http://localhost:3000/api/collections -o ./src/types/cms')
        process.exit(1)
      }

      console.log('TypeScript types generated successfully!')
      console.log(`Output: ${options.outputDir}`)
    } catch (error) {
      console.error('Failed to generate types:', error)
      process.exit(1)
    }
  })

// Documents command
program
  .command('generate-documents')
  .description('Generate test documents with faker.js')
  .option('-u, --schema-url <url>', 'Schema URL to fetch from')
  .option('-o, --output-dir <dir>', 'Output directory for generated documents', './generated')
  .option('-c, --count <number>', 'Number of documents per schema', '10')
  .option('-l, --locale <locale>', 'Faker locale', 'en')
  .option('-s, --seed <number>', 'Random seed for consistent generation')
  .option('-f, --format <format>', 'Output format (json|typescript|both)', 'json')
  .option('--no-references', 'Skip reference field generation')
  .action(async (options: any) => {
    try {
      const generatorOptions: DocumentGeneratorOptions = {
        schemaUrl: options.schemaUrl,
        outputDir: options.outputDir,
        count: parseInt(options.count),
        locale: options.locale,
        seed: options.seed ? parseInt(options.seed) : undefined,
        format: options.format,
        generateReferences: options.references
      }

      const generator = new DocumentGenerator(generatorOptions)
      const documents = await generator.generateFromUrl()
      
      console.log('✅ Test documents generated successfully!')
      console.log(`📊 Generated collections:`)
      
      for (const [collection, docs] of Object.entries(documents)) {
        console.log(`   • ${collection}: ${docs.length} documents`)
      }
    } catch (error) {
      console.error('❌ Failed to generate documents:', error)
      process.exit(1)
    }
  })

// Combined command
program
  .command('generate-all')
  .description('Generate both types and test documents')
  .option('-u, --schema-url <url>', 'Schema URL to fetch from')
  .option('--types-dir <dir>', 'Types output directory', './src/types/trokky')
  .option('--docs-dir <dir>', 'Documents output directory', './generated')
  .option('-c, --count <number>', 'Number of documents per schema', '10')
  .option('-l, --locale <locale>', 'Faker locale', 'en')
  .option('-s, --seed <number>', 'Random seed for consistent generation')
  .action(async (options: any) => {
    try {
      console.log('🚀 Generating TypeScript types...')
      
      // Generate types
      const typeGenerator = new TypeGenerator({
        schemaUrl: options.schemaUrl,
        outputDir: options.typesDir,
        namespace: 'Trokky',
        fileExtension: 'ts',
        includeValidation: true
      })
      await typeGenerator.generateFromUrl()
      
      console.log('✅ Types generated!')
      console.log('🚀 Generating test documents...')
      
      // Generate documents
      const docGenerator = new DocumentGenerator({
        schemaUrl: options.schemaUrl,
        outputDir: options.docsDir,
        count: parseInt(options.count),
        locale: options.locale,
        seed: options.seed ? parseInt(options.seed) : undefined,
        format: 'both',
        generateReferences: true
      })
      const documents = await docGenerator.generateFromUrl()
      
      console.log('✅ Everything generated successfully!')
      console.log('\n📋 Summary:')
      console.log(`   📁 Types: ${options.typesDir}`)
      console.log(`   📁 Documents: ${options.docsDir}`)
      console.log(`   📊 Collections: ${Object.keys(documents).length}`)
      
      for (const [collection, docs] of Object.entries(documents)) {
        console.log(`      • ${collection}: ${docs.length} documents`)
      }
    } catch (error) {
      console.error('❌ Failed to generate:', error)
      process.exit(1)
    }
  })

// Version and help
program
  .version('0.1.0')
  .description('Trokky Client CLI - Generate types and test data from schemas')

// Parse arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}