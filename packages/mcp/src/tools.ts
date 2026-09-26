/**
 * The Trokky tools an agent sees.
 *
 * Tools, not resources: every MCP client supports tools, far fewer surface
 * resources. Each tool maps onto one API route; the API's own permission checks
 * are the real boundary, and read-only mode only decides which tools exist.
 */

import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { TrokkyApi, TrokkyApiError } from './api.js'

export interface ToolOptions {
  /** Register only the tools that cannot change content */
  readOnly: boolean
  /**
   * Directories upload_media may read from. A path outside them is refused, so a
   * prompt-injected agent cannot publish arbitrary local files: uploaded media is
   * served publicly.
   */
  uploadRoots: string[]
  /** Largest file upload_media will send, in bytes */
  maxUploadBytes: number
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
/** Largest tool result, in characters. A bigger one is cut, with a note saying so. */
export const MAX_RESULT_CHARS = 200_000

// How a document stores a media item or a reference: agents cannot guess these
export const MEDIA_FORMAT = 'A media field holds {"_type": "media", "asset": {"_ref": "<media id>", "_type": "mediaAsset"}, "alt": "<description>"}'
export const REFERENCE_FORMAT = 'A reference field holds {"_ref": "<document id>", "_type": "<target collection>"}, and an array of references a list of these'
export const FIELD_FORMATS = `${MEDIA_FORMAT}. ${REFERENCE_FORMAT}. A bare id string is stored, but Studio cannot edit it and expand does not resolve it.`

const collection = z.string().min(1).describe('Collection name, as returned by list_collections')
const documentId = z.string().min(1).describe('Document id (the `id` field). For a singleton, the `documentId` from list_collections')
const expand = z.string().optional().describe('Resolve references: "*" for every reference field, or a comma-separated list of field names; use "field[]" for an array of references')
const limit = z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Page size, default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}`)
const offset = z.number().int().min(0).optional().describe('Number of items to skip, default 0')

// Storage bookkeeping an agent has no use for: dropping it roughly halves a small document
const NOISE_FIELDS = ['_id', '_collection', '_revision', '_createdBy', '_updatedBy', '_createdByType', '_updatedByType']

export function slim(document: unknown): unknown {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return document
  }
  const copy = { ...(document as Record<string, unknown>) }
  for (const field of NOISE_FIELDS) delete copy[field]
  return copy
}

export function json(value: unknown): CallToolResult {
  // Compact: a tool result is read by a model, and indentation is paid for in tokens
  let text = JSON.stringify(value ?? null)
  if (text.length > MAX_RESULT_CHARS) {
    text = `${text.slice(0, MAX_RESULT_CHARS)}\n[Truncated: the result is ${text.length} characters, over the ${MAX_RESULT_CHARS} limit. Ask for fewer items with limit, or leave out expand.]`
  }
  return { content: [{ type: 'text', text }] }
}

export function failure(error: unknown): CallToolResult {
  let text: string
  if (error instanceof TrokkyApiError) {
    const hints: Record<number, string> = {
      400: 'The request was refused as invalid. Check field names and value formats against get_schema.',
      401: 'The token was rejected: it may be wrong, revoked or expired.',
      403: 'The token lacks the permission this needs. Ask the site admin for a token with it; do not retry.',
      404: 'Nothing exists at that collection or id. list_collections and list_documents show what does.',
      429: 'Rate limited. Wait before retrying.'
    }
    const details = error.details ? `\nDetails: ${JSON.stringify(error.details)}` : ''
    text = `Trokky API error ${error.status} ${error.code}: ${error.message}${details}${hints[error.status] ? `\n${hints[error.status]}` : ''}`
  } else {
    text = error instanceof Error ? error.message : String(error)
  }
  return { content: [{ type: 'text', text }], isError: true }
}

/**
 * How a tool reaches a site: `use` runs the action against the named site's API (or the
 * default site) with a live token, renewing it once if the site rejects it.
 */
export interface SiteAccess {
  use<T>(site: string | undefined, action: (api: TrokkyApi) => Promise<T>): Promise<T>
}

/**
 * Build a route path from segments. encodeURIComponent leaves `.` and `..` alone and
 * URL parsing then resolves them, which would let an id climb out of its route.
 */
export function routePath(...parts: string[]): string {
  for (const part of parts) {
    if (part === '' || part === '.' || part === '..') {
      throw new Error(`Invalid name or id: ${JSON.stringify(part)}`)
    }
  }
  return '/' + parts.map(encodeURIComponent).join('/')
}

// The server accepts only these types, and judges a file by the type it is sent with.
// No SVG: the server serves media inline, and an SVG can carry script.
export const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/mov', '.avi': 'video/avi',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.aac': 'audio/aac',
  '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json'
}

interface Schema {
  name: string
  title?: string
  description?: string
  type?: string
  singleton?: boolean
  fields?: Record<string, { type?: string; required?: boolean }>
}

interface StructureItem {
  schemaType?: string
  documentId?: string
  items?: StructureItem[]
}

/** Singleton collection -> the id its document lives under, from the site's structure */
async function singletonIds(api: TrokkyApi): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  try {
    const { data } = await api.get<{ structure?: { items?: StructureItem[] } }>('/config/structure')
    const walk = (items: StructureItem[] = []): void => {
      for (const item of items) {
        if (item.schemaType && item.documentId && !ids.has(item.schemaType)) {
          ids.set(item.schemaType, item.documentId)
        }
        walk(item.items)
      }
    }
    walk(data?.structure?.items)
  } catch {
    // No structure, or not allowed to read it: the id defaults to the collection name
  }
  return ids
}

const site = z.string().min(1).optional().describe('Which site, by the name list_sites shows. Default: the default site')

export function registerTools(server: McpServer, sites: SiteAccess, options: ToolOptions): void {
  const run = async (siteName: string | undefined, action: (api: TrokkyApi) => Promise<unknown>): Promise<CallToolResult> => {
    try {
      return json(await sites.use(siteName, action))
    } catch (error) {
      return failure(error)
    }
  }

  // Best effort: an item whose id cannot form a URL is returned without one, not as an error
  const withUrl = (api: TrokkyApi, item: unknown): unknown => {
    const media = item as { id?: unknown } | null
    if (!media || typeof media !== 'object' || typeof media.id !== 'string') return item
    try {
      return { ...media, url: `${api.apiUrl}${routePath('media', media.id)}/file` }
    } catch {
      return item
    }
  }

  server.registerTool('list_collections', {
    title: 'List collections',
    description: 'List the content collections on this Trokky site with their fields. Call this first: every other tool takes a collection name, and the fields tell you what a document holds. A singleton collection holds exactly one document, under `documentId`.',
    inputSchema: { site },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ site }) => run(site, async api => {
    // One request at a time: before 3.5.1, the filesystem adapter could fail concurrent
    // requests made with the same API token (both rewrite its usage record)
    const { data } = await api.get<{ collections: Schema[] }>('/collections')
    const singletons = await singletonIds(api)
    const collections = Array.isArray(data?.collections) ? data.collections : []
    return collections.map(schema => {
      const singleton = schema.singleton === true || schema.type === 'singleton'
      return {
        name: schema.name,
        title: schema.title,
        description: schema.description,
        ...(singleton ? { singleton: true, documentId: singletons.get(schema.name) ?? schema.name } : {}),
        fields: Object.fromEntries(Object.entries(schema.fields ?? {})
          // Underscore fields are managed by the server (e.g. _thumbnail), not written by hand
          .filter(([name]) => !name.startsWith('_'))
          .map(([name, field]) => [name, `${field.type ?? 'unknown'}${field.required ? ' (required)' : ''}`]))
      }
    })
  }))

  server.registerTool('get_schema', {
    title: 'Get a collection schema',
    description: 'Full schema of one collection: every field with its type, validation, options, nested fields and reference targets. Read it before creating or updating documents in that collection.',
    inputSchema: { collection, site },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ collection, site }) => run(site, async api =>
    (await api.get<{ schema: unknown }>(routePath('schemas', collection))).data?.schema))

  server.registerTool('list_documents', {
    title: 'List documents',
    description: 'List documents in a collection, one page at a time. `filter` matches top-level fields exactly (e.g. {"_status": "published", "category": "news"}); it does not do ranges or partial text. Use `search` for text.',
    inputSchema: {
      site,
      collection,
      filter: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
        .describe('Exact-match conditions on top-level fields'),
      sort: z.string().optional().describe('Field to sort by; prefix with "-" for descending, e.g. "-_updatedAt"'),
      limit,
      offset,
      expand
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ collection, filter, sort, limit, offset, expand, site }) => run(site, async api => {
    const pageSize = limit ?? DEFAULT_LIMIT
    const skip = offset ?? 0
    const { data } = await api.get<{ documents: unknown[]; pagination?: { total?: number } }>(routePath('collections', collection), {
      // JSON, not bracket keys: both the Express and the fetch adapters accept it
      filter: filter ? JSON.stringify(filter) : undefined,
      sort,
      limit: pageSize,
      offset: skip,
      expand
    })
    const documents = data?.documents ?? []
    const total = data?.pagination?.total
    return {
      documents: documents.map(slim),
      total,
      offset: skip,
      limit: pageSize,
      hasMore: typeof total === 'number' ? skip + documents.length < total : documents.length === pageSize
    }
  }))

  server.registerTool('get_document', {
    title: 'Get a document',
    description: 'Get one document by collection and id. For a singleton, use its `documentId` from list_collections; reading it creates the document empty if it does not exist yet.',
    inputSchema: { collection, id: documentId, expand, site },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ collection, id, expand, site }) => run(site, async api =>
    slim((await api.get<{ document: unknown }>(routePath('collections', collection, id), { expand })).data?.document)))

  server.registerTool('search', {
    title: 'Search content',
    description: 'Case-insensitive text search across the collections this token can read (titles, names, slugs and similar) and media file names. It only scans the first documents of each collection (about twice `limit`), so it can miss older content, and `total` counts only what it scanned: when you know the collection, page through list_documents instead.',
    inputSchema: {
      site,
      query: z.string().min(2).describe('Text to look for, at least 2 characters'),
      limit
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ query, limit, site }) => run(site, async api => {
    const { data } = await api.get<{ results?: Array<Record<string, unknown>>; total?: number }>('/search', { q: query, limit: limit ?? DEFAULT_LIMIT })
    return {
      // The server's `url` is a Studio route, useless to an agent; point media at its file
      results: (Array.isArray(data?.results) ? data.results : [])
        .filter(result => result && typeof result === 'object')
        .map(({ url: _studioRoute, metadata: _metadata, ...result }) => result.type === 'media' ? withUrl(api, result) : result),
      total: data?.total
    }
  }))

  server.registerTool('list_media', {
    title: 'List media',
    description: `List uploaded media (images, documents) with ids, file names, sizes and a public \`url\`. ${MEDIA_FORMAT}.`,
    inputSchema: { limit, offset, site },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ limit, offset, site }) => run(site, async api => {
    const response = await api.get<unknown[]>('/media', { limit: limit ?? DEFAULT_LIMIT, offset: offset ?? 0 })
    return { ...response.meta, media: (Array.isArray(response.data) ? response.data : []).map(item => withUrl(api, item)) }
  }))

  server.registerTool('get_media', {
    title: 'Get a media item',
    description: 'Get one media item\'s metadata by id: file name, type, size, dimensions, alt text and public `url`.',
    inputSchema: { id: z.string().min(1).describe('Media id'), site },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ id, site }) => run(site, async api => withUrl(api, (await api.get<{ file: unknown }>(routePath('media', id))).data?.file)))

  if (options.readOnly) {
    return
  }

  const data = z.record(z.string(), z.unknown()).describe(
    'Field values, keyed by field name as in get_schema. System fields (id, _createdAt, ...) are ignored. ' + FIELD_FORMATS
  )

  server.registerTool('create_document', {
    title: 'Create a document',
    description: 'Create a document in a collection. It is saved as a draft unless `status` is "published", which needs publish permission. Read get_schema first. The server checks types and required fields but keeps unknown fields silently, so a misspelled field name is stored, not reported. A slug field left empty is generated from its source field (usually the title), and a duplicate gets a numeric suffix: check the returned slug. A singleton already has its one document: use update_document on it.',
    inputSchema: {
      site,
      collection,
      data,
      status: z.enum(['draft', 'published']).optional().describe('Default "draft"')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ collection, data, status, site }) => run(site, async api => {
    const payload = status ? { ...data, _status: status } : data
    return slim((await api.post<{ document: unknown }>(routePath('collections', collection), { data: payload })).data?.document)
  }))

  server.registerTool('update_document', {
    title: 'Update a document',
    description: 'Change fields of an existing document; fields you leave out are kept. The merge is top-level only: an array or object field you send replaces the whole stored value, so send it complete. The slug is not regenerated when the title changes; send `slug` to change it, knowing that changes the page\'s public URL. On a singleton this creates the document if needed. To publish or unpublish, use set_status.',
    inputSchema: { collection, id: documentId, data, site },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ collection, id, data, site }) => run(site, async api => {
    // Status changes go through set_status so that intent is explicit
    const fields = { ...data }
    delete fields._status
    return slim((await api.put<{ document: unknown }>(routePath('collections', collection, id), { data: fields })).data?.document)
  }))

  server.registerTool('set_status', {
    title: 'Publish or unpublish',
    description: 'Publish a document (it goes live on the site and webhooks fire) or return it to draft (it disappears from the site). Needs publish permission. Confirm with the user first.',
    inputSchema: {
      site,
      collection,
      id: documentId,
      status: z.enum(['draft', 'published'])
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ collection, id, status, site }) => run(site, async api =>
    slim((await api.put<{ document: unknown }>(routePath('collections', collection, id), { data: { _status: status } })).data?.document)))

  server.registerTool('delete_document', {
    title: 'Delete a document',
    description: 'Permanently delete a document. There is no trash: confirm with the user first.',
    inputSchema: { collection, id: documentId, site },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ collection, id, site }) => run(site, async api => {
    await api.delete(routePath('collections', collection, id))
    return { deleted: true, collection, id }
  }))

  if (options.uploadRoots.length === 0) {
    return
  }

  server.registerTool('upload_media', {
    title: 'Upload a media file',
    description: `Upload a local file to the media library and get back its id and public \`url\`. Uploaded files are publicly reachable by anyone with the URL. Only files under these directories can be uploaded: ${options.uploadRoots.join(', ')}. Supported extensions: ${Object.keys(MIME_TYPES).join(' ')}. ${MEDIA_FORMAT}.`,
    inputSchema: {
      site,
      path: z.string().min(1).describe('Path to the file, absolute or relative to the first upload directory'),
      filename: z.string().optional().describe('Name to store it under, with the same extension as the file; defaults to the file\'s own name')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ path: filePath, filename, site }) => run(site, async api => {
    const resolved = await resolveUploadPath(filePath, options.uploadRoots)
    // The type comes from the file on disk. A rename may not change it, or `.env` could
    // be published as `notes.txt`.
    const extension = path.extname(resolved).toLowerCase()
    const type = MIME_TYPES[extension]
    if (!type) {
      throw new Error(`Unsupported file type: ${path.basename(resolved)}. Supported extensions: ${Object.keys(MIME_TYPES).join(' ')}`)
    }
    if (filename !== undefined && path.extname(filename).toLowerCase() !== extension) {
      throw new Error(`filename must keep the file's extension (${extension}): ${filename}`)
    }
    const info = await stat(resolved)
    if (!info.isFile()) {
      throw new Error(`Not a file: ${filePath}`)
    }
    if (info.size > options.maxUploadBytes) {
      throw new Error(`File is ${info.size} bytes; the limit is ${options.maxUploadBytes}`)
    }
    const form = new FormData()
    form.append('file', new Blob([await readFile(resolved)], { type }), filename ?? path.basename(resolved))
    const response = await api.upload<{ files: unknown[] }>('/media/upload', form)
    return withUrl(api, response.data?.files?.[0])
  }))
}

/**
 * Resolve a requested upload path and refuse anything outside the allowed roots,
 * following symlinks so a link inside a root cannot point out of it.
 */
export async function resolveUploadPath(requested: string, roots: string[]): Promise<string> {
  if (roots.length === 0) {
    throw new Error('Uploads are disabled: no upload directory is configured')
  }
  const candidate = path.resolve(roots[0], requested)
  let real: string
  try {
    real = await realpath(candidate)
  } catch {
    throw new Error(`File not found: ${requested}`)
  }
  for (const root of roots) {
    const realRoot = await realpath(root).catch(() => undefined)
    if (realRoot && (real === realRoot || real.startsWith(realRoot + path.sep))) {
      return real
    }
  }
  throw new Error(`Refusing to upload ${requested}: it is outside the allowed upload directories (${roots.join(', ')})`)
}
