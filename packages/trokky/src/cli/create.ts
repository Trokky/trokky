/**
 * trokky create - Project scaffolding command
 *
 * Creates a new Trokky project with configurable options.
 *
 * Usage:
 *   trokky create my-project
 *   trokky create my-project --template=minimal
 *   trokky create my-project --data=postgres --media=filesystem --mail=resend
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import { select, confirm, text } from '@clack/prompts'

// =============================================================================
// TYPES
// =============================================================================

export type Template = 'minimal' | 'full' | 'api-only'
export type DataAdapter = 'filesystem' | 'postgres' | 'd1'
export type MediaAdapter = 'filesystem' | 'r2' | 's3'
export type MailProvider = 'none' | 'resend' | 'console'
export type AuthMode = 'basic' | 'oauth' | 'none'
export type StudioMode = 'embedded' | 'separate' | 'none'

export interface ProjectConfig {
  name: string
  template: Template
  dataAdapter: DataAdapter
  mediaAdapter: MediaAdapter
  mail: MailProvider
  auth: AuthMode
  studio: StudioMode
  includeExamples: boolean
}

// =============================================================================
// TEMPLATES
// =============================================================================

const TEMPLATES: Record<Template, { description: string; defaults: Partial<ProjectConfig> }> = {
  minimal: {
    description: 'Bare minimum setup - just schemas and storage',
    defaults: {
      dataAdapter: 'filesystem',
      mediaAdapter: 'filesystem',
      mail: 'none',
      auth: 'basic',
      studio: 'embedded',
      includeExamples: false,
    },
  },
  full: {
    description: 'Full-featured setup with all options enabled',
    defaults: {
      dataAdapter: 'postgres',
      mediaAdapter: 'filesystem',
      mail: 'resend',
      auth: 'oauth',
      studio: 'embedded',
      includeExamples: true,
    },
  },
  'api-only': {
    description: 'Headless API without Studio UI',
    defaults: {
      dataAdapter: 'postgres',
      mediaAdapter: 'filesystem',
      mail: 'none',
      auth: 'basic',
      studio: 'none',
      includeExamples: false,
    },
  },
}

// =============================================================================
// INTERACTIVE PROMPTS
// =============================================================================

async function promptForConfig(projectName: string): Promise<ProjectConfig | null> {
  console.log()
  console.log(chalk.bold.cyan('🚀 Create a new Trokky project'))
  console.log()

  // Template selection
  const template = await select({
    message: 'Which template would you like to use?',
    options: [
      { value: 'minimal', label: 'Minimal', hint: TEMPLATES.minimal.description },
      { value: 'full', label: 'Full', hint: TEMPLATES.full.description },
      { value: 'api-only', label: 'API Only', hint: TEMPLATES['api-only'].description },
    ],
  })

  if (typeof template === 'symbol') return null // User cancelled

  const templateDefaults = TEMPLATES[template as Template].defaults

  // Ask if they want to customize
  const customize = await confirm({
    message: 'Would you like to customize the configuration?',
    initialValue: false,
  })

  if (typeof customize === 'symbol') return null

  if (!customize) {
    return {
      name: projectName,
      template: template as Template,
      ...templateDefaults,
    } as ProjectConfig
  }

  // Data adapter
  const dataAdapter = await select({
    message: 'Data storage adapter:',
    initialValue: templateDefaults.dataAdapter,
    options: [
      { value: 'filesystem', label: 'Filesystem', hint: 'JSON files - great for development' },
      { value: 'postgres', label: 'PostgreSQL', hint: 'Production-ready relational database' },
      { value: 'd1', label: 'Cloudflare D1', hint: 'Edge-native SQLite database' },
    ],
  })
  if (typeof dataAdapter === 'symbol') return null

  // Media adapter
  const mediaAdapter = await select({
    message: 'Media storage adapter:',
    initialValue: templateDefaults.mediaAdapter,
    options: [
      { value: 'filesystem', label: 'Filesystem', hint: 'Local file storage' },
      { value: 'r2', label: 'Cloudflare R2', hint: 'S3-compatible object storage' },
      { value: 's3', label: 'AWS S3', hint: 'Amazon S3 bucket' },
    ],
  })
  if (typeof mediaAdapter === 'symbol') return null

  // Mail provider
  const mail = await select({
    message: 'Email provider:',
    initialValue: templateDefaults.mail,
    options: [
      { value: 'none', label: 'None', hint: 'No email functionality' },
      { value: 'resend', label: 'Resend', hint: 'Modern email API' },
      { value: 'console', label: 'Console', hint: 'Log emails to console (dev only)' },
    ],
  })
  if (typeof mail === 'symbol') return null

  // Auth mode
  const auth = await select({
    message: 'Authentication mode:',
    initialValue: templateDefaults.auth,
    options: [
      { value: 'basic', label: 'Basic', hint: 'Username/password authentication' },
      { value: 'oauth', label: 'OAuth', hint: 'Google OAuth integration' },
      { value: 'none', label: 'None', hint: 'No authentication (public API)' },
    ],
  })
  if (typeof auth === 'symbol') return null

  // Studio mode
  const studio = await select({
    message: 'Studio UI:',
    initialValue: templateDefaults.studio,
    options: [
      { value: 'embedded', label: 'Embedded', hint: 'Studio served from same server' },
      { value: 'separate', label: 'Separate', hint: 'Studio as standalone app' },
      { value: 'none', label: 'None', hint: 'No Studio UI (headless)' },
    ],
  })
  if (typeof studio === 'symbol') return null

  // Include examples
  const includeExamples = await confirm({
    message: 'Include example schemas?',
    initialValue: templateDefaults.includeExamples ?? false,
  })
  if (typeof includeExamples === 'symbol') return null

  return {
    name: projectName,
    template: template as Template,
    dataAdapter: dataAdapter as DataAdapter,
    mediaAdapter: mediaAdapter as MediaAdapter,
    mail: mail as MailProvider,
    auth: auth as AuthMode,
    studio: studio as StudioMode,
    includeExamples,
  }
}

// =============================================================================
// FILE GENERATION
// =============================================================================

function generatePackageJson(config: ProjectConfig): string {
  const deps: Record<string, string> = {
    '@trokky/express': '^0.1.14',
    '@trokky/core': '^0.1.14',
    '@trokky/types': '^0.1.0',
    'express': '^4.18.2',
    'dotenv': '^16.3.1',
  }

  // Data adapter
  if (config.dataAdapter === 'filesystem') {
    deps['@trokky/adapter-filesystem-data'] = '^0.1.1'
  } else if (config.dataAdapter === 'postgres') {
    deps['@trokky/adapter-postgres-data'] = '^0.1.9'
  } else if (config.dataAdapter === 'd1') {
    deps['@trokky/adapter-cloudflare-d1'] = '^0.1.0'
  }

  // Media adapter
  if (config.mediaAdapter === 'filesystem') {
    deps['@trokky/adapter-filesystem-media'] = '^0.1.2'
  } else if (config.mediaAdapter === 'r2') {
    deps['@trokky/adapter-cloudflare-r2'] = '^0.1.0'
  } else if (config.mediaAdapter === 's3') {
    deps['@trokky/adapter-s3'] = '^0.1.0'
  }

  // Mail
  if (config.mail === 'resend') {
    deps['@trokky/mail'] = '^0.1.3'
    deps['@trokky/mail-adapter-resend'] = '^0.1.0'
  } else if (config.mail === 'console') {
    deps['@trokky/mail'] = '^0.1.3'
    deps['@trokky/mail-adapter-console'] = '^0.1.0'
  }

  return JSON.stringify({
    name: config.name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'nodemon',
      build: 'tsc',
      start: 'node dist/server.js',
    },
    dependencies: deps,
    devDependencies: {
      '@types/express': '^4.17.21',
      '@types/node': '^20.0.0',
      'typescript': '^5.3.3',
      'tsx': '^4.7.0',
      'nodemon': '^3.0.2',
    },
  }, null, 2)
}

function generateServerTs(config: ProjectConfig): string {
  const imports: string[] = [
    `import dotenv from 'dotenv'`,
    `dotenv.config()`,
    ``,
  ]

  // Adapter imports
  if (config.dataAdapter === 'filesystem') {
    imports.push(`import '@trokky/adapter-filesystem-data'`)
  } else if (config.dataAdapter === 'postgres') {
    imports.push(`import '@trokky/adapter-postgres-data'`)
  } else if (config.dataAdapter === 'd1') {
    imports.push(`import '@trokky/adapter-cloudflare-d1'`)
  }

  if (config.mediaAdapter === 'filesystem') {
    imports.push(`import '@trokky/adapter-filesystem-media'`)
  } else if (config.mediaAdapter === 'r2') {
    imports.push(`import '@trokky/adapter-cloudflare-r2'`)
  } else if (config.mediaAdapter === 's3') {
    imports.push(`import '@trokky/adapter-s3'`)
  }

  imports.push(``)
  imports.push(`import { startServer } from '@trokky/express'`)
  imports.push(`import config from './trokky.config.js'`)

  return `/**
 * ${config.name} - Trokky CMS Server
 */

${imports.join('\n')}

const server = await startServer(config)

const info = server.getInfo()
console.log(\`
${config.name} running
  API: http://localhost:\${info.port}\${info.apiPath}
  ${config.studio !== 'none' ? `Studio: http://localhost:\${info.port}\${info.studioPath}` : ''}
\`)
`
}

function generateTrokkyConfig(config: ProjectConfig): string {
  const schemaImports = config.includeExamples
    ? `import { articleSchema } from './schemas/article.js'\nimport { pageSchema } from './schemas/page.js'`
    : `// import { yourSchema } from './schemas/your-schema.js'`

  const schemas = config.includeExamples
    ? `[articleSchema, pageSchema]`
    : `[\n    // Add your schemas here\n  ]`

  let dataConfig = ''
  if (config.dataAdapter === 'filesystem') {
    dataConfig = `{
      adapter: 'filesystem-data',
      options: {
        contentDir: './data/content',
        usersDir: './data/users',
        createDirs: true,
      },
    }`
  } else if (config.dataAdapter === 'postgres') {
    dataConfig = `{
      adapter: 'postgres-data',
      options: {
        connection: process.env.DATABASE_URL,
        schema: 'public',
        tablePrefix: 'trokky_',
      },
    }`
  } else if (config.dataAdapter === 'd1') {
    dataConfig = `{
      adapter: 'cloudflare-d1',
      options: {
        databaseName: process.env.D1_DATABASE_NAME,
      },
    }`
  }

  let mediaConfig = ''
  if (config.mediaAdapter === 'filesystem') {
    mediaConfig = `{
      adapter: 'filesystem-media',
      options: {
        mediaDir: './data/media',
        createDirs: true,
      },
    }`
  } else if (config.mediaAdapter === 'r2') {
    mediaConfig = `{
      adapter: 'cloudflare-r2',
      options: {
        bucketName: process.env.R2_BUCKET_NAME,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    }`
  } else if (config.mediaAdapter === 's3') {
    mediaConfig = `{
      adapter: 's3',
      options: {
        bucket: process.env.S3_BUCKET,
        region: process.env.AWS_REGION,
      },
    }`
  }

  let mailConfig = ''
  if (config.mail === 'resend') {
    mailConfig = `
  mail: {
    adapter: new ResendMailAdapter({
      apiKey: process.env.RESEND_API_KEY!,
      defaultFrom: process.env.MAIL_FROM || 'noreply@example.com',
    }),
  },`
  } else if (config.mail === 'console') {
    mailConfig = `
  mail: {
    adapter: new ConsoleMailAdapter(),
  },`
  }

  let mailImport = ''
  if (config.mail === 'resend') {
    mailImport = `import { ResendMailAdapter } from '@trokky/mail-adapter-resend'`
  } else if (config.mail === 'console') {
    mailImport = `import { ConsoleMailAdapter } from '@trokky/mail-adapter-console'`
  }

  let oauthConfig = ''
  if (config.auth === 'oauth') {
    oauthConfig = `
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    },
  },`
  }

  let studioConfig = ''
  if (config.studio === 'embedded') {
    studioConfig = `
  studio: {
    enabled: true,
    path: '/studio',
  },`
  } else if (config.studio === 'separate') {
    studioConfig = `
  studio: {
    enabled: false,
    apiUrl: process.env.API_URL,
  },`
  } else {
    studioConfig = `
  studio: {
    enabled: false,
  },`
  }

  return `/**
 * Trokky Configuration
 */

import { defineConfig } from '@trokky/express'
${schemaImports}
${mailImport}

export default defineConfig({
  schemas: ${schemas},

  storage: {
    data: ${dataConfig},
    media: ${mediaConfig},
  },

  security: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    adminUser: {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      firstName: 'Admin',
      lastName: 'User',
    },
  },${oauthConfig}${mailConfig}${studioConfig}
})
`
}

function generateEnvExample(config: ProjectConfig): string {
  const lines = [
    '# Server',
    'PORT=3000',
    'NODE_ENV=development',
    '',
    '# Security',
    'JWT_SECRET=your-secret-key-change-in-production',
    '',
    '# Admin User',
    'ADMIN_USERNAME=admin',
    'ADMIN_EMAIL=admin@example.com',
    'ADMIN_PASSWORD=admin123',
  ]

  if (config.dataAdapter === 'postgres') {
    lines.push('', '# Database', 'DATABASE_URL=postgres://user:password@localhost:5432/trokky')
  }

  if (config.dataAdapter === 'd1') {
    lines.push('', '# Cloudflare D1', 'D1_DATABASE_NAME=your-d1-database')
  }

  if (config.mediaAdapter === 'r2') {
    lines.push(
      '', '# Cloudflare R2',
      'CLOUDFLARE_ACCOUNT_ID=your-account-id',
      'R2_BUCKET_NAME=your-bucket',
      'R2_ACCESS_KEY_ID=your-access-key',
      'R2_SECRET_ACCESS_KEY=your-secret-key'
    )
  }

  if (config.mediaAdapter === 's3') {
    lines.push(
      '', '# AWS S3',
      'AWS_REGION=us-east-1',
      'S3_BUCKET=your-bucket',
      'AWS_ACCESS_KEY_ID=your-access-key',
      'AWS_SECRET_ACCESS_KEY=your-secret-key'
    )
  }

  if (config.mail === 'resend') {
    lines.push('', '# Email (Resend)', 'RESEND_API_KEY=re_xxxxx', 'MAIL_FROM=noreply@example.com')
  }

  if (config.auth === 'oauth') {
    lines.push(
      '', '# OAuth (Google)',
      'GOOGLE_CLIENT_ID=your-client-id',
      'GOOGLE_CLIENT_SECRET=your-client-secret',
      'GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback'
    )
  }

  return lines.join('\n')
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
    },
    include: ['src/**/*', '*.ts'],
    exclude: ['node_modules', 'dist'],
  }, null, 2)
}

function generateNodemonConfig(): string {
  return JSON.stringify({
    watch: ['.'],
    ignore: ['data/**', 'dist/**', '*.log'],
    ext: 'ts,js',
    exec: 'tsx server.ts',
  }, null, 2)
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build
dist/

# Data (local development)
data/

# Environment
.env
.env.local

# Logs
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`
}

function generateNpmrc(): string {
  return `# Trokky packages are hosted on GitHub Packages
@trokky:registry=https://npm.pkg.github.com

# Authentication - set NODE_AUTH_TOKEN environment variable
# Option 1: Export in terminal: export NODE_AUTH_TOKEN=ghp_xxxx
# Option 2: Add to ~/.npmrc: //npm.pkg.github.com/:_authToken=ghp_xxxx
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
`
}

function generateReadme(config: ProjectConfig): string {
  const studioSection = config.studio !== 'none'
    ? `- **Studio**: http://localhost:3000/studio`
    : ''

  return `# ${config.name}

A Trokky CMS project.

## Prerequisites

1. **GitHub Personal Access Token** with \`read:packages\` scope
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a token with \`read:packages\` permission
   - Set it as environment variable:
     \`\`\`bash
     export NODE_AUTH_TOKEN=ghp_your_token_here
     \`\`\`
   - Or add to \`~/.npmrc\`:
     \`\`\`
     //npm.pkg.github.com/:_authToken=ghp_your_token_here
     \`\`\`

${config.dataAdapter === 'postgres' ? `2. **PostgreSQL** database running locally or remotely\n` : ''}
## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env

# Start development server
npm run dev
\`\`\`

## URLs

- **API**: http://localhost:3000/api
${studioSection}
- **Health**: http://localhost:3000/health

## Project Structure

\`\`\`
${config.name}/
├── server.ts           # Server entry point
├── trokky.config.ts    # Trokky configuration
├── schemas/            # Content schemas
${config.dataAdapter === 'filesystem' ? '├── data/               # Local data storage\n' : ''}└── package.json
\`\`\`

## Configuration

- **Data**: ${config.dataAdapter}
- **Media**: ${config.mediaAdapter}
- **Mail**: ${config.mail}
- **Auth**: ${config.auth}
- **Studio**: ${config.studio}

## Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm start\` - Run production server

## Learn More

- [Trokky Documentation](https://github.com/Trokky/trokky)
`
}

function generateExampleSchemas(): { article: string; page: string } {
  const article = `/**
 * Article Schema - Example content type
 */

import type { ContentSchema } from '@trokky/types'

export const articleSchema: ContentSchema = {
  name: 'article',
  title: 'Article',
  type: 'collection',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      required: true,
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
    },
    {
      name: 'content',
      title: 'Content',
      type: 'richtext',
    },
    {
      name: 'featuredImage',
      title: 'Featured Image',
      type: 'media',
      options: { accept: 'image/*' },
    },
    {
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    },
  ],
}
`

  const page = `/**
 * Page Schema - Example content type
 */

import type { ContentSchema } from '@trokky/types'

export const pageSchema: ContentSchema = {
  name: 'page',
  title: 'Page',
  type: 'collection',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      required: true,
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
    },
    {
      name: 'content',
      title: 'Content',
      type: 'richtext',
    },
  ],
}
`

  return { article, page }
}

// =============================================================================
// PROJECT SCAFFOLDING
// =============================================================================

async function scaffoldProject(config: ProjectConfig, targetDir: string): Promise<void> {
  const spinner = ora('Creating project structure...').start()

  try {
    // Create directories
    await fs.ensureDir(targetDir)
    await fs.ensureDir(path.join(targetDir, 'schemas'))

    if (config.dataAdapter === 'filesystem') {
      await fs.ensureDir(path.join(targetDir, 'data', 'content'))
      await fs.ensureDir(path.join(targetDir, 'data', 'users'))
    }

    if (config.mediaAdapter === 'filesystem') {
      await fs.ensureDir(path.join(targetDir, 'data', 'media'))
    }

    spinner.text = 'Writing configuration files...'

    // Write files
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      generatePackageJson(config)
    )

    await fs.writeFile(
      path.join(targetDir, 'server.ts'),
      generateServerTs(config)
    )

    await fs.writeFile(
      path.join(targetDir, 'trokky.config.ts'),
      generateTrokkyConfig(config)
    )

    await fs.writeFile(
      path.join(targetDir, '.env.example'),
      generateEnvExample(config)
    )

    await fs.writeFile(
      path.join(targetDir, 'tsconfig.json'),
      generateTsConfig()
    )

    await fs.writeFile(
      path.join(targetDir, 'nodemon.json'),
      generateNodemonConfig()
    )

    await fs.writeFile(
      path.join(targetDir, '.gitignore'),
      generateGitignore()
    )

    await fs.writeFile(
      path.join(targetDir, '.npmrc'),
      generateNpmrc()
    )

    await fs.writeFile(
      path.join(targetDir, 'README.md'),
      generateReadme(config)
    )

    // Example schemas
    if (config.includeExamples) {
      spinner.text = 'Creating example schemas...'
      const schemas = generateExampleSchemas()
      await fs.writeFile(
        path.join(targetDir, 'schemas', 'article.ts'),
        schemas.article
      )
      await fs.writeFile(
        path.join(targetDir, 'schemas', 'page.ts'),
        schemas.page
      )
    }

    spinner.succeed('Project created successfully!')
  } catch (error) {
    spinner.fail('Failed to create project')
    throw error
  }
}

// =============================================================================
// COMMAND
// =============================================================================

export const createCommand = new Command()
  .name('create')
  .description('Create a new Trokky project')
  .argument('<project-name>', 'Name of the project')
  .option('-t, --template <template>', 'Project template (minimal, full, api-only)')
  .option('--data <adapter>', 'Data adapter (filesystem, postgres, d1)')
  .option('--media <adapter>', 'Media adapter (filesystem, r2, s3)')
  .option('--mail <provider>', 'Mail provider (none, resend, console)')
  .option('--auth <mode>', 'Auth mode (basic, oauth, none)')
  .option('--studio <mode>', 'Studio mode (embedded, separate, none)')
  .option('--examples', 'Include example schemas')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (projectName: string, options) => {
    const targetDir = path.resolve(process.cwd(), projectName)

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
      console.log(chalk.red(`\n❌ Directory "${projectName}" already exists.\n`))
      process.exit(1)
    }

    let config: ProjectConfig | null

    // If --yes or all options provided, skip prompts
    if (options.yes || options.template) {
      const template = (options.template || 'minimal') as Template
      const templateDefaults = TEMPLATES[template]?.defaults || TEMPLATES.minimal.defaults

      config = {
        name: projectName,
        template,
        dataAdapter: (options.data || templateDefaults.dataAdapter) as DataAdapter,
        mediaAdapter: (options.media || templateDefaults.mediaAdapter) as MediaAdapter,
        mail: (options.mail || templateDefaults.mail) as MailProvider,
        auth: (options.auth || templateDefaults.auth) as AuthMode,
        studio: (options.studio || templateDefaults.studio) as StudioMode,
        includeExamples: options.examples ?? templateDefaults.includeExamples ?? false,
      }
    } else {
      // Interactive mode
      config = await promptForConfig(projectName)
    }

    if (!config) {
      console.log(chalk.yellow('\n👋 Project creation cancelled.\n'))
      process.exit(0)
    }

    console.log()
    console.log(chalk.bold('Creating project with:'))
    console.log(chalk.gray(`  Template:     ${config.template}`))
    console.log(chalk.gray(`  Data:         ${config.dataAdapter}`))
    console.log(chalk.gray(`  Media:        ${config.mediaAdapter}`))
    console.log(chalk.gray(`  Mail:         ${config.mail}`))
    console.log(chalk.gray(`  Auth:         ${config.auth}`))
    console.log(chalk.gray(`  Studio:       ${config.studio}`))
    console.log(chalk.gray(`  Examples:     ${config.includeExamples ? 'yes' : 'no'}`))
    console.log()

    await scaffoldProject(config, targetDir)

    // Success message
    console.log()
    console.log(chalk.green.bold('✅ Project created successfully!'))
    console.log()

    // Check for NODE_AUTH_TOKEN
    const hasAuthToken = !!process.env.NODE_AUTH_TOKEN
    if (!hasAuthToken) {
      console.log(chalk.yellow.bold('⚠️  GitHub Packages authentication required'))
      console.log()
      console.log(chalk.yellow('  Trokky packages are hosted on GitHub Packages.'))
      console.log(chalk.yellow('  Before running npm install, set your token:'))
      console.log()
      console.log(chalk.white('  Option 1: Export in terminal (temporary)'))
      console.log(chalk.cyan('    export NODE_AUTH_TOKEN=ghp_your_token'))
      console.log()
      console.log(chalk.white('  Option 2: Add to ~/.npmrc (permanent)'))
      console.log(chalk.cyan('    echo "//npm.pkg.github.com/:_authToken=ghp_your_token" >> ~/.npmrc'))
      console.log()
      console.log(chalk.gray('  Get a token: GitHub → Settings → Developer settings → Personal access tokens'))
      console.log(chalk.gray('  Required scope: read:packages'))
      console.log()
    }

    console.log('Next steps:')
    console.log(chalk.cyan(`  cd ${projectName}`))
    console.log(chalk.cyan('  cp .env.example .env'))
    if (!hasAuthToken) {
      console.log(chalk.cyan('  export NODE_AUTH_TOKEN=ghp_xxx  # if not already set'))
    }
    console.log(chalk.cyan('  npm install'))
    console.log(chalk.cyan('  npm run dev'))
    console.log()
  })
