import { defineConfig } from '@trokky/trokky/express'

// Storage adapters register themselves in the adapter registry when their module
// is evaluated. These two imports are side-effect only: without them, creating
// the 'filesystem-data' / 'filesystem-media' adapters throws at startup.
import '@trokky/trokky/adapters/filesystem-data'
import '@trokky/trokky/adapters/filesystem-media'

import { schemas } from './schemas/index.js'
import { validateStructure } from './structure.js'

export const port = Number(process.env.PORT) || 3253

export default defineConfig({
  env: 'development',
  schemas,

  storage: {
    data: {
      adapter: 'filesystem-data',
      options: {
        // Seeded content lives in ./data and is committed. Everything the server
        // generates for itself goes under ./data/system, which is gitignored.
        contentDir: './data',
        usersDir: './data/system/users',
        tokensDir: './data/system/tokens',
        webhooksDir: './data/system/webhooks',
        settingsDir: './data/system/settings',
        auditLogsDir: './data/system/audit-logs',
        createDirs: true,
        prettyJson: true,
      },
    },
    media: {
      adapter: 'filesystem-media',
      options: {
        mediaDir: './media',
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

  server: {
    // Left empty on purpose: the routers are mounted under '/api' by
    // `trokky.mount(app)`, so repeating the prefix here would double it.
    basePath: '',
    port,
  },

  studio: {
    enabled: true,
    path: '/studio',
    requireAuth: true,
    branding: {
      title: 'The Meridian Almanac',
      theme: 'system',
    },
    structure: validateStructure(),
  },
})
