import type { Request, Response, NextFunction } from 'express'
import type { HttpRequest, HttpResponse, RouteHandler } from '@trokky/routes'
import type { ExpressRequestWithFiles, ExpressRouteHandler } from './types.js'

/**
 * Express.js Framework Adapter
 * 
 * Converts between Express Request/Response objects and Trokky's 
 * framework-agnostic HttpRequest/HttpResponse interfaces.
 */
export class ExpressAdapter {
  public readonly name = 'express'
  private maxFileSize: number

  constructor(options?: { maxFileSize?: number }) {
    this.maxFileSize = options?.maxFileSize || 50 * 1024 * 1024 // Default 50MB
  }

  /**
   * Convert Express Request to framework-agnostic HttpRequest
   */
  public async convertRequest(req: ExpressRequestWithFiles): Promise<HttpRequest> {
    // Extract query parameters
    const query: Record<string, string | string[] | undefined> = {}
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        query[key] = value.map(String)
      } else if (value !== undefined) {
        query[key] = String(value)
      }
    }

    // Extract headers
    const headers: Record<string, string | string[] | undefined> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers[key] = value
      } else if (value !== undefined) {
        headers[key] = value
      }
    }

    // Handle file uploads using edge-compatible FormData parsing
    let files: File[] | undefined
    let body = req.body

    // Check if this is a multipart/form-data request
    const contentType = req.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await this.parseFormData(req)
        files = formData.files
        body = formData.fields
      } catch (error) {
        console.warn('Failed to parse FormData:', error)
      }
    }

    return {
      method: req.method as HttpRequest['method'],
      url: req.originalUrl || req.url,
      path: req.path,
      query,
      params: req.params,
      headers,
      body,
      files
    }
  }

  /**
   * Create Express route handler from framework-agnostic handler
   */
  public handleRoute(routeHandler: RouteHandler): ExpressRouteHandler {
    return async (req: ExpressRequestWithFiles, res: Response, next: NextFunction) => {
      try {
        // Convert Express request to HttpRequest
        const httpRequest = await this.convertRequest(req)
        
        // Call the framework-agnostic handler
        const httpResponse = await routeHandler(httpRequest)
        
        // Apply response to Express response object
        this.applyHttpResponseToExpress(httpResponse, res)
      } catch (error) {
        // Pass errors to Express error handling middleware
        next(error)
      }
    }
  }

  /**
   * Apply HttpResponse to Express Response object
   */
  private applyHttpResponseToExpress(httpResponse: HttpResponse, res: Response): void {
    // Set status code
    res.status(httpResponse.status)

    // Set headers
    if (httpResponse.headers) {
      for (const [key, value] of Object.entries(httpResponse.headers)) {
        res.set(key, value)
      }
    }

    // Send response body
    if (httpResponse.body === null || httpResponse.body === undefined) {
      res.end()
    } else if (typeof httpResponse.body === 'string') {
      res.send(httpResponse.body)
    } else if (httpResponse.body instanceof Uint8Array) {
      // Support edge-style binary bodies
      res.end(Buffer.from(httpResponse.body))
    } else if (typeof ArrayBuffer !== 'undefined' && httpResponse.body instanceof ArrayBuffer) {
      res.end(Buffer.from(new Uint8Array(httpResponse.body)))
    } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(httpResponse.body as any)) {
      const view = httpResponse.body as ArrayBufferView
      res.end(Buffer.from(new Uint8Array(view.buffer)))
    } else if (Buffer.isBuffer(httpResponse.body)) {
      // Handle binary data (like images, videos, etc.) without charset
      res.end(httpResponse.body)
    } else {
      res.json(httpResponse.body)
    }
  }

  /**
   * Parse FormData from Express request using edge-compatible approach
   */
  private async parseFormData(req: ExpressRequestWithFiles): Promise<{ files: File[]; fields: Record<string, any> }> {
    const files: File[] = []
    const fields: Record<string, any> = {}

    // Use busboy for parsing multipart data in edge-compatible way
    const busboy = await import('busboy')
    
    return new Promise((resolve, reject) => {
      const bb = busboy.default({ headers: req.headers })
      
      bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
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
        
        const fileExtensions = getAllExtensions(info.filename)
        const hasDangerousExtension = fileExtensions.some(ext => dangerousExts.includes(ext))
        
        if (hasDangerousExtension) {
          const foundDangerousExt = fileExtensions.find(ext => dangerousExts.includes(ext))
          reject(new Error(`File extension ${foundDangerousExt} is not allowed`))
          return
        }
        
        // Security: Check for path traversal in filename
        if (info.filename.includes('..') || info.filename.includes('/') || info.filename.includes('\\')) {
          reject(new Error('Invalid filename. Path separators not allowed'))
          return
        }
        
        const chunks: Buffer[] = []
        let totalSize = 0
        const maxSize = this.maxFileSize
        
        file.on('data', (chunk: Buffer) => {
          totalSize += chunk.length
          if (totalSize > maxSize) {
            reject(new Error(`File too large. Maximum size is ${maxSize} bytes`))
            return
          }
          chunks.push(chunk)
        })
        
        file.on('end', () => {
          const buffer = Buffer.concat(chunks)
          
          // Create edge-compatible File object
          const fileBlob = new Blob([buffer], { type: info.mimeType })
          
          // Add File properties
          Object.defineProperties(fileBlob, {
            name: { value: info.filename, writable: false },
            size: { value: buffer.length, writable: false },
            type: { value: info.mimeType, writable: false },
            lastModified: { value: Date.now(), writable: false }
          })
          
          files.push(fileBlob as File)
        })
        
        file.on('error', reject)
      })
      
      bb.on('field', (name: string, value: string) => {
        // Handle JSON metadata
        if (name === 'metadata') {
          try {
            fields[name] = JSON.parse(value)
          } catch {
            fields[name] = value
          }
        } else {
          fields[name] = value
        }
      })
      
      bb.on('error', reject)
      bb.on('close', () => resolve({ files, fields }))
      
      req.pipe(bb)
    })
  }
}
