/**
 * Content Security Policy (CSP) header tests for CloudflareR2Adapter
 * 
 * Tests CSP header generation including:
 * - Content-type specific policies
 * - Extension-based rules
 * - Custom policy configurations
 * - Security header combinations
 * - Edge cases and validation
 */

import { CloudflareR2Adapter } from '../cloudflare-r2-adapter'
import { mockCreateLogger } from './fixtures/mocks'

jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/s3-request-presigner')
jest.mock('@trokky/core', () => ({
  InvalidInputError: class InvalidInputError extends Error {},
  SecurityValidator: {
    validateDocumentId: jest.fn(),
  },
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  generateUUID: () => 'csp-test-uuid',
}))

describe('CloudflareR2Adapter - CSP Headers Tests', () => {
  describe('CSP Header Generation', () => {
    test('should return null when CSP is disabled', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: false }
      })

      const csp = adapter.generateCSPHeader('text/html', 'test.html')
      expect(csp).toBeNull()
    })

    test('should return null when CSP config is not provided', () => {
      const adapter = new CloudflareR2Adapter({})

      const csp = adapter.generateCSPHeader('text/html', 'test.html')
      expect(csp).toBeNull()
    })

    test('should generate strict CSP for HTML files', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/html', 'test.html')
      
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("script-src 'none'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-src 'none'")
      expect(csp).toContain("style-src 'unsafe-inline'")
      expect(csp).toContain("img-src 'self' data:")
    })

    test('should detect HTML by extension', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('application/octet-stream', 'test.html')
      
      expect(csp).toContain("script-src 'none'")
      expect(csp).toContain("object-src 'none'")
    })

    test('should generate restrictive CSP for SVG files', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('image/svg+xml', 'icon.svg')
      
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("script-src 'none'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("style-src 'unsafe-inline'")
      expect(csp).toContain("img-src 'self'")
    })

    test('should generate CSS-safe policy for stylesheets', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/css', 'styles.css')
      
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
      expect(csp).toContain("font-src 'self'")
    })

    test('should completely block JavaScript files', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const jsTypes = [
        'application/javascript',
        'text/javascript',
      ]

      const jsExtensions = [
        { type: 'text/plain', filename: 'script.js' },
        { type: 'text/plain', filename: 'module.mjs' }
      ]

      for (const type of jsTypes) {
        const csp = adapter.generateCSPHeader(type, 'script.js')
        expect(csp).toContain("script-src 'none'")
        expect(csp).toContain("default-src 'none'")
      }

      for (const { type, filename } of jsExtensions) {
        const csp = adapter.generateCSPHeader(type, filename)
        expect(csp).toContain("script-src 'none'")
      }
    })

    test('should secure JSON files', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('application/json', 'data.json')
      
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("script-src 'none'")
    })

    test('should handle Markdown files safely', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/markdown', 'README.md')
      
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("script-src 'none'")
      expect(csp).toContain("style-src 'unsafe-inline'")
      expect(csp).toContain("img-src 'self' data:")
    })

    test('should allow PDF viewer functionality', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('application/pdf', 'document.pdf')
      
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'none'")
      expect(csp).toContain("object-src 'self'")
    })

    test('should secure media files', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const mediaTypes = [
        'image/jpeg',
        'image/png', 
        'video/mp4',
        'audio/mpeg'
      ]

      for (const type of mediaTypes) {
        const csp = adapter.generateCSPHeader(type, 'media.file')
        expect(csp).toContain("default-src 'none'")
        expect(csp).toContain("script-src 'none'")
        expect(csp).toContain("media-src 'self'")
        expect(csp).toContain("img-src 'self'")
      }
    })
  })

  describe('Custom CSP Policies', () => {
    test('should use custom policy for specific content types', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: {
          enabled: true,
          policies: {
            'text/html': "default-src 'self'; script-src 'unsafe-eval'"
          }
        }
      })

      const csp = adapter.generateCSPHeader('text/html', 'custom.html')
      
      expect(csp).toBe("default-src 'self'; script-src 'unsafe-eval'")
    })

    test('should apply default policy for unknown types', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: {
          enabled: true,
          defaultPolicy: "default-src 'self'"
        }
      })

      const csp = adapter.generateCSPHeader('application/unknown', 'unknown.file')
      
      expect(csp).toContain("default-src 'self'")
    })

    test('should add additional directives', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: {
          enabled: true,
          additionalDirectives: [
            "connect-src 'self'",
            "form-action 'self'"
          ]
        }
      })

      const csp = adapter.generateCSPHeader('text/css', 'styles.css')
      
      expect(csp).toContain("connect-src 'self'")
      expect(csp).toContain("form-action 'self'")
    })

    test('should add report-uri when configured', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: {
          enabled: true,
          reportUri: 'https://example.com/csp-report'
        }
      })

      const csp = adapter.generateCSPHeader('text/html', 'test.html')
      
      expect(csp).toContain('report-uri https://example.com/csp-report')
    })

    test('should combine all CSP features', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: {
          enabled: true,
          defaultPolicy: "default-src 'self'",
          additionalDirectives: ["connect-src 'none'"],
          reportUri: 'https://csp.example.com/report'
        }
      })

      const csp = adapter.generateCSPHeader('text/css', 'styles.css')
      
      expect(csp).toContain("default-src 'none'") // Type-specific policy
      expect(csp).toContain("style-src 'self' 'unsafe-inline'") // Type-specific
      expect(csp).toContain("connect-src 'none'") // Additional directive
      expect(csp).toContain("report-uri https://csp.example.com/report") // Report URI
    })
  })

  describe('Security Headers Integration', () => {
    test('should include CSP in security headers when enabled', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const headers = adapter.getSecurityHeaders('text/html', 'test.html')
      
      expect(headers['Content-Security-Policy']).toBeDefined()
      expect(headers['Content-Security-Policy']).toContain("script-src 'none'")
    })

    test('should not include CSP when disabled', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: false }
      })

      const headers = adapter.getSecurityHeaders('text/html', 'test.html')
      
      expect(headers['Content-Security-Policy']).toBeUndefined()
    })

    test('should include additional security headers for HTML', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const headers = adapter.getSecurityHeaders('text/html', 'test.html')
      
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('DENY')
      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
    })

    test('should include security headers for SVG', () => {
      const adapter = new CloudflareR2Adapter({})

      const headers = adapter.getSecurityHeaders('image/svg+xml', 'icon.svg')
      
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN')
    })

    test('should include strict headers for JavaScript', () => {
      const adapter = new CloudflareR2Adapter({})

      const headers = adapter.getSecurityHeaders('application/javascript', 'script.js')
      
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate')
    })

    test('should return empty headers for safe content types', () => {
      const adapter = new CloudflareR2Adapter({})

      const headers = adapter.getSecurityHeaders('image/jpeg', 'photo.jpg')
      
      expect(Object.keys(headers)).toHaveLength(0)
    })
  })

  describe('Edge Cases and Validation', () => {
    test('should handle missing filename gracefully', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/html')
      
      expect(csp).toContain("script-src 'none'") // Should still apply HTML rules
    })

    test('should handle files without extensions', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/plain', 'README')
      
      expect(csp).toBe("default-src 'none'") // Should use fallback
    })

    test('should handle empty extension gracefully', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/plain', 'file.')
      
      expect(csp).toBe("default-src 'none'")
    })

    test('should use fallback for unknown types with no default', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('application/unknown', 'unknown.xyz')
      
      expect(csp).toBe("default-src 'none'")
    })

    test('should handle case-insensitive extensions', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/plain', 'SCRIPT.JS')
      
      expect(csp).toContain("script-src 'none'") // Should detect .js extension
    })

    test('should handle complex filenames', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp = adapter.generateCSPHeader('text/plain', 'my-file.backup.js')
      
      expect(csp).toContain("script-src 'none'") // Should detect final .js extension
    })
  })

  describe('Performance and Efficiency', () => {
    test('should cache-friendly for repeated calls', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const csp1 = adapter.generateCSPHeader('text/html', 'test.html')
      const csp2 = adapter.generateCSPHeader('text/html', 'test.html')
      
      expect(csp1).toBe(csp2)
    })

    test('should handle bulk header generation efficiently', () => {
      const adapter = new CloudflareR2Adapter({
        cspConfig: { enabled: true }
      })

      const fileTypes = [
        'text/html', 'text/css', 'application/javascript',
        'image/svg+xml', 'application/json', 'text/markdown',
        'application/pdf', 'image/jpeg', 'video/mp4'
      ]

      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        const type = fileTypes[i % fileTypes.length]
        adapter.generateCSPHeader(type, `file${i}.ext`)
      }
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})