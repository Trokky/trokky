/**
 * Trokky Developer Tools
 *
 * Hidden commands for Trokky core developers.
 * Only available when TROKKY_DEV_MODE=1 environment variable is set.
 */

import { Command } from 'commander'
import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Colors for output
const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
}

/**
 * Get the Trokky source path
 * Tries to find it from the CLI's own location or env var
 */
function getTrokkySourcePath(): string {
  // First check environment variable
  if (process.env.TROKKY_DEV_PATH) {
    return process.env.TROKKY_DEV_PATH
  }

  // Try to find from CLI's location (if running from source)
  // CLI is at packages/trokky/src/cli, so monorepo root is 4 levels up
  const possibleRoot = join(__dirname, '..', '..', '..', '..')
  const turboJsonPath = join(possibleRoot, 'turbo.json')

  if (existsSync(turboJsonPath)) {
    return possibleRoot
  }

  // Default fallback
  return '/Users/amen/Projects/Perso/trokky/trokky'
}

/**
 * Get package path within Trokky monorepo
 */
function getPackagePath(trokkyPath: string, pkgName: string): string | null {
  const mappings: Record<string, string> = {
    'core': 'packages/core',
    'fields': 'packages/fields',
    'studio': 'packages/studio',
    'routes': 'packages/routes',
    'structure': 'packages/structure',
    'client': 'packages/client',
    'trokky': 'packages/trokky',
    'mail': 'packages/mail',
    'types': 'packages/types',
    'express': 'packages/integrations/express',
    'adapter-filesystem': 'packages/adapters/filesystem',
    'adapter-filesystem-data': 'packages/adapters/filesystem-data',
    'adapter-filesystem-media': 'packages/adapters/filesystem-media',
    'adapter-postgres-data': 'packages/adapters/postgres-data',
    'mail-adapter-console': 'packages/mail-adapters/console',
    'mail-adapter-resend': 'packages/mail-adapters/resend',
    'mail-adapter-smtp': 'packages/mail-adapters/smtp',
  }

  const relativePath = mappings[pkgName]
  if (!relativePath) return null

  const fullPath = join(trokkyPath, relativePath)
  return existsSync(fullPath) ? fullPath : null
}

/**
 * Find @trokky packages in a project's package.json
 */
function findTrokkyPackages(projectPath: string): string[] {
  const pkgJsonPath = join(projectPath, 'package.json')
  if (!existsSync(pkgJsonPath)) {
    return []
  }

  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) }
    return Object.keys(deps).filter(d => d.startsWith('@trokky/'))
  } catch {
    return []
  }
}

/**
 * Run a command and stream output
 */
function runCommand(cmd: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, { shell: true, cwd, stdio: 'inherit' })
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with code ${code}`))
    })
  })
}

export const devCommand = new Command('dev')
  .description('Developer tools for Trokky core development')
  .addHelpText('before', colors.dim('(Only available when TROKKY_DEV_MODE=1)\n'))

// trokky dev link
devCommand
  .command('link')
  .description('Link local Trokky packages to a project')
  .argument('[project]', 'Project path (defaults to current directory)')
  .option('-p, --packages <packages...>', 'Specific packages to link')
  .option('--skip-build', 'Skip building packages before linking')
  .action(async (project: string | undefined, options: { packages?: string[], skipBuild?: boolean }) => {
    const projectPath = project || process.cwd()
    const trokkyPath = getTrokkySourcePath()

    console.log(colors.blue('Trokky Dev: Link'))
    console.log('')
    console.log(`Project: ${projectPath}`)
    console.log(`Trokky source: ${trokkyPath}`)
    console.log('')

    // Check if project has custom link script
    const customScript = join(projectPath, 'scripts', 'link-trokky-v3.sh')
    if (existsSync(customScript)) {
      console.log(colors.dim('Found custom link script, using it...'))
      console.log('')
      try {
        await runCommand(`TROKKY_PATH="${trokkyPath}" "${customScript}"`, projectPath)
      } catch (err) {
        console.error(colors.red('Link failed'))
        process.exit(1)
      }
      return
    }

    // Find packages to link
    let packages = options.packages?.map(p => p.startsWith('@trokky/') ? p : `@trokky/${p}`)
    if (!packages || packages.length === 0) {
      packages = findTrokkyPackages(projectPath)
    }

    if (packages.length === 0) {
      console.error(colors.red('No @trokky packages found in project'))
      process.exit(1)
    }

    console.log(`Packages to link: ${packages.join(', ')}`)
    console.log('')

    // Build packages first
    if (!options.skipBuild) {
      console.log(colors.yellow('Building Trokky packages...'))
      try {
        await runCommand('npm run build', trokkyPath)
        console.log(colors.green('Build complete'))
        console.log('')
      } catch (err) {
        console.error(colors.red('Build failed'))
        process.exit(1)
      }
    }

    // Create global links
    console.log(colors.yellow('Creating npm links...'))
    for (const pkg of packages) {
      const pkgName = pkg.replace('@trokky/', '')
      const pkgPath = getPackagePath(trokkyPath, pkgName)

      if (pkgPath) {
        try {
          execSync('npm link', { cwd: pkgPath, stdio: 'pipe' })
          console.log(`  ${colors.green('✓')} ${pkg}`)
        } catch {
          console.log(`  ${colors.red('✗')} ${pkg} (failed)`)
        }
      } else {
        console.log(`  ${colors.yellow('?')} ${pkg} (not found)`)
      }
    }
    console.log('')

    // Link in project
    console.log(colors.yellow('Linking in project...'))
    try {
      execSync(`npm link ${packages.join(' ')}`, { cwd: projectPath, stdio: 'pipe' })
      console.log(colors.green('Done!'))
    } catch (err) {
      console.error(colors.red('Failed to link packages in project'))
      process.exit(1)
    }

    console.log('')
    console.log(colors.green('Trokky packages linked successfully!'))
    console.log('')
    console.log(colors.dim('To rebuild after changes:'))
    console.log(colors.dim('  trokky dev rebuild'))
    console.log('')
    console.log(colors.dim('To restore published versions:'))
    console.log(colors.dim('  trokky dev unlink'))
  })

// trokky dev unlink
devCommand
  .command('unlink')
  .description('Restore published Trokky packages in a project')
  .argument('[project]', 'Project path (defaults to current directory)')
  .action(async (project: string | undefined) => {
    const projectPath = project || process.cwd()
    const trokkyPath = getTrokkySourcePath()

    console.log(colors.blue('Trokky Dev: Unlink'))
    console.log('')
    console.log(`Project: ${projectPath}`)
    console.log('')

    // Check if project has custom unlink script
    const customScript = join(projectPath, 'scripts', 'unlink-trokky-v3.sh')
    if (existsSync(customScript)) {
      console.log(colors.dim('Found custom unlink script, using it...'))
      console.log('')
      try {
        await runCommand(`TROKKY_PATH="${trokkyPath}" "${customScript}"`, projectPath)
      } catch (err) {
        console.error(colors.red('Unlink failed'))
        process.exit(1)
      }
      return
    }

    // Find packages to unlink
    const packages = findTrokkyPackages(projectPath)

    if (packages.length === 0) {
      console.error(colors.red('No @trokky packages found in project'))
      process.exit(1)
    }

    console.log(`Packages to restore: ${packages.join(', ')}`)
    console.log('')

    // Unlink and reinstall
    console.log(colors.yellow('Restoring published versions...'))
    try {
      execSync(`npm unlink ${packages.join(' ')}`, { cwd: projectPath, stdio: 'pipe' })
      await runCommand('npm install', projectPath)
      console.log('')
      console.log(colors.green('Done! Trokky packages restored to published versions.'))
    } catch (err) {
      console.error(colors.red('Failed to restore packages'))
      process.exit(1)
    }
  })

// trokky dev rebuild
devCommand
  .command('rebuild')
  .description('Rebuild Trokky packages')
  .argument('[packages...]', 'Specific packages to rebuild (defaults to all)')
  .action(async (packages: string[]) => {
    const trokkyPath = getTrokkySourcePath()

    console.log(colors.blue('Trokky Dev: Rebuild'))
    console.log('')
    console.log(`Trokky source: ${trokkyPath}`)
    console.log('')

    if (packages.length === 0) {
      console.log(colors.yellow('Building all packages...'))
      try {
        await runCommand('npm run build', trokkyPath)
        console.log('')
        console.log(colors.green('Done!'))
      } catch (err) {
        console.error(colors.red('Build failed'))
        process.exit(1)
      }
    } else {
      for (const pkg of packages) {
        const pkgName = pkg.startsWith('@trokky/') ? pkg : `@trokky/${pkg}`
        console.log(colors.yellow(`Building ${pkgName}...`))
        try {
          await runCommand(`npm run build --workspace="${pkgName}"`, trokkyPath)
          console.log(colors.green(`  ✓ ${pkgName}`))
        } catch (err) {
          console.error(colors.red(`  ✗ ${pkgName} failed`))
        }
      }
      console.log('')
      console.log(colors.green('Done!'))
    }
  })

// trokky dev status
devCommand
  .command('status')
  .description('Check which Trokky packages are linked in a project')
  .argument('[project]', 'Project path (defaults to current directory)')
  .action((project: string | undefined) => {
    const projectPath = project || process.cwd()

    console.log(colors.blue('Trokky Dev: Status'))
    console.log('')
    console.log(`Project: ${projectPath}`)
    console.log('')

    const packages = findTrokkyPackages(projectPath)

    if (packages.length === 0) {
      console.log(colors.yellow('No @trokky packages found in project'))
      return
    }

    console.log('Package Status:')
    try {
      const output = execSync(`npm ls ${packages.join(' ')} --depth=0`, {
        cwd: projectPath,
        encoding: 'utf-8'
      })

      for (const pkg of packages) {
        const isLinked = output.includes(`${pkg}`) && output.includes(' -> ')
        const pkgLine = output.split('\n').find(l => l.includes(pkg))

        if (isLinked) {
          console.log(`  ${colors.green('●')} ${pkg} ${colors.dim('(linked)')}`)
        } else {
          const version = pkgLine?.match(/@[\d.]+/)?.[0] || ''
          console.log(`  ${colors.blue('●')} ${pkg}${version} ${colors.dim('(npm)')}`)
        }
      }
    } catch {
      console.log(colors.red('Failed to check package status'))
    }
  })
