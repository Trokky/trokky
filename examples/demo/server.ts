import express from 'express'
import { TrokkyExpress } from '@trokky/trokky/express'

import config, { port } from './trokky.config.js'

async function main(): Promise<void> {
  const app = express()

  // `create()` builds the core, the storage adapters and the routers;
  // `mount()` attaches the API, the static routes and the Studio to the app.
  const trokky = await TrokkyExpress.create(config)
  await trokky.mount(app)

  const { apiPath, studioPath } = trokky.getMountedPaths()

  app.listen(port, () => {
    console.log('')
    console.log('  The Meridian Almanac is running.')
    console.log(`  API     http://localhost:${port}${apiPath}`)
    console.log(`  Studio  http://localhost:${port}${studioPath}`)
    console.log('')
  })
}

main().catch(error => {
  console.error('Failed to start The Meridian Almanac:', error)
  process.exit(1)
})
