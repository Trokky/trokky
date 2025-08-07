import type { Context } from 'hono'
import type { HttpRequest, HttpResponse, RouteHandler } from '@trokky/routes'
import type { CloudflareEnv, HonoContext, HonoRouteHandler } from './types.js'

/**
 * Hono Framework Adapter
 * 
 * Converts between Hono Context and Trokky's 
 * framework-agnostic HttpRequest/HttpResponse interfaces.
 * Follows the same pattern as ExpressAdapter
 */
export class HonoAdapter {
  public readonly name = 'hono'

  /**
   * Convert Hono Context to framework-agnostic HttpRequest
   */
  public async convertRequest(c: HonoContext): Promise<HttpRequest> {
    const url = new URL(c.req.url)
    
    // Extract query parameters
    const query: Record<string, string | string[] | undefined> = {}
    url.searchParams.forEach((value, key) => {
      const existing = query[key]
      if (existing === undefined) {
        query[key] = value
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        query[key] = [existing, value]
      }
    })

    // Extract headers
    const headers: Record<string, string | string[] | undefined> = {}
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Handle file uploads using edge-compatible FormData parsing
    let files: File[] | undefined
    let body = undefined

    // Check if this is a multipart/form-data request
    const contentType = c.req.header('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await this.parseFormData(c)
        files = formData.files
        body = formData.fields
      } catch (error) {
        console.warn('Failed to parse FormData:', error)
      }
    } else if (contentType.includes('application/json')) {
      try {
        body = await c.req.json()
      } catch (error) {
        // Invalid JSON, body remains undefined
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = await c.req.formData()
        const formFields: Record<string, any> = {}
        for (const [key, value] of formData.entries()) {
          formFields[key] = value
        }
        body = formFields
      } catch (error) {
        // Failed to parse form data
      }
    }

    return {
      method: c.req.method as HttpRequest['method'],
      url: c.req.url,
      path: url.pathname,
      query,
      params: c.req.param() || {},
      headers,
      body,
      files
    }
  }

  /**
   * Create Hono route handler from framework-agnostic handler
   */
  public handleRoute(routeHandler: RouteHandler): HonoRouteHandler {
    return async (c: HonoContext) => {
      try {
        // Convert Hono context to HttpRequest
        const httpRequest = await this.convertRequest(c)
        
        // Call the framework-agnostic handler
        const httpResponse = await routeHandler(httpRequest)
        
        // Convert HttpResponse to Hono Response
        return this.convertResponse(httpResponse)
      } catch (error) {
        // Create error response
        console.error('Route handler error:', error)
        return new Response(
          JSON.stringify({ 
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error'
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }
  }

  /**
   * Convert HttpResponse to Hono Response
   */
  private convertResponse(httpResponse: HttpResponse): Response {
    // Determine content type
    const contentType = httpResponse.headers?.['Content-Type'] || httpResponse.headers?.['content-type']
    
    // Prepare headers
    const headers = new Headers()
    if (httpResponse.headers) {
      for (const [key, value] of Object.entries(httpResponse.headers)) {
        if (value !== undefined) {
          headers.set(key, String(value))
        }
      }
    }

    // Handle different response body types
    if (httpResponse.body === null || httpResponse.body === undefined) {
      return new Response(null, { 
        status: httpResponse.status,
        headers
      })
    } else if (typeof httpResponse.body === 'string') {
      return new Response(httpResponse.body, {
        status: httpResponse.status,
        headers
      })
    } else if (httpResponse.body instanceof ArrayBuffer || httpResponse.body instanceof Uint8Array) {
      return new Response(httpResponse.body, {
        status: httpResponse.status,
        headers
      })
    } else {
      // Default to JSON
      if (!contentType) {
        headers.set('Content-Type', 'application/json')
      }
      return new Response(JSON.stringify(httpResponse.body), {
        status: httpResponse.status,
        headers
      })
    }
  }

  /**
   * Parse FormData from Hono context using edge-compatible approach
   */
  private async parseFormData(c: HonoContext): Promise<{ files: File[]; fields: Record<string, any> }> {
    const files: File[] = []
    const fields: Record<string, any> = {}

    try {
      const formData = await c.req.formData()
      
      for (const [name, value] of formData.entries()) {
        if (typeof value === 'object' && value && 'name' in value && 'size' in value && 'type' in value) {
          // This is a file
          // Security: Check for dangerous file extensions
          const dangerousExts = [
            '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
            '.ps1', '.sh', '.php', '.jsp', '.asp', '.aspx', '.msi', '.dll', '.sys',
            '.bin', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.run', '.out'
          ]
          
          const getAllExtensions = (filename: string): string[] => {
            const parts = filename.toLowerCase().split('.')
            if (parts.length <= 1) return []
            return parts.slice(1).map(ext => `.${ext}`)
          }
          
          const file = value as File
          const fileExtensions = getAllExtensions(file.name)
          const hasDangerousExtension = fileExtensions.some(ext => dangerousExts.includes(ext))
          
          if (hasDangerousExtension) {
            const foundDangerousExt = fileExtensions.find(ext => dangerousExts.includes(ext))
            throw new Error(`File extension ${foundDangerousExt} is not allowed`)
          }
          
          // Security: Check for path traversal in filename
          if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\\\')) {
            throw new Error('Invalid filename. Path separators not allowed')
          }
          
          // Security: Check file size
          const maxSize = 50 * 1024 * 1024 // 50MB limit
          if (file.size > maxSize) {
            throw new Error(`File too large. Maximum size is ${maxSize} bytes`)
          }
          
          files.push(file)
        } else {
          // Handle JSON metadata
          if (name === 'metadata') {
            try {
              fields[name] = JSON.parse(value as string)
            } catch {
              fields[name] = value
            }
          } else {
            fields[name] = value
          }
        }
      }
      
      return { files, fields }
    } catch (error) {
      throw new Error(`Failed to parse form data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
