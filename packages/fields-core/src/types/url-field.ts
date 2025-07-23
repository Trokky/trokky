/**
 * URL Field Type Implementation
 * URL field with protocol validation, domain restrictions, and formatting
 */

import type { FieldType, ValidationResult, FieldContext } from '@trokky/core'
import { FieldCategory } from '@trokky/core'
import { createValidationResult, createValidationError, getFieldPath } from '../utils/validation.js'

export interface URLFieldConfig {
  // Allow empty URL
  allowEmpty?: boolean
  
  // Allowed protocols
  allowedProtocols?: string[]
  
  // Require HTTPS
  requireHTTPS?: boolean
  
  // Allowed domains (whitelist)
  allowedDomains?: string[]
  
  // Blocked domains (blacklist)  
  blockedDomains?: string[]
  
  // Require specific domain patterns
  domainPattern?: string
  
  // Maximum length
  maxLength?: number
  
  // Allow relative URLs (without protocol)
  allowRelative?: boolean
  
  // Allow localhost URLs
  allowLocalhost?: boolean
  
  // Allow IP addresses
  allowIPAddress?: boolean
  
  // Require path (e.g., /path)
  requirePath?: boolean
  
  // Allow fragment identifiers (#section)
  allowFragment?: boolean
  
  // Allow query parameters (?param=value)
  allowQuery?: boolean
  
  // Custom validation function
  customValidator?: (url: string) => boolean | string
  
  // Auto-add protocol if missing
  defaultProtocol?: string
  
  // Normalize URL (lowercase domain, etc.)
  normalize?: boolean
  
  // Placeholder text
  placeholder?: string
}

// Default URL configuration
const DEFAULT_URL_CONFIG: Required<Omit<URLFieldConfig, 'allowedDomains' | 'blockedDomains' | 'domainPattern' | 'customValidator' | 'defaultProtocol' | 'placeholder'>> = {
  allowEmpty: false,
  allowedProtocols: ['http', 'https'],
  requireHTTPS: false,
  maxLength: 2048, // Common browser limit
  allowRelative: false,
  allowLocalhost: false,
  allowIPAddress: true,
  requirePath: false,
  allowFragment: true,
  allowQuery: true,
  normalize: true
}

// URL validation regex patterns (simplified for security)
const URL_PATTERNS = {
  // Complete URL with protocol - simplified
  fullURL: /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/,
  
  // Protocol pattern - simplified
  protocol: /^[a-zA-Z][a-zA-Z0-9+.-]*:/,
  
  // Domain pattern - simplified but not allowing just dots
  domain: /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/,
  
  // IP address pattern (IPv4) - simplified for security
  ipv4: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  
  // IPv6 pattern - simplified for security
  ipv6: /^[0-9a-fA-F:]+$/,
  
  // Localhost patterns
  localhost: /^(localhost|127\.0\.0\.1|::1)$/,
  
  // Relative URL pattern
  relative: /^\/[^\/\s]*$/
}

// Common protocols
const COMMON_PROTOCOLS = ['http', 'https', 'ftp', 'ftps', 'mailto', 'tel', 'file']

// Validate URL format
function validateURLFormat(url: string, config: URLFieldConfig): { valid: boolean; error?: string; parsed?: URL | null } {
  try {
    // Handle relative URLs
    if (config.allowRelative && url.startsWith('/')) {
      return { valid: true, parsed: null }
    }
    
    // Try to parse the URL
    let urlToParse = url
    
    // Add default protocol if missing and allowed
    if (config.defaultProtocol && !URL_PATTERNS.protocol.test(url)) {
      urlToParse = `${config.defaultProtocol}://${url}`
    }
    
    const parsed = new URL(urlToParse)
    
    // Validate protocol
    const protocol = parsed.protocol.slice(0, -1) // Remove trailing colon
    if (config.allowedProtocols && !config.allowedProtocols.includes(protocol)) {
      return { valid: false, error: `Protocol '${protocol}' is not allowed. Allowed protocols: ${config.allowedProtocols.join(', ')}` }
    }
    
    // Check HTTPS requirement
    if (config.requireHTTPS && protocol !== 'https') {
      return { valid: false, error: 'HTTPS is required' }
    }
    
    // Validate hostname
    const hostname = parsed.hostname.toLowerCase()
    
    // Check localhost
    if (!config.allowLocalhost && URL_PATTERNS.localhost.test(hostname)) {
      return { valid: false, error: 'Localhost URLs are not allowed' }
    }
    
    // Check IP addresses
    if (!config.allowIPAddress && (URL_PATTERNS.ipv4.test(hostname) || URL_PATTERNS.ipv6.test(hostname))) {
      return { valid: false, error: 'IP addresses are not allowed' }
    }
    
    // Validate domain format (if not IP address)
    if (!URL_PATTERNS.ipv4.test(hostname) && !URL_PATTERNS.ipv6.test(hostname) && !URL_PATTERNS.localhost.test(hostname)) {
      if (!URL_PATTERNS.domain.test(hostname)) {
        return { valid: false, error: 'Invalid domain format' }
      }
    }
    
    // Check path requirement
    if (config.requirePath && (!parsed.pathname || parsed.pathname === '/')) {
      return { valid: false, error: 'URL must include a path' }
    }
    
    // Check fragment allowance
    if (!config.allowFragment && parsed.hash) {
      return { valid: false, error: 'Fragment identifiers are not allowed' }
    }
    
    // Check query allowance
    if (!config.allowQuery && parsed.search) {
      return { valid: false, error: 'Query parameters are not allowed' }
    }
    
    return { valid: true, parsed }
    
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' }
  }
}

// Validate domain restrictions
function validateDomainRestrictions(hostname: string, config: URLFieldConfig): { valid: boolean; error?: string } {
  const domain = hostname.toLowerCase()
  
  // Check allowed domains
  if (config.allowedDomains && config.allowedDomains.length > 0) {
    const isAllowed = config.allowedDomains.some(allowedDomain => {
      const allowed = allowedDomain.toLowerCase()
      return domain === allowed || domain.endsWith('.' + allowed)
    })
    
    if (!isAllowed) {
      return { valid: false, error: `Domain must be one of: ${config.allowedDomains.join(', ')}` }
    }
  }
  
  // Check blocked domains
  if (config.blockedDomains && config.blockedDomains.length > 0) {
    const isBlocked = config.blockedDomains.some(blockedDomain => {
      const blocked = blockedDomain.toLowerCase()
      return domain === blocked || domain.endsWith('.' + blocked)
    })
    
    if (isBlocked) {
      return { valid: false, error: `Domain '${domain}' is not allowed` }
    }
  }
  
  // Check domain pattern
  if (config.domainPattern) {
    const regex = new RegExp(config.domainPattern)
    if (!regex.test(domain)) {
      return { valid: false, error: 'Domain does not match required pattern' }
    }
  }
  
  return { valid: true }
}

// Normalize URL
function normalizeURL(url: string, config: URLFieldConfig): string {
  if (!config.normalize) {
    return url.trim()
  }
  
  try {
    // Handle relative URLs
    if (config.allowRelative && url.startsWith('/')) {
      return url.trim()
    }
    
    let urlToNormalize = url.trim()
    
    // Add default protocol if missing
    if (config.defaultProtocol && !URL_PATTERNS.protocol.test(urlToNormalize)) {
      urlToNormalize = `${config.defaultProtocol}://${urlToNormalize}`
    }
    
    const parsed = new URL(urlToNormalize)
    
    // Normalize components
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.protocol = parsed.protocol.toLowerCase()
    
    // Remove default ports
    if ((parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = ''
    }
    
    // Remove trailing slash from pathname if it's just '/'
    if (parsed.pathname === '/' && !config.requirePath) {
      parsed.pathname = ''
    }
    
    return parsed.toString()
    
  } catch (error) {
    // If normalization fails, return the original URL trimmed
    return url.trim()
  }
}

export const URLFieldType: FieldType<URLFieldConfig, string> = {
  name: 'url',
  category: FieldCategory.TEXT,
  description: 'URL field with protocol validation, domain restrictions, and formatting',

  validate(value: string, config: URLFieldConfig, context: FieldContext): ValidationResult {
    const fieldConfig = { ...DEFAULT_URL_CONFIG, ...config }
    const fieldPath = getFieldPath(context)
    const errors = []

    // Handle null/undefined values
    if (value == null || value === '') {
      if (!fieldConfig.allowEmpty) {
        errors.push(createValidationError(
          fieldPath,
          'URL is required',
          'REQUIRED'
        ))
      }
      return createValidationResult(errors)
    }

    // Ensure value is a string
    if (typeof value !== 'string') {
      errors.push(createValidationError(
        fieldPath,
        'URL must be a string',
        'INVALID_TYPE'
      ))
      return createValidationResult(errors)
    }

    const url = value.trim()

    // Length validation
    if (url.length > fieldConfig.maxLength) {
      errors.push(createValidationError(
        fieldPath,
        `URL is too long (max ${fieldConfig.maxLength} characters)`,
        'MAX_LENGTH'
      ))
    }

    // Format validation
    const formatValidation = validateURLFormat(url, fieldConfig)
    if (!formatValidation.valid) {
      errors.push(createValidationError(
        fieldPath,
        formatValidation.error || 'Invalid URL format',
        'INVALID_FORMAT'
      ))
    }

    // Domain restrictions validation (only for parsed URLs)
    if (formatValidation.valid && formatValidation.parsed) {
      const domainValidation = validateDomainRestrictions(formatValidation.parsed.hostname, fieldConfig)
      if (!domainValidation.valid) {
        errors.push(createValidationError(
          fieldPath,
          domainValidation.error || 'Domain not allowed',
          'INVALID_DOMAIN'
        ))
      }
    }

    // Custom validation
    if (fieldConfig.customValidator && formatValidation.valid) {
      const customResult = fieldConfig.customValidator(url)
      if (customResult === false) {
        errors.push(createValidationError(
          fieldPath,
          'URL failed custom validation',
          'CUSTOM_VALIDATION'
        ))
      } else if (typeof customResult === 'string') {
        errors.push(createValidationError(
          fieldPath,
          customResult,
          'CUSTOM_VALIDATION'
        ))
      }
    }

    return createValidationResult(errors)
  },

  serialize(value: string, config: URLFieldConfig): string {
    if (!value || typeof value !== 'string') {
      return ''
    }
    
    return normalizeURL(value, config)
  },

  deserialize(data: any, config: URLFieldConfig): string {
    if (data == null) {
      return ''
    }
    
    if (typeof data === 'string') {
      return normalizeURL(data, config)
    }
    
    // Convert other types to string and normalize
    const stringValue = String(data)
    return normalizeURL(stringValue, config)
  },

  defaultValue: ''
}

// Helper functions for working with URL fields
export function createURLField(config: Partial<URLFieldConfig> = {}) {
  return {
    type: 'url',
    config: { ...DEFAULT_URL_CONFIG, ...config }
  }
}

export function createHTTPSURLField(config: Partial<URLFieldConfig> = {}) {
  return createURLField({
    requireHTTPS: true,
    allowedProtocols: ['https'],
    ...config
  })
}

export function createWebsiteURLField(config: Partial<URLFieldConfig> = {}) {
  return createURLField({
    allowedProtocols: ['http', 'https'],
    defaultProtocol: 'https',
    ...config
  })
}

export function createInternalURLField(allowedDomains: string[], config: Partial<URLFieldConfig> = {}) {
  return createURLField({
    allowedDomains,
    ...config
  })
}

// Utility functions
export function validateURL(url: string, config: Partial<URLFieldConfig> = {}): boolean {
  const fieldConfig = { ...DEFAULT_URL_CONFIG, ...config }
  
  if (!url || typeof url !== 'string') {
    return fieldConfig.allowEmpty
  }
  
  const formatValidation = validateURLFormat(url, fieldConfig)
  if (!formatValidation.valid) {
    return false
  }
  
  if (formatValidation.parsed) {
    const domainValidation = validateDomainRestrictions(formatValidation.parsed.hostname, fieldConfig)
    return domainValidation.valid
  }
  
  return true
}

export function parseURL(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function extractDomain(url: string): string | null {
  const parsed = parseURL(url)
  return parsed ? parsed.hostname.toLowerCase() : null
}

export function extractProtocol(url: string): string | null {
  const parsed = parseURL(url)
  return parsed ? parsed.protocol.slice(0, -1) : null
}

export function isSecureURL(url: string): boolean {
  const protocol = extractProtocol(url)
  return protocol === 'https'
}

export function isRelativeURL(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

export function joinURL(base: string, path: string): string {
  try {
    const baseURL = new URL(base)
    return new URL(path, baseURL).toString()
  } catch {
    // Fallback to simple string concatenation
    const separator = base.endsWith('/') || path.startsWith('/') ? '' : '/'
    return base + separator + path
  }
}

export function addProtocol(url: string, protocol: string = 'https'): string {
  if (URL_PATTERNS.protocol.test(url)) {
    return url
  }
  
  return `${protocol}://${url}`
}

export function removeProtocol(url: string): string {
  try {
    const parsed = new URL(url)
    return url.replace(parsed.protocol + '//', '')
  } catch {
    return url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
  }
}

export function getURLPath(url: string): string | null {
  const parsed = parseURL(url)
  return parsed ? parsed.pathname : null
}

export function getURLQuery(url: string): Record<string, string> | null {
  const parsed = parseURL(url)
  if (!parsed) return null
  
  const params: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    params[key] = value
  })
  
  return params
}

export function addQueryParam(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set(key, value)
    return parsed.toString()
  } catch {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  }
}

export function removeQueryParam(url: string, key: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.delete(key)
    return parsed.toString()
  } catch {
    return url
  }
}

// URL shortener detection
const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 'short.link', 'ow.ly', 't.co', 'goo.gl', 
  'is.gd', 'buff.ly', 'tiny.cc', 'rb.gy', 'cutt.ly', 'short.io'
]

export function isShortURL(url: string): boolean {
  const domain = extractDomain(url)
  return domain ? URL_SHORTENERS.includes(domain) : false
}

// Common URL patterns
export function isSocialMediaURL(url: string): boolean {
  const domain = extractDomain(url)
  if (!domain) return false
  
  const socialDomains = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'reddit.com'
  ]
  
  return socialDomains.some(social => domain === social || domain.endsWith('.' + social))
}

export function isImageURL(url: string): boolean {
  const path = getURLPath(url)
  if (!path) return false
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  return imageExtensions.some(ext => path.toLowerCase().endsWith(ext))
}