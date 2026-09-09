/**
 * End-to-end guard for the media field's value reaching the save request.
 *
 * Mounts the real DocumentEditor with the real store, form, media browser and
 * payload builder; only the HTTP client and permissions are mocked. Written
 * after a report that a selected image saved as null, which this proved was not
 * happening. Kept so a future refactor of the editor, the store or the payload
 * builder cannot silently drop a media selection.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import React from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mediaItem = {
  id: 'media-1',
  filename: 'a.png',
  contentType: 'image/png',
  size: 1234,
  url: '/media/media-1',
  metadata: {},
}

const schema = {
  name: 'article',
  title: 'Article',
  type: 'document',
  // record form, exactly as the server's normalizeSchemaFields emits it
  fields: {
    title: { title: 'Title', type: 'string', required: true },
    slug: { title: 'Slug', type: 'slug', options: { source: 'title' } },
    featuredImage: { title: 'Featured Image', type: 'media', options: { accept: 'image/*' } },
    publishedAt: { title: 'Published At', type: 'datetime' },
  },
}

export const captured: any = { update: null }

vi.mock('@/services/api-client', async () => {
  const actual: any = await vi.importActual('@/services/api-client')
  const client = {
    initialize: () => {},
    isInitialized: true,
    getSchema: vi.fn(async () => ({ success: true, data: { schema } })),
    getDocument: vi.fn(async () => ({
      success: true,
      data: { document: { _id: 'a1', id: 'a1', _type: 'article', _status: 'draft', title: 'Hello', slug: 'hello', featuredImage: null, publishedAt: null } },
    })),
    updateDocument: vi.fn(async (_s: string, _id: string, data: any) => {
      ;(globalThis as any).__payload = data
      return { success: true, data: { document: { ...data, _id: 'a1', id: 'a1' } } }
    }),
    createDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getDocuments: vi.fn(async () => ({ success: true, data: { documents: [], total: 0 } })),
    getMedia: vi.fn(async () => ({ success: true, data: [mediaItem] })),
    getMediaFile: vi.fn(async () => ({ success: true, data: { file: mediaItem } })),
    getMediaById: vi.fn(async () => ({ success: true, data: { file: mediaItem } })),
    getMediaUrl: (ref: string, variant?: string) => `/media/${ref}${variant ? '/' + variant : ''}`,
    uploadMedia: vi.fn(),
    deleteMedia: vi.fn(),
    updateMedia: vi.fn(),
    getSchemas: vi.fn(async () => ({ success: true, data: [] })),
    get: vi.fn(async () => ({ success: false, data: null })),
    post: vi.fn(async () => ({ success: false, data: null })),
  }
  return { ...actual, apiClient: client, default: client }
})

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    loading: false,
    isAdmin: true,
    userPermissions: ['*'],
    hasSchemaPermission: () => true,
    hasPermission: () => true,
    hasGlobalPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    hasAnySchemaPermission: () => true,
    canDeleteDocument: () => true,
    canPublish: true,
    user: { id: 'u1', role: 'admin', username: 'admin' },
    userId: 'u1',
    error: null,
    refetch: () => {},
    isEditor: false, isAuthor: false, isWriter: false, isViewer: false,
  }),
}))

vi.mock('@/hooks/useStructureContextSidebar', () => ({
  useStructureContextSidebar: () => {},
}))

import { StudioContextProvider } from '@/contexts/StudioContext'
import { DocumentEditor } from '../components/document/DocumentEditor'

function Harness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <React.StrictMode>
    <QueryClientProvider client={qc}>
      <StudioContextProvider>
        <RouterProvider router={createMemoryRouter([
          { path: '/content/article/:documentId', element: <DocumentEditor schemaName="article" documentId="a1" /> },
        ], { initialEntries: ['/content/article/a1'] })} />
      </StudioContextProvider>
    </QueryClientProvider>
    </React.StrictMode>
  )
}

describe('DocumentEditor media selection', () => {
  it('saves the selected media', async () => {
    render(<Harness />)
    await waitFor(() => expect(screen.queryByLabelText(/Featured Image/i) || document.body.textContent?.includes('clickToUploadOrBrowse')).toBeTruthy(), { timeout: 3000 })
    const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
    const compact = buttons().find(b => /clickToUploadOrBrowse/.test(b.textContent || ''))
    expect(compact, 'compact opener').toBeTruthy()
    await act(async () => { fireEvent.click(compact!) })
    const browse = buttons().find(b => /types\.media\.browse/.test(b.textContent || ''))
    expect(browse, 'browse').toBeTruthy()
    await act(async () => { fireEvent.click(browse!) })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    const item = Array.from(document.querySelectorAll('div')).find(d => (d.textContent || '').trim().startsWith('a.png') && d.className.includes('cursor-pointer'))
    expect(item, 'grid item').toBeTruthy()
    await act(async () => { fireEvent.click(item!) })
    const selectBtn = buttons().find(b => /mediaBrowser\.select/.test(b.textContent || ''))
    expect(selectBtn, 'select btn').toBeTruthy()
    await act(async () => { fireEvent.click(selectBtn!) })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    const save = buttons().find(b => /save/i.test(b.textContent || ''))
    expect(save, 'save button').toBeTruthy()
    await act(async () => { fireEvent.click(save!) })
    await act(async () => { await new Promise(r => setTimeout(r, 100)) })
    const saved = (globalThis as any).__payload?.featuredImage
    expect(saved).toBeTruthy()
    expect(saved.asset?._ref).toBe('media-1')
    expect(saved._type).toBe('media')
  })
})


describe('DocumentEditor media upload', () => {
  it('saves the uploaded media', async () => {
    const { apiClient } = await import('@/services/api-client') as any
    apiClient.uploadMedia = vi.fn(async () => ({ success: true, data: { files: [mediaItem], meta: { count: 1 } } }))
    ;(globalThis as any).__payload = null
    render(<Harness />)
    await new Promise(r => setTimeout(r, 200))
    const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
    const compact = buttons().find(b => /clickToUploadOrBrowse/.test(b.textContent || ''))
    await act(async () => { fireEvent.click(compact!) })
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })
    await act(async () => { fireEvent.change(input) })
    await act(async () => { await new Promise(r => setTimeout(r, 800)) })
    const save = buttons().find(b => /save/i.test(b.textContent || ''))
    await act(async () => { fireEvent.click(save!) })
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    const saved = (globalThis as any).__payload?.featuredImage
    expect(saved).toBeTruthy()
    expect(saved.asset?._ref).toBe('media-1')
    expect(saved._type).toBe('media')
  })
})
