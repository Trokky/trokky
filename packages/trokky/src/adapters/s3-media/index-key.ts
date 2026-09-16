/**
 * The listing index, encoded into object keys.
 *
 * `ListObjectsV2` returns Key, Size, LastModified and nothing else — no user metadata — so the
 * trick the R2 adapter uses (mirror the sortable fields into `customMetadata` and read them back
 * from the listing) has no equivalent here. What a listing can always read is the key itself, so
 * the fields go there:
 *
 *     index/<id>/<createdAt as 13-digit epoch ms>/<base64url({ f, t, s })>
 *
 * **The id comes first, not the epoch.** Epoch-first would make a raw listing chronological, but
 * `listMedia` has to sort in memory anyway — it supports name, size and type as well, and it
 * needs every entry to compute a total — so that ordering buys nothing. Id-first buys something
 * real: replacing or deleting one file's entries is a prefix listing of one key instead of a
 * sweep of the whole index, which otherwise happens on every single upload.
 *
 * **This index is a cache, never the enumeration.** `meta/` is the only authority for whether a
 * file exists; a missing index entry costs one record read and is rebuilt, it does not hide a
 * file. See the adapter's `listMedia` and `cleanup`.
 */

const PREFIX = 'index/'

/** Enough digits for a millisecond epoch until the year 2286, and a stable sort until then. */
const EPOCH_DIGITS = 13

/**
 * The longest key this encoding may produce. S3 caps a key at 1024 bytes, and a filename has no
 * length limit worth trusting; the margin leaves room for the adapter's own prefix.
 */
export const MAX_INDEX_KEY_BYTES = 900

export interface IndexEntry {
  id: string
  filename: string
  contentType: string
  size: number
  createdAt: Date
}

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value: string): string => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * The index key for an entry, under the adapter's prefix.
 *
 * A filename long enough to push the key past the cap is truncated **in the index only** — the
 * record keeps the real one, so nothing is lost but the precision of `sort: 'name'` for that one
 * entry. Refusing the upload instead would make a legal filename unstorable.
 */
export function encodeIndexKey(prefix: string, entry: IndexEntry): string {
  const epoch = String(entry.createdAt.getTime()).padStart(EPOCH_DIGITS, '0')
  const head = `${entryPrefix(prefix, entry.id)}${epoch}/`

  let filename = entry.filename
  let key = head + toBase64Url(JSON.stringify({ f: filename, t: entry.contentType, s: entry.size }))

  while (key.length > MAX_INDEX_KEY_BYTES && filename.length > 1) {
    // Halve rather than trim by one: a 4KB filename would otherwise take thousands of passes.
    filename = filename.slice(0, Math.max(1, Math.floor(filename.length / 2)))
    key = head + toBase64Url(JSON.stringify({ f: filename, t: entry.contentType, s: entry.size }))
  }

  return key
}

/**
 * Read an entry back out of a key, or null when the key is not one of ours.
 *
 * Anything unparseable is treated as absent rather than thrown: a stray object under `index/`
 * must not be able to break a listing, and `cleanup()` removes it.
 */
export function decodeIndexKey(prefix: string, key: string): IndexEntry | null {
  const root = `${prefix}${PREFIX}`
  if (!key.startsWith(root)) return null

  const [id, epoch, payload] = key.slice(root.length).split('/')
  if (!epoch || !id || !payload) return null

  const createdAt = new Date(Number(epoch))
  if (Number.isNaN(createdAt.getTime())) return null

  try {
    const { f, t, s } = JSON.parse(fromBase64Url(payload)) as {
      f?: unknown
      t?: unknown
      s?: unknown
    }
    if (typeof f !== 'string' || typeof t !== 'string' || typeof s !== 'number') return null
    return { id, filename: f, contentType: t, size: s, createdAt }
  } catch {
    return null
  }
}

/** The prefix every index key lives under, for listing and for cleanup. */
export const indexPrefix = (prefix: string): string => `${prefix}${PREFIX}`

/** The prefix one file's entries live under — the reason the id comes first. */
export const entryPrefix = (prefix: string, id: string): string => `${prefix}${PREFIX}${id}/`
