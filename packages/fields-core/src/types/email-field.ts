/**
 * Email Field Type Implementation
 * Email address field with validation, formatting, and domain restrictions
 */

import type { FieldType, ValidationResult, FieldContext } from '@trokky/core'
import { FieldCategory } from '@trokky/core'
import { createValidationResult, createValidationError, getFieldPath } from '../utils/validation'

export interface EmailFieldConfig {
  // Allow empty email
  allowEmpty?: boolean
  
  // Convert to lowercase automatically
  lowercase?: boolean
  
  // Allowed domains (whitelist)
  allowedDomains?: string[]
  
  // Blocked domains (blacklist)
  blockedDomains?: string[]
  
  // Maximum length
  maxLength?: number
  
  // Require specific domain patterns
  domainPattern?: string
  
  // Custom validation function
  customValidator?: (email: string) => boolean | string
  
  // Allow internationalized domain names (IDN)
  allowIDN?: boolean
  
  // Require MX record validation (async validation)
  requireMX?: boolean
  
  // Allow plus addressing (e.g., user+tag@domain.com)
  allowPlusAddressing?: boolean
  
  // Allow quoted local parts
  allowQuotedLocal?: boolean
  
  // Placeholder text
  placeholder?: string
}

// Default email configuration
const DEFAULT_EMAIL_CONFIG: Required<Omit<EmailFieldConfig, 'allowedDomains' | 'blockedDomains' | 'domainPattern' | 'customValidator' | 'placeholder'>> = {
  allowEmpty: false,
  lowercase: true,
  maxLength: 254, // RFC 5321 limit
  allowIDN: true,
  requireMX: false,
  allowPlusAddressing: true,
  allowQuotedLocal: false
}

// Email validation regex patterns (simplified for security)
const EMAIL_REGEX = {
  // Basic email pattern (simple and safe)
  basic: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Strict email pattern (more restrictive but safe)
  strict: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // Local part (before @) - simplified
  localPart: /^[a-zA-Z0-9._%+-]+$/,
  
  // Domain part (after @) - simplified
  domain: /^[a-zA-Z0-9.-]+$/,
  
  // Plus addressing pattern - simplified
  plusAddressing: /^[a-zA-Z0-9._%+-]+\+[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // Quoted local part - simplified
  quotedLocal: /^"[^"@]+"@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
}

// Common email providers
const COMMON_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'yandex.com', 'zoho.com'
]

// Disposable email domains (commonly used temporary email services)
const DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'getnada.com', 'mohmal.com'
]

// Validate email format
function validateEmailFormat(email: string, config: EmailFieldConfig): { valid: boolean; error?: string } {
  // Basic format validation
  if (!EMAIL_REGEX.basic.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  // Split email into local and domain parts
  const [localPart, domainPart] = email.split('@')
  
  if (!localPart || !domainPart) {
    return { valid: false, error: 'Email must contain both local and domain parts' }
  }
  
  // Validate local part length (64 characters max per RFC 5321)
  if (localPart.length > 64) {
    return { valid: false, error: 'Local part of email is too long (max 64 characters)' }
  }
  
  // Validate domain part length (253 characters max per RFC 5321)
  if (domainPart.length > 253) {
    return { valid: false, error: 'Domain part of email is too long (max 253 characters)' }
  }
  
  // Check for consecutive dots
  if (localPart.includes('..') || domainPart.includes('..')) {
    return { valid: false, error: 'Email cannot contain consecutive dots' }
  }
  
  // Check for leading/trailing dots in local part
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'Local part cannot start or end with a dot' }
  }
  
  // Validate plus addressing if not allowed
  if (!config.allowPlusAddressing && localPart.includes('+')) {
    return { valid: false, error: 'Plus addressing is not allowed' }
  }
  
  // Validate quoted local parts if not allowed
  if (!config.allowQuotedLocal && localPart.startsWith('"') && localPart.endsWith('"')) {
    return { valid: false, error: 'Quoted local parts are not allowed' }
  }
  
  // Validate domain format
  if (!EMAIL_REGEX.domain.test(domainPart)) {
    return { valid: false, error: 'Invalid domain format' }
  }
  
  // Check for valid TLD (domain must contain at least one dot)
  const domainParts = domainPart.split('.')
  if (domainParts.length < 2) {
    return { valid: false, error: 'Domain must have a valid top-level domain' }
  }
  
  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) {
    return { valid: false, error: 'Domain must have a valid top-level domain' }
  }
  
  return { valid: true }
}

// Validate domain restrictions
function validateDomainRestrictions(email: string, config: EmailFieldConfig): { valid: boolean; error?: string } {
  const domain = email.split('@')[1]?.toLowerCase()
  
  if (!domain) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  // Check allowed domains
  if (config.allowedDomains && config.allowedDomains.length > 0) {
    const isAllowed = config.allowedDomains.some(allowedDomain => 
      domain === allowedDomain.toLowerCase() || domain.endsWith('.' + allowedDomain.toLowerCase())
    )
    
    if (!isAllowed) {
      return { valid: false, error: `Email domain must be one of: ${config.allowedDomains.join(', ')}` }
    }
  }
  
  // Check blocked domains
  if (config.blockedDomains && config.blockedDomains.length > 0) {
    const isBlocked = config.blockedDomains.some(blockedDomain => 
      domain === blockedDomain.toLowerCase() || domain.endsWith('.' + blockedDomain.toLowerCase())
    )
    
    if (isBlocked) {
      return { valid: false, error: `Email domain '${domain}' is not allowed` }
    }
  }
  
  // Check domain pattern
  if (config.domainPattern) {
    const regex = new RegExp(config.domainPattern)
    if (!regex.test(domain)) {
      return { valid: false, error: 'Email domain does not match required pattern' }
    }
  }
  
  return { valid: true }
}

// Format email address
function formatEmail(email: string, config: EmailFieldConfig): string {
  let formatted = email.trim()
  
  // Convert to lowercase if configured
  if (config.lowercase) {
    formatted = formatted.toLowerCase()
  }
  
  return formatted
}

export const EmailFieldType: FieldType<EmailFieldConfig, string> = {
  name: 'email',
  category: FieldCategory.TEXT,
  description: 'Email address field with validation, formatting, and domain restrictions',

  validate(value: string, config: EmailFieldConfig, context: FieldContext): ValidationResult {
    const fieldConfig = { ...DEFAULT_EMAIL_CONFIG, ...config }
    const fieldPath = getFieldPath(context)
    const errors = []

    // Handle null/undefined values
    if (value == null || value === '') {
      if (!fieldConfig.allowEmpty) {
        errors.push(createValidationError(
          fieldPath,
          'Email address is required',
          'REQUIRED'
        ))
      }
      return createValidationResult(errors)
    }

    // Ensure value is a string
    if (typeof value !== 'string') {
      errors.push(createValidationError(
        fieldPath,
        'Email must be a string',
        'INVALID_TYPE'
      ))
      return createValidationResult(errors)
    }

    const email = value.trim()

    // Length validation
    if (email.length > fieldConfig.maxLength) {
      errors.push(createValidationError(
        fieldPath,
        `Email address is too long (max ${fieldConfig.maxLength} characters)`,
        'MAX_LENGTH'
      ))
    }

    // Format validation
    const formatValidation = validateEmailFormat(email, fieldConfig)
    if (!formatValidation.valid) {
      errors.push(createValidationError(
        fieldPath,
        formatValidation.error || 'Invalid email format',
        'INVALID_FORMAT'
      ))
    }

    // Domain restrictions validation
    if (formatValidation.valid) {
      const domainValidation = validateDomainRestrictions(email, fieldConfig)
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
      const customResult = fieldConfig.customValidator(email)
      if (customResult === false) {
        errors.push(createValidationError(
          fieldPath,
          'Email failed custom validation',
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

  serialize(value: string, config: EmailFieldConfig): string {
    if (!value || typeof value !== 'string') {
      return ''
    }
    
    return formatEmail(value, config)
  },

  deserialize(data: any, config: EmailFieldConfig): string {
    if (data == null) {
      return ''
    }
    
    if (typeof data === 'string') {
      return formatEmail(data, config)
    }
    
    // Convert other types to string and format
    const stringValue = String(data)
    return formatEmail(stringValue, config)
  },

  defaultValue: ''
}

// Helper functions for working with email fields
export function createEmailField(config: Partial<EmailFieldConfig> = {}) {
  return {
    type: 'email',
    config: { ...DEFAULT_EMAIL_CONFIG, ...config }
  }
}

export function createRequiredEmailField(config: Partial<EmailFieldConfig> = {}) {
  return createEmailField({
    allowEmpty: false,
    ...config
  })
}

export function createOptionalEmailField(config: Partial<EmailFieldConfig> = {}) {
  return createEmailField({
    allowEmpty: true,
    ...config
  })
}

export function createCorporateEmailField(allowedDomains: string[], config: Partial<EmailFieldConfig> = {}) {
  return createEmailField({
    allowedDomains,
    ...config
  })
}

// Utility functions
export function validateEmail(email: string, config: Partial<EmailFieldConfig> = {}): boolean {
  const fieldConfig = { ...DEFAULT_EMAIL_CONFIG, ...config }
  
  if (!email || typeof email !== 'string') {
    return fieldConfig.allowEmpty
  }
  
  const formatValidation = validateEmailFormat(email, fieldConfig)
  if (!formatValidation.valid) {
    return false
  }
  
  const domainValidation = validateDomainRestrictions(email, fieldConfig)
  return domainValidation.valid
}

export function extractDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null
  }
  
  const parts = email.split('@')
  return parts.length === 2 ? parts[1].toLowerCase() : null
}

export function extractLocalPart(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null
  }
  
  const parts = email.split('@')
  return parts.length === 2 ? parts[0] : null
}

export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(email)
  return domain ? DISPOSABLE_EMAIL_DOMAINS.includes(domain) : false
}

export function isCommonProvider(email: string): boolean {
  const domain = extractDomain(email)
  return domain ? COMMON_EMAIL_PROVIDERS.includes(domain) : false
}

export function normalizeEmail(email: string, options: { 
  lowercase?: boolean
  removeDots?: boolean
  removeSubaddress?: boolean
} = {}): string {
  if (!email || typeof email !== 'string') {
    return ''
  }
  
  let normalized = email.trim()
  
  if (options.lowercase !== false) {
    normalized = normalized.toLowerCase()
  }
  
  const [localPart, domain] = normalized.split('@')
  if (!localPart || !domain) {
    return normalized
  }
  
  let processedLocal = localPart
  
  // Remove dots from Gmail addresses (gmail ignores dots in local part)
  if (options.removeDots && domain === 'gmail.com') {
    processedLocal = processedLocal.replace(/\./g, '')
  }
  
  // Remove subaddressing (plus addressing)
  if (options.removeSubaddress) {
    const plusIndex = processedLocal.indexOf('+')
    if (plusIndex > 0) {
      processedLocal = processedLocal.substring(0, plusIndex)
    }
  }
  
  return `${processedLocal}@${domain}`
}

// Email suggestions for typos in common domains
export function suggestEmailCorrection(email: string): string[] {
  const domain = extractDomain(email)
  if (!domain) {
    return []
  }
  
  const suggestions: string[] = []
  const localPart = extractLocalPart(email)
  
  if (!localPart) {
    return []
  }
  
  // Common typo corrections
  const domainCorrections: Record<string, string[]> = {
    'gmial.com': ['gmail.com'],
    'gmai.com': ['gmail.com'],
    'yahooo.com': ['yahoo.com'],
    'hotmial.com': ['hotmail.com'],
    'outlok.com': ['outlook.com'],
    'outloo.com': ['outlook.com']
  }
  
  // Check for exact matches in corrections
  if (domainCorrections[domain]) {
    domainCorrections[domain].forEach(corrected => {
      suggestions.push(`${localPart}@${corrected}`)
    })
  }
  
  // Check for similar domains using Levenshtein distance
  COMMON_EMAIL_PROVIDERS.forEach(provider => {
    if (levenshteinDistance(domain, provider) === 1) {
      suggestions.push(`${localPart}@${provider}`)
    }
  })
  
  return suggestions
}

// Simple Levenshtein distance calculation
function levenshteinDistance(a: string, b: string): number {
  const matrix = []
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[b.length][a.length]
}