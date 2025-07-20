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

  /**
   * Convert Express Request to framework-agnostic HttpRequest
   */
  public convertRequest(req: ExpressRequestWithFiles): HttpRequest {
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

    // Convert uploaded files to File objects
    let files: File[] | undefined
    if (req.files) {
      files = this.convertMulterFiles(req.files)
    }

    return {
      method: req.method as HttpRequest['method'],
      url: req.originalUrl || req.url,
      path: req.path,
      query,
      params: req.params,
      headers,
      body: req.body,
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
        const httpRequest = this.convertRequest(req)
        
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
    } else {
      res.json(httpResponse.body)
    }
  }

  /**
   * Convert Multer file objects to File objects
   */
  private convertMulterFiles(multerFiles: Express.Multer.File[] | Express.Multer.File): File[] {
    const files: File[] = []
    const fileArray = Array.isArray(multerFiles) ? multerFiles : [multerFiles]

    for (const multerFile of fileArray) {
      // Create a File-like object from Multer file
      const file = new Blob([multerFile.buffer], { type: multerFile.mimetype })
      
      // Add File properties that aren't in Blob
      Object.defineProperties(file, {
        name: { value: multerFile.originalname, writable: false },
        size: { value: multerFile.size, writable: false },
        type: { value: multerFile.mimetype, writable: false },
        lastModified: { value: Date.now(), writable: false }
      })

      files.push(file as File)
    }

    return files
  }
}