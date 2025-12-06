/**
 * Config command for Trokky CLI
 * Manages Trokky instance configurations stored in ~/.trokky/config.yaml
 */

import { Command } from 'commander'
import chalk from 'chalk'
import * as prompts from '@clack/prompts'
import {
  addInstance,
  removeInstance,
  listInstances,
  setDefaultInstance,
  getConfigPath,
  maskToken,
  configExists
} from './config-manager.js'

/**
 * Add a new instance configuration
 */
const addCommand = new Command('add')
  .description('Add a new Trokky instance configuration')
  .argument('<name>', 'Name for this instance (e.g., production, staging, local)')
  .option('--url <url>', 'Trokky instance URL')
  .option('--token <token>', 'Authentication token')
  .option('--description <text>', 'Description for this instance')
  .option('--default', 'Set as the default instance')
  .action(async (name: string, options) => {
    let url = options.url
    let token = options.token
    const description = options.description

    // Interactive prompts if not provided
    if (!url || !token) {
      console.log(chalk.bold(`\nConfiguring instance: ${chalk.cyan(name)}\n`))

      if (!url) {
        const urlInput = await prompts.text({
          message: 'Trokky instance URL',
          placeholder: 'https://cms.example.com/api',
          validate: (value) => {
            if (!value) return 'URL is required'
            try {
              new URL(value)
              return undefined
            } catch {
              return 'Please enter a valid URL'
            }
          }
        })

        if (prompts.isCancel(urlInput)) {
          console.log(chalk.yellow('Cancelled'))
          process.exit(0)
        }
        url = urlInput as string
      }

      if (!token) {
        const tokenInput = await prompts.password({
          message: 'Authentication token',
          validate: (value) => {
            if (!value) return 'Token is required'
            return undefined
          }
        })

        if (prompts.isCancel(tokenInput)) {
          console.log(chalk.yellow('Cancelled'))
          process.exit(0)
        }
        token = tokenInput as string
      }
    }

    try {
      await addInstance(
        name,
        { url, token, description },
        options.default
      )

      console.log(chalk.green(`\n✓ Instance '${name}' added successfully`))
      console.log(chalk.gray(`  URL: ${url}`))
      console.log(chalk.gray(`  Token: ${maskToken(token)}`))
      if (options.default) {
        console.log(chalk.gray(`  Set as default`))
      }
      console.log(chalk.gray(`\n  Config saved to: ${getConfigPath()}`))
    } catch (error: any) {
      console.error(chalk.red(`\nFailed to add instance: ${error.message}`))
      process.exit(1)
    }
  })

/**
 * Remove an instance configuration
 */
const removeCommand = new Command('remove')
  .description('Remove a Trokky instance configuration')
  .argument('<name>', 'Name of the instance to remove')
  .option('--force', 'Skip confirmation prompt')
  .action(async (name: string, options) => {
    if (!options.force) {
      const confirm = await prompts.confirm({
        message: `Remove instance '${name}'?`
      })

      if (prompts.isCancel(confirm) || !confirm) {
        console.log(chalk.yellow('Cancelled'))
        process.exit(0)
      }
    }

    const removed = await removeInstance(name)

    if (removed) {
      console.log(chalk.green(`✓ Instance '${name}' removed`))
    } else {
      console.log(chalk.yellow(`Instance '${name}' not found`))
      process.exit(1)
    }
  })

/**
 * List all configured instances
 */
const listCommand = new Command('list')
  .description('List all configured Trokky instances')
  .alias('ls')
  .action(async () => {
    const { instances, defaultInstance } = await listInstances()
    const names = Object.keys(instances)

    if (names.length === 0) {
      console.log(chalk.yellow('\nNo instances configured yet.'))
      console.log(chalk.gray('Run `trokky config add <name>` to add one.\n'))
      return
    }

    console.log(chalk.bold('\nConfigured Instances\n'))

    for (const name of names) {
      const instance = instances[name]
      const isDefault = name === defaultInstance
      const marker = isDefault ? chalk.green('*') : ' '

      console.log(`  ${marker} ${chalk.cyan(name)}`)
      console.log(chalk.gray(`      URL:   ${instance.url}`))
      console.log(chalk.gray(`      Token: ${maskToken(instance.token)}`))
      if (instance.description) {
        console.log(chalk.gray(`      Desc:  ${instance.description}`))
      }
      console.log()
    }

    if (defaultInstance) {
      console.log(chalk.gray(`  * = default instance`))
    }
    console.log()
  })

/**
 * Set the default instance
 */
const useCommand = new Command('use')
  .description('Set the default Trokky instance')
  .argument('<name>', 'Name of the instance to use as default')
  .action(async (name: string) => {
    const success = await setDefaultInstance(name)

    if (success) {
      console.log(chalk.green(`✓ Now using '${name}' as default`))
    } else {
      console.log(chalk.red(`Instance '${name}' not found`))
      console.log(chalk.gray('Run `trokky config list` to see available instances.'))
      process.exit(1)
    }
  })

/**
 * Show config file path
 */
const pathCommand = new Command('path')
  .description('Show the config file path')
  .action(() => {
    const path = getConfigPath()
    const exists = configExists()

    console.log(chalk.bold('\nConfig File Location\n'))
    console.log(`  ${path}`)
    console.log(chalk.gray(`  Status: ${exists ? 'exists' : 'not created yet'}`))
    console.log()
  })

/**
 * Main config command group
 */
export const configCommand = new Command('config')
  .description('Manage Trokky instance configurations')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listCommand)
  .addCommand(useCommand)
  .addCommand(pathCommand)
