/**
 * A small HTTP client for the Trokky API, shaped to the server's actual routes.
 *
 * Every response is the `{ success, data | error }` envelope; this unwraps it and
 * turns failures into a TrokkyApiError that keeps the status, so tools can explain
 * a 403 differently from a 404.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface TrokkyApiOptions {
  /** API base URL, e.g. https://cms.example.com/api */
  apiUrl: string
  /** API token (64 hex characters) or JWT, sent as a Bearer token */
  token: string
  /** Injectable fetch, for tests or custom transports. Defaults to global fetch. */
  fetch?: FetchLike
}

export interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  meta?: Record<string, unknown>
  error?: { code?: string; message?: string; details?: unknown }
}

export type QueryValue = string | number | boolean | undefined

export class TrokkyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'TrokkyApiError'
  }
}

export class TrokkyApi {
  readonly apiUrl: string
  private readonly token: string
  private readonly fetchImpl: FetchLike

  constructor(options: TrokkyApiOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, '')
    this.token = options.token
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<ApiEnvelope<T>> {
    return this.request<T>('GET', path, { query })
  }

  post<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>('POST', path, { body })
  }

  put<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>('PUT', path, { body })
  }

  delete<T>(path: string): Promise<ApiEnvelope<T>> {
    return this.request<T>('DELETE', path)
  }

  upload<T>(path: string, form: FormData): Promise<ApiEnvelope<T>> {
    return this.request<T>('POST', path, { form })
  }

  private async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; form?: FormData } = {}
  ): Promise<ApiEnvelope<T>> {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== '') search.set(key, String(value))
    }
    const queryString = search.toString()
    const url = `${this.apiUrl}${path}${queryString ? `?${queryString}` : ''}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json'
    }
    let body: BodyInit | undefined
    if (options.form) {
      body = options.form
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await this.fetchImpl(url, { method, headers, body })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new TrokkyApiError(0, 'NETWORK_ERROR', `Could not reach ${this.apiUrl}: ${reason}`)
    }

    if (response.status === 204) {
      return { success: true }
    }

    const text = await response.text()
    let envelope: ApiEnvelope<T> | undefined
    try {
      envelope = text ? (JSON.parse(text) as ApiEnvelope<T>) : undefined
    } catch {
      envelope = undefined
    }

    if (!response.ok || !envelope || envelope.success === false) {
      const code = envelope?.error?.code ?? `HTTP_${response.status}`
      const message = envelope?.error?.message
        ?? (envelope ? `Request failed with status ${response.status}` : `Expected JSON from ${method} ${path}, got status ${response.status}`)
      throw new TrokkyApiError(response.status, code, message, envelope?.error?.details)
    }

    return envelope
  }
}

/**
 * Accept either a site URL or an API URL. A bare origin gets Trokky's default
 * `/api` mount; any explicit path is used as given, for APIs mounted elsewhere.
 */
export function resolveApiUrl(input: string): string {
  let url: URL
  // Error messages never repeat the input: it may hold a credential
  try {
    url = new URL(input)
  } catch {
    throw new Error('TROKKY_URL is not a valid URL; expected something like https://cms.example.com')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`TROKKY_URL must be http or https, not ${url.protocol.replace(/:$/, '')}`)
  }
  if (url.username || url.password) {
    // Never echo it back: the point is that it holds a secret
    throw new Error('TROKKY_URL must not contain a username or password; put the API token in TROKKY_TOKEN')
  }
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path === '' ? '/api' : path
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/+$/, '')
}
