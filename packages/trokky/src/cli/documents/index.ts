/**
 * Documents command for Trokky CLI
 * Quick content CRUD operations from the command line
 *
 * Usage:
 *   trokky documents list <collection> [options]
 *   trokky documents get <collection> <id> [options]
 *   trokky documents create <collection> [file] [options]
 *   trokky documents update <collection> <id> [file] [options]
 *   trokky documents delete <collection> <id> [...ids] [options]
 */

import { Command } from 'commander'
import { listCommand } from './list.js'
import { getCommand } from './get.js'
import { createCommand } from './create.js'
import { updateCommand } from './update.js'
import { deleteCommand } from './delete.js'

export const documentsCommand = new Command('documents')
  .alias('docs')
  .description('Document CRUD operations for quick content management')
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
