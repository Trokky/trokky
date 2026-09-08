/**
 * The error every API call rejects with. Lives apart from the client so
 * modules can catch it without importing the transport.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}
