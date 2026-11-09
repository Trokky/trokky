/**
 * A create that names an existing id replaces that document (this is how `trokky restore
 * --preserve-ids` writes). Its own slug must not count as taken, or the replaced document comes
 * back as "p1-2" and its URL breaks.
 */
import { describe, it, expect } from 'vitest'
import { createTestRoutes, createAuthenticatedUser, createMockRequest, executeRoute } from '../helpers/test-helpers.js'
import type { ContentSchema } from '../../core/types/index.js'

const schemas = [
  {
    name: 'posts',
    type: 'document',
    fields: { title: { type: 'string' }, slug: { type: 'slug', source: 'title', unique: true } },
  },
] as unknown as ContentSchema[]

async function setup() {
  const { routes, core } = await createTestRoutes({ schemas })
  const { token } = await createAuthenticatedUser(core, { role: 'admin' })
  const create = async (body: Record<string, unknown>) => {
    const response = await executeRoute(
      routes,
      createMockRequest({
        method: 'POST',
        path: '/api/collections/posts',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      })
    )
    expect(response.status).toBe(201)
    return (response.body as { data: { document: { id: string; slug: string } } }).data.document
  }
  return { create }
}

describe('POST /collections/:collection with an id', () => {
  it('should keep the slug of the document it replaces', async () => {
    const { create } = await setup()
    await create({ id: 'p1', data: { title: 'First', slug: 'first' } })
    const replaced = await create({ id: 'p1', data: { title: 'First', slug: 'first' } })
    expect(replaced).toMatchObject({ id: 'p1', slug: 'first' })
  })

  it('should still refuse another document the same slug', async () => {
    const { create } = await setup()
    await create({ id: 'p1', data: { title: 'First', slug: 'first' } })
    const other = await create({ id: 'p2', data: { title: 'First', slug: 'first' } })
    expect(other.id).toBe('p2')
    expect(other.slug).not.toBe('first')
  })
})
