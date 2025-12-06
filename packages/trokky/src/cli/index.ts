#!/usr/bin/env node

import { Command } from 'commander'
import { createRequire } from 'module'
import { backupCommand } from './backup.js'
import { restoreCommand } from './restore.js'
import { migrateCommand } from './migrate.js'
import { cleanCommand } from './clean.js'
import { createCommand } from './create.js'
import { configCommand } from './config.js'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

const program = new Command()

program
  .name('trokky')
  .description('Trokky CMS CLI - Project scaffolding, backup, restore, and migration tools')
  .version(pkg.version)

program.addCommand(createCommand)
program.addCommand(configCommand)
program.addCommand(backupCommand)
program.addCommand(restoreCommand)
program.addCommand(migrateCommand)
program.addCommand(cleanCommand)

program.parse()
