#!/usr/bin/env node

/**
 * Migration script to convert documents from using 'published' field to '_status' field
 * 
 * This script helps migrate existing documents to use the standardized _status field
 * instead of the legacy published boolean field.
 * 
 * Usage:
 *   node scripts/migrate-status-fields.js [--dry-run] [--collection=<name>]
 * 
 * Options:
 *   --dry-run     Show what would be changed without making actual changes
 *   --collection  Only migrate documents in the specified collection
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONTENT_DIR = './examples/demo/data/content';
const DRY_RUN = process.argv.includes('--dry-run');
const COLLECTION_FILTER = process.argv.find(arg => arg.startsWith('--collection='))?.split('=')[1];

console.log('🔧 Status Field Migration Tool');
console.log('================================');
console.log(`Content directory: ${CONTENT_DIR}`);
console.log(`Dry run mode: ${DRY_RUN ? 'ON' : 'OFF'}`);
if (COLLECTION_FILTER) {
  console.log(`Collection filter: ${COLLECTION_FILTER}`);
}
console.log('');

let totalFiles = 0;
let migratedFiles = 0;
let skippedFiles = 0;
let errorFiles = 0;

/**
 * Convert published field to _status field
 */
function migrateDocument(fileData) {
  let hasChanges = false;
  const changes = [];
  
  // Handle nested structure used by filesystem adapter
  const documentData = fileData.data || fileData;

  // Check if document has published field but no _status field
  if (documentData.hasOwnProperty('published') && !documentData._status) {
    // Convert published boolean to _status string
    documentData._status = documentData.published ? 'published' : 'draft';
    hasChanges = true;
    changes.push(`Added _status: "${documentData._status}"`);
    
    // Remove the published field
    delete documentData.published;
    changes.push('Removed published field');
  }

  // Check if document has _state field (legacy frontend field)
  if (documentData.hasOwnProperty('_state')) {
    if (!documentData._status) {
      // Convert _state to _status
      documentData._status = documentData._state;
      hasChanges = true;
      changes.push(`Converted _state to _status: "${documentData._status}"`);
    }
    
    // Always remove the _state field as it's legacy
    delete documentData._state;
    hasChanges = true;
    changes.push('Removed legacy _state field');
  }

  // Ensure _status exists and has a valid value
  if (!documentData._status) {
    documentData._status = 'draft';
    hasChanges = true;
    changes.push('Added default _status: "draft"');
  }

  // Validate _status value
  const validStatuses = ['draft', 'published', 'archived'];
  if (!validStatuses.includes(documentData._status)) {
    console.warn(`  Warning: Invalid _status value "${documentData._status}", setting to "draft"`);
    documentData._status = 'draft';
    hasChanges = true;
    changes.push('Fixed invalid _status value to "draft"');
  }

  return { hasChanges, changes, documentData: fileData };
}

/**
 * Process a single document file
 */
function processFile(filePath, relativePath) {
  totalFiles++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const documentData = JSON.parse(content);
    
    // Check collection filter
    const collection = documentData.collection || (documentData.data && documentData.data._collection);
    if (COLLECTION_FILTER && collection !== COLLECTION_FILTER) {
      skippedFiles++;
      return;
    }
    
    const { hasChanges, changes, documentData: migratedData } = migrateDocument(documentData);
    
    if (hasChanges) {
      console.log(`📝 ${relativePath}`);
      changes.forEach(change => console.log(`  ✓ ${change}`));
      
      if (!DRY_RUN) {
        // Update the _updatedAt field
        migratedData._updatedAt = new Date().toISOString();
        
        // Write the migrated document back to file
        const migratedContent = JSON.stringify(migratedData, null, 2);
        fs.writeFileSync(filePath, migratedContent, 'utf8');
        console.log(`  ✅ File updated`);
      } else {
        console.log(`  🔍 Would be updated (dry run mode)`);
      }
      
      migratedFiles++;
    } else {
      console.log(`✅ ${relativePath} - Already using _status field`);
      skippedFiles++;
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${relativePath}:`, error.message);
    errorFiles++;
  }
  
  console.log('');
}

/**
 * Recursively process all JSON files in a directory
 */
function processDirectory(dirPath, baseDir = dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.error(`❌ Content directory not found: ${dirPath}`);
    console.log('Make sure you\'re running this script from the project root directory.');
    process.exit(1);
  }
  
  const entries = fs.readdirSync(dirPath);
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(baseDir, fullPath);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath, baseDir);
    } else if (stat.isFile() && entry.endsWith('.json')) {
      processFile(fullPath, relativePath);
    }
  }
}

// Main execution
console.log('🚀 Starting migration...\n');

const startTime = Date.now();
processDirectory(CONTENT_DIR);
const endTime = Date.now();

// Summary
console.log('Migration Summary');
console.log('=================');
console.log(`Total files processed: ${totalFiles}`);
console.log(`Files migrated: ${migratedFiles}`);
console.log(`Files skipped: ${skippedFiles}`);
console.log(`Files with errors: ${errorFiles}`);
console.log(`Time taken: ${endTime - startTime}ms`);

if (DRY_RUN && migratedFiles > 0) {
  console.log('');
  console.log('💡 This was a dry run. To apply changes, run:');
  console.log(`   node scripts/migrate-status-fields.js${COLLECTION_FILTER ? ` --collection=${COLLECTION_FILTER}` : ''}`);
}

if (errorFiles > 0) {
  console.log('');
  console.log('⚠️  Some files had errors. Please review the output above.');
  process.exit(1);
}

console.log('');
console.log('✅ Migration completed successfully!');