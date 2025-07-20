import express, { type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import type { ExpressIntegrationConfig, ExpressMiddleware, ExpressErrorHandler } from './types.js'

/**
 * Creates Express middleware stack for Trokky integration
 */
export class TrokkyExpressMiddleware {
  private config: ExpressIntegrationConfig

  constructor(config: ExpressIntegrationConfig) {
    this.config = config
  }

  /**
   * Get all required middleware in correct order
   */
  public getMiddleware(): ExpressMiddleware[] {
    const middleware: ExpressMiddleware[] = []

    // Security headers
    if (this.config.security?.customHeaders) {
      middleware.push(this.createSecurityHeaders())
    }

    // Body parsing middleware
    middleware.push(...this.createBodyParsers())

    // File upload middleware
    middleware.push(this.createFileUploadMiddleware())

    // Error handling should be added by the user as the last middleware

    return middleware
  }

  /**
   * Create security headers middleware
   */
  private createSecurityHeaders(): ExpressMiddleware {
    const headers = this.config.security?.customHeaders || {}
    
    return (req: Request, res: Response, next: NextFunction) => {
      // Apply custom security headers
      for (const [header, value] of Object.entries(headers)) {
        res.setHeader(header, value)
      }
      
      // Basic security headers if not already set
      if (!res.getHeader('X-Content-Type-Options')) {
        res.setHeader('X-Content-Type-Options', 'nosniff')
      }
      
      if (!res.getHeader('X-Frame-Options')) {
        res.setHeader('X-Frame-Options', 'DENY')
      }
      
      if (!res.getHeader('X-XSS-Protection')) {
        res.setHeader('X-XSS-Protection', '1; mode=block')
      }
      
      next()
    }
  }

  /**
   * Create body parsing middleware
   */
  private createBodyParsers(): ExpressMiddleware[] {
    const middleware: ExpressMiddleware[] = []
    
    // JSON body parser
    const jsonConfig = this.config.bodyParser?.json || {}
    middleware.push(express.json({
      limit: jsonConfig.limit || '10mb',
      strict: jsonConfig.strict !== false,
      ...jsonConfig
    }))

    // URL-encoded body parser
    const urlencodedConfig = this.config.bodyParser?.urlencoded || {}
    middleware.push(express.urlencoded({
      limit: urlencodedConfig.limit || '10mb',
      extended: urlencodedConfig.extended !== false,
      ...urlencodedConfig
    }))

    return middleware
  }

  /**
   * Create file upload middleware using Multer
   */
  private createFileUploadMiddleware(): ExpressMiddleware {
    const uploadConfig = this.config.fileUpload || {}
    
    const storage = multer.memoryStorage() // Store files in memory for processing
    
    const upload = multer({
      storage,
      limits: {
        fileSize: uploadConfig.maxFileSize || 50 * 1024 * 1024, // 50MB default
        files: uploadConfig.maxFiles || 10
      },
      fileFilter: (req, file, cb) => {
        // Check allowed MIME types
        const allowedTypes = uploadConfig.allowedMimeTypes
        if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
          cb(new Error(`File type ${file.mimetype} is not allowed`))
          return
        }
        
        // Security: Check for dangerous file extensions (all extensions, not just the last one)
        const dangerousExts = [
          '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
          '.ps1', '.sh', '.php', '.jsp', '.asp', '.aspx', '.msi', '.dll', '.sys',
          '.bin', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.run', '.out'
        ]
        
        // Extract all extensions from filename (handles cases like file.tar.gz)
        const getAllExtensions = (filename: string): string[] => {
          const parts = filename.toLowerCase().split('.')
          if (parts.length <= 1) return []
          return parts.slice(1).map(ext => `.${ext}`)
        }
        
        const fileExtensions = getAllExtensions(file.originalname)
        const hasDangerousExtension = fileExtensions.some(ext => dangerousExts.includes(ext))
        
        if (hasDangerousExtension) {
          const foundDangerousExt = fileExtensions.find(ext => dangerousExts.includes(ext))
          cb(new Error(`File extension ${foundDangerousExt} is not allowed`))
          return
        }
        
        // Security: Check for path traversal in filename
        if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
          cb(new Error('Invalid filename. Path separators not allowed'))
          return
        }
        
        cb(null, true)
      }
    })

    // Return middleware that handles both single and multiple files
    return (req: Request, res: Response, next: NextFunction) => {
      // Use multer's array method to handle multiple files
      const uploadHandler = upload.array('files', uploadConfig.maxFiles || 10)
      
      uploadHandler(req, res, (err) => {
        if (err) {
          // Convert Multer errors to our error format
          if (err instanceof multer.MulterError) {
            switch (err.code) {
              case 'LIMIT_FILE_SIZE':
                return next(new Error(`File too large. Maximum size is ${uploadConfig.maxFileSize || 50 * 1024 * 1024} bytes`))
              case 'LIMIT_FILE_COUNT':
                return next(new Error(`Too many files. Maximum is ${uploadConfig.maxFiles || 10} files`))
              case 'LIMIT_UNEXPECTED_FILE':
                return next(new Error('Unexpected file field'))
              default:
                return next(new Error(`File upload error: ${err.message}`))
            }
          }
          return next(err)
        }
        
        next()
      })
    }
  }

  /**
   * Create error handling middleware
   */
  public static createErrorHandler(): ExpressErrorHandler {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      // Log error for debugging (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        console.error('Trokky Express Error:', err)
      }
      
      // Don't handle if response already sent
      if (res.headersSent) {
        return next(err)
      }
      
      // Determine error status and message
      let status = 500
      let message = err.message || 'Internal Server Error'
      
      if (err.message.includes('not allowed') || err.message.includes('Invalid')) {
        status = 400
        message = err.message
      } else if (err.message.includes('too large') || err.message.includes('Too many')) {
        status = 413
        message = err.message
      } else if (err.message.includes('not found')) {
        status = 404
        message = err.message
      }
      
      // Send error response
      res.status(status).json({
        success: false,
        error: {
          code: status === 400 ? 'BAD_REQUEST' : 
                status === 404 ? 'NOT_FOUND' :
                status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
          message
        }
      })
    }
  }
}