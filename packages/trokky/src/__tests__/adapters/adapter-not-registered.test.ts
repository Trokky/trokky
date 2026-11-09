/**
 * What a site sees when its configured adapter was never imported. Kept in its own file: the
 * adapter registry is module-global, and another test importing postgres-data would register it.
 */
import { describe, it, expect } from 'vitest'
import { TrokkyExpress } from '../../integrations/express/index.js'
import '../../adapters/filesystem-media/index.js'

const config = (data: string, media = 'filesystem-media') =>
  ({
    schemas: [{ name: 'post', type: 'document', fields: { title: { type: 'string' } } }],
    storage: { data: { adapter: data, options: {} }, media: { adapter: media, options: { mediaDir: '/nonexistent-trokky-test' } } },
  }) as never

describe('TrokkyExpress.create with an adapter that was never imported', () => {
  it('should name the import, and nothing that contradicts it', async () => {
    const boot = TrokkyExpress.create(config('postgres-data'))
    await expect(boot).rejects.toThrow("import '@trokky/trokky/adapters/postgres-data'")
    await expect(boot).rejects.not.toThrow(/@trokky\/adapter-|dynamodb|installed/)
  })

  it('should say when a media adapter is configured as the data adapter', async () => {
    await expect(TrokkyExpress.create(config('filesystem-media'))).rejects.toThrow(
      '"filesystem-media" is a media adapter: it belongs under storage.media'
    )
  })
})
