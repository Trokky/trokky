/**
 * Built-in HTTP Client for Trokky
 */

export interface ClientConfig {
  baseUrl: string
  apiToken?: string
  timeout?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export class HttpClient {
  private config: Required<ClientConfig>
  private tokens: AuthTokens | null = null

  constructor(config: ClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiToken: config.apiToken || '',
      timeout: config.timeout || 30000
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request('GET', path)
  }

  async post<T>(path: string, data?: any): Promise<T> {
    return this.request('POST', path, data)
  }

  async put<T>(path: string, data?: any): Promise<T> {
    return this.request('PUT', path, data)
  }

  async delete<T>(path: string): Promise<T> {
    return this.request('DELETE', path)
  }

  async authenticate(credentials: { username: string; password: string }): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>('POST', '/auth/login', credentials)
    this.tokens = tokens
    return tokens
  }

  setApiToken(token: string): void {
    this.config.apiToken = token
    this.tokens = null
  }

  private async request<T>(method: string, path: string, data?: any): Promise<T> {
    const url = `${this.config.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    }

    if (this.tokens?.accessToken) {
      headers.Authorization = `Bearer ${this.tokens.accessToken}`
    } else if (this.config.apiToken) {
      headers.Authorization = `Bearer ${this.config.apiToken}`
    }

    if (data) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(this.config.timeout)
    })

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    const result: any = await response.json()
    return (result.success && result.data ? result.data : result) as T
  }
}
