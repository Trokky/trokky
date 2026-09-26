import { defineConfig } from '@trokky/trokky/express'

// Storage adapters register themselves in the adapter registry when their module
// is evaluated. These two imports are side-effect only: without them, creating
// the 'filesystem-data' / 'filesystem-media' adapters throws at startup.
import '@trokky/trokky/adapters/filesystem-data'
import '@trokky/trokky/adapters/filesystem-media'

import { schemas } from './schemas/index.js'
import { validateStructure } from './structure.js'

export const port = Number(process.env.PORT) || 3253

// Where content, users and media live. Defaults to the committed seed in ./data; point a second
// instance elsewhere (a copy of ./data) to run two sites side by side, e.g. to try the MCP
// server's multi-site sign-in.
const dataDir = process.env.TROKKY_DEMO_DATA || './data'
const mediaDir = process.env.TROKKY_DEMO_MEDIA || './media'

export default defineConfig({
  env: 'development',
  schemas,

  storage: {
    data: {
      adapter: 'filesystem-data',
      options: {
        // Seeded content lives in ./data and is committed. Everything the server
        // generates for itself goes under ./data/system, which is gitignored.
        contentDir: dataDir,
        usersDir: `${dataDir}/system/users`,
        tokensDir: `${dataDir}/system/tokens`,
        webhooksDir: `${dataDir}/system/webhooks`,
        settingsDir: `${dataDir}/system/settings`,
        auditLogsDir: `${dataDir}/system/audit-logs`,
        authFlowStateDir: `${dataDir}/system/auth-flow-state`,
        createDirs: true,
        prettyJson: true,
      },
    },
    media: {
      adapter: 'filesystem-media',
      options: {
        mediaDir,
        createDirs: true,
      },
    },
  },

  media: {
    processor: 'none',
    serving: { mode: 'api' },
  },

  security: {
    enabled: true,
    // Development secret so `npm run dev` works with no setup. MUST be
    // overridden with a real, high-entropy TROKKY_JWT_SECRET in production —
    // anyone who knows this string can mint tokens for this instance.
    jwtSecret: process.env.TROKKY_JWT_SECRET || 'meridian-almanac-dev-secret-do-not-use-in-production',
    // Created on first boot if it does not already exist, so the Studio is
    // reachable immediately. The generated user file lands in
    // ./data/system/users, which is gitignored.
    adminUser: {
      username: process.env.TROKKY_ADMIN_USERNAME || 'editor',
      email: process.env.TROKKY_ADMIN_EMAIL || 'editor@meridian-almanac.example',
      password: process.env.TROKKY_ADMIN_PASSWORD || 'almanac-dev-password',
      firstName: 'Almanac',
      lastName: 'Editor',
      role: 'admin',
    },
  },

  // Sign-in for applications: the Trokky CLI (`trokky login`) and the MCP server
  // (`add_site`) use the device flow, approved on Studio's /auth/device page.
  oauth2: {
    enabled: true,
    issuer: `http://localhost:${port}/api`,
    verificationUri: `http://localhost:${port}/studio/auth/device`,
  },

  server: {
    // Left empty on purpose: the routers are mounted under '/api' by
    // `trokky.mount(app)`, so repeating the prefix here would double it.
    basePath: '',
    port,
  },

  structure: validateStructure(),
  studio: {
    branding: {
      title: 'The Meridian Almanac',
      theme: 'system',
    },
  },
})
