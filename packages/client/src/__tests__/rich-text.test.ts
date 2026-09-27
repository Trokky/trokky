/**
 * Rich text as Studio stores it, made renderable: every image is rebuilt from its media id, so
 * where the API lives, or whether a proxy sits in front, is the client's configuration and not
 * something baked into stored content.
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { TrokkyClient } from '../client.js'
import { proxyMediaRequest } from '../server/media-proxy.js'
import type { RichTextNode } from '../shortcodes/types.js'

const API = 'https://cms.example.com/api'

/** What Studio stores for an image in an HTML field (format-converter's normalizeHtmlImages) */
const STORED_HTML = '<p>Before</p><img src="/api/media/media-1/variants/medium" alt="Tom &amp; Jerry" class="wide" data-trokky-id="media-1" data-trokky-variant="medium"><p>After</p>'

describe('resolveContent on HTML as Studio stores it', () => {
  it('leaves stored images as saved without a media base', () => {
    const absolute = '<img src="https://cms.example.com/api/media/media-1/file" data-trokky-id="media-1">'
    for (const baseUrl of [API, 'http://internal:3000/api', 'https://cms.example.com/cms-api', 'http://internal:3000']) {
      const client = new TrokkyClient({ baseUrl })
      expect(client.resolveContent(STORED_HTML)).toBe(STORED_HTML)
      expect(client.resolveContent(absolute)).toBe(absolute)
      expect(client.resolveContent('![a](/api/media/media-1/file)')).toBe('![a](/api/media/media-1/file)')
    }
  })

  it('follows the media base, whatever path or host the content was saved with', () => {
    const client = new TrokkyClient({ baseUrl: 'https://cms.example.com/cms-api', mediaBaseUrl: '/cms-api/media' })
    expect(client.resolveContent(STORED_HTML)).toContain('src="/cms-api/media/media-1/variants/medium"')
  })

  it('reads attributes as HTML does, not as text', () => {
    const client = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    // A quoted value containing src=" is not the src
    expect(client.resolveContent(`<img title='a src="x"' src="/api/media/media-1/file" data-trokky-id="media-1">`))
      .toBe(`<img title='a src="x"' src="/media/media-1/file" data-trokky-id="media-1">`)
    // Any case, single quotes
    expect(client.resolveContent("<IMG SRC='/api/media/media-2/file' DATA-TROKKY-ID='media-2'>")).toBe("<IMG SRC='/media/media-2/file' DATA-TROKKY-ID='media-2'>")
    // No src: nothing to rebuild
    expect(client.resolveContent('<img data-trokky-id="media-3" alt="x">')).toBe('<img data-trokky-id="media-3" alt="x">')
  })

  it('points every image at mediaBaseUrl, a proxy path or a public URL', () => {
    const proxied = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media/' }).resolveContent(STORED_HTML)
    expect(proxied).toBe(STORED_HTML.replace('/api/media/media-1/variants/medium', '/media/media-1/variants/medium'))

    const cdn = new TrokkyClient({ baseUrl: API, mediaBaseUrl: 'https://cdn.example.com/media' })
    expect(cdn.resolveContent('<img src="/api/media/media-2/file" data-trokky-id="media-2">')).toBe('<img src="https://cdn.example.com/media/media-2/file" data-trokky-id="media-2">')
  })

  it('rebuilds an image without data-trokky-id from its stored path, and leaves other images alone', () => {
    const client = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    expect(client.resolveContent('<img src="https://cms.example.com/api/media/media-3/file" alt="x">')).toBe('<img src="/media/media-3/file" alt="x">')
    const foreign = '<img src="https://elsewhere.example/x.png"><img src="/images/logo.png"><img src="https://elsewhere.example/media/abc/file"><img src="//elsewhere.example/api/media/abc/file">'
    expect(client.resolveContent(foreign)).toBe(foreign)
    // The id wins over whatever host the content was saved with
    expect(client.resolveContent('<img src="https://old-cms.example.org/api/media/media-4/file" data-trokky-id="media-4">'))
      .toBe('<img src="/media/media-4/file" data-trokky-id="media-4">')
  })

  it('takes a media base for one call', () => {
    const client = new TrokkyClient({ baseUrl: API })
    expect(client.resolveContent('<img src="/api/media/media-1/file" data-trokky-id="media-1">', { mediaBaseUrl: '/media/' }))
      .toBe('<img src="/media/media-1/file" data-trokky-id="media-1">')
  })
})

describe('resolveContent on Markdown as Studio stores it', () => {
  it('rebuilds media images from their path and keeps titles and other images', () => {
    const client = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    const markdown = '# Title\n\n![Cover](/api/media/media-1/variants/large "The cover")\n\n![Logo](https://elsewhere.example/logo.png)\n\n![Old](https://cms.example.com/api/media/media-2/file)'
    expect(client.resolveContent(markdown)).toBe(
      '# Title\n\n![Cover](/media/media-1/variants/large "The cover")\n\n![Logo](https://elsewhere.example/logo.png)\n\n![Old](/media/media-2/file)'
    )
  })

  it('leaves code, and images on other hosts, as written', () => {
    const client = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    const markdown = 'Use `![x](/api/media/m1/file)` like this:\n\n```md\n![x](/api/media/m1/file)\n```\n\n![y](//other.example/api/media/m2/file)'
    expect(client.resolveContent(markdown)).toBe(markdown)
  })
})

describe('resolveContent on placeholders', () => {
  it('turns the placeholders earlier Studio versions wrote into images', () => {
    const plain = new TrokkyClient({ baseUrl: API })
    expect(plain.resolveContent('[trokky-image id="media-1" variant="medium" alt="Tom &amp; Jerry"]')).toBe(
      '<img src="https://cms.example.com/api/media/media-1/variants/medium" alt="Tom &amp; Jerry">'
    )
    expect(plain.resolveContent('[trokky-image id="media-2" variant="original"]')).toBe('<img src="https://cms.example.com/api/media/media-2/file">')
    const proxied = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    expect(proxied.resolveContent('[trokky-image id="media-2"]')).toBe('<img src="/media/media-2/file">')
  })

  it('resolves a ProseMirror document, however deep, without changing it', () => {
    const client = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    const doc: RichTextNode = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        {
          type: 'blockquote',
          content: [
            { type: 'image', marks: [], attrs: { src: '[trokky-image:media-1]', 'data-trokky-id': 'media-1', 'data-trokky-variant': 'large', alt: 'A' } }
          ]
        },
        { type: 'image', attrs: { src: '[trokky-image:media-2]', 'data-trokky-id': 'media-2' } },
        { type: 'image', attrs: { src: 'https://elsewhere.example/[trokky-image:media-9]' } }
      ]
    }
    const before = JSON.stringify(doc)

    const resolved = client.resolveContent(doc)
    const images = [resolved.content?.[1]?.content?.[0], resolved.content?.[2], resolved.content?.[3]]
    expect(images.map(image => image?.attrs?.src)).toEqual([
      '/media/media-1/variants/large',
      '/media/media-2/file',
      'https://elsewhere.example/[trokky-image:media-9]'
    ])
    expect(images[0]).toMatchObject({ marks: [], attrs: { alt: 'A' } })
    expect(resolved.content?.[0]).toEqual(doc.content?.[0])
    expect(JSON.stringify(doc)).toBe(before)
  })

  it('gives empty content back as a string, typed as one', () => {
    const client = new TrokkyClient({ baseUrl: API })
    const maybe: string | undefined = undefined
    const html: string = client.resolveContent(maybe)
    expect(html).toBe('')
    expect(client.resolveContent(null)).toBe('')
  })
})

describe('media field URLs', () => {
  it('build on mediaBaseUrl and keep real variant URLs', () => {
    const client = new TrokkyClient({ baseUrl: API, mediaBaseUrl: '/media' })
    expect(client.imageUrl('media-1').url()).toBe('/media/media-1/file')
    expect(client.imageUrl('media-1').medium().url()).toBe('/media/media-1/variants/medium')
    expect(client.createImageUrlBuilder()('media-1').width(400).url()).toBe('/media/media-1/file?w=400')
    expect(client.createImageUrlBuilder({ mediaBaseUrl: 'https://cdn.example.com/m/' })('media-1').url()).toBe('https://cdn.example.com/m/media-1/file')
  })

  it('change nothing without it, and keep the legacy proxyPath behaviour', () => {
    const client = new TrokkyClient({ baseUrl: API })
    expect(client.imageUrl('media-1').url()).toBe('https://cms.example.com/api/media/media-1/file')
    expect(client.createImageUrlBuilder({ proxyPath: '/media' })('media-1').medium().url()).toBe('/media/media-1/file?w=800')
  })
})

describe('media proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards a media file or variant, and nothing else', async () => {
    const fetchMock = vi.fn(async () => new Response('bytes', { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)
    const config = { apiUrl: API, apiToken: 'secret' }

    expect((await proxyMediaRequest(config, { path: 'media-1/file' })).status).toBe(200)
    expect((await proxyMediaRequest(config, { path: 'media-1/variants/medium' })).status).toBe(200)
    expect(fetchMock.mock.calls.map(call => String((call as unknown[])[0]))).toEqual([
      `${API}/media/media-1/file`,
      `${API}/media/media-1/variants/medium`
    ])

    for (const path of ['../users', 'media-1/file/../../users', '..%2Fusers', 'media-1/file?x=1', 'media-1', '', 'media-1/variants/../../tokens', '../settings/file', 'a/b/file', 'media-1/variants/a.b', `${'x'.repeat(101)}/file`]) {
      expect((await proxyMediaRequest(config, { path })).status).toBe(404)
    }
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
