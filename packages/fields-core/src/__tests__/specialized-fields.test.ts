/**
 * Specialized Field Types Tests
 * Tests for slug, email, URL, image, and file field types
 */

import {
  SlugFieldType,
  slugify,
  validateSlug,
  createSlugField,
  createAutoSlugField
} from '../types/slug-field'

import {
  EmailFieldType,
  validateEmail,
  extractDomain,
  extractLocalPart,
  normalizeEmail,
  createEmailField,
  createCorporateEmailField
} from '../types/email-field'

import {
  URLFieldType,
  validateURL,
  parseURL,
  extractDomain as extractURLDomain,
  isSecureURL,
  createURLField,
  createHTTPSURLField
} from '../types/url-field'

import {
  ImageFieldType,
  createImageField,
  createProfileImageField,
  createImageValue
} from '../types/image-field'

import {
  FileFieldType,
  createFileField,
  createDocumentField,
  getFileTypeCategory,
  sanitizeFilename
} from '../types/file-field'

// Mock field context for testing
const mockContext = {
  document: {},
  fieldPath: ['test'],
  user: { 
    id: 'user1',
    username: 'testuser',
    email: 'test@example.com', 
    firstName: 'Test', 
    lastName: 'User', 
    passwordHash: 'hash',
    role: 'viewer' as const,
    permissions: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  permissions: [],
  userRole: 'viewer' as const,
  httpClient: {} as any,
  apiClient: {} as any,
  getValue: jest.fn(),
  setValue: jest.fn(),
  getFieldConfig: jest.fn(),
  errors: [],
  touched: {},
  isStudio: false,
  isPreview: false,
  emit: jest.fn(),
  on: jest.fn()
}

describe('Specialized Field Types', () => {

  describe('Slug Field Type', () => {
    const defaultConfig = { allowEmpty: false, maxLength: 200, minLength: 1 }

    it('should have correct basic properties', () => {
      expect(SlugFieldType.name).toBe('slug')
      expect(SlugFieldType.category).toBe('text')
      expect(SlugFieldType.description).toContain('URL-safe string')
      expect(SlugFieldType.defaultValue).toBe('')
    })

    it('should validate valid slugs', async () => {
      const validSlugs = ['hello-world', 'my-page', 'test123', 'a']
      
      for (const slug of validSlugs) {
        const result = await SlugFieldType.validate(slug, defaultConfig, mockContext)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      }
    })

    it('should reject invalid slugs', async () => {
      const invalidSlugs = ['', 'hello world', 'test@example', '-start', 'end-', 'test--double']
      
      for (const slug of invalidSlugs) {
        const result = await SlugFieldType.validate(slug, defaultConfig, mockContext)
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    it('should validate slug length', async () => {
      const config = { ...defaultConfig, minLength: 3, maxLength: 10 }
      
      // Too short
      const shortResult = await SlugFieldType.validate('ab', config, mockContext)
      expect(shortResult.valid).toBe(false)
      expect(shortResult.errors[0].code).toBe('MIN_LENGTH')
      
      // Too long
      const longResult = await SlugFieldType.validate('this-is-way-too-long', config, mockContext)
      expect(longResult.valid).toBe(false)
      expect(longResult.errors[0].code).toBe('MAX_LENGTH')
    })

    it('should serialize and deserialize correctly', () => {
      const slug = 'test-slug'
      
      const serialized = SlugFieldType.serialize(slug, defaultConfig)
      expect(serialized).toBe('test-slug')
      
      const deserialized = SlugFieldType.deserialize('  test-slug  ', defaultConfig)
      expect(deserialized).toBe('test-slug')
    })

    it('should handle null values based on allowEmpty config', async () => {
      const requiredConfig = { ...defaultConfig, allowEmpty: false }
      const optionalConfig = { ...defaultConfig, allowEmpty: true }
      
      const requiredResult = await SlugFieldType.validate(null as any, requiredConfig, mockContext)
      expect(requiredResult.valid).toBe(false)
      expect(requiredResult.errors[0].code).toBe('REQUIRED')
      
      const optionalResult = await SlugFieldType.validate(null as any, optionalConfig, mockContext)
      expect(optionalResult.valid).toBe(true)
    })

    describe('utility functions', () => {
      it('should slugify text correctly', () => {
        expect(slugify('Hello World')).toBe('hello-world')
        expect(slugify('Test@Example.com')).toBe('testexamplecom')
        expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
        expect(slugify('Special!@#$%Characters')).toBe('specialcharacters')
      })

      it('should validate slug format', () => {
        expect(validateSlug('valid-slug')).toBe(true)
        expect(validateSlug('invalid slug')).toBe(false)
        expect(validateSlug('')).toBe(false)
        expect(validateSlug('-invalid')).toBe(false)
      })

      it('should create field configurations', () => {
        const basicField = createSlugField()
        expect(basicField.type).toBe('slug')
        
        const autoField = createAutoSlugField('title')
        expect(autoField.config.source).toBe('title')
        expect(autoField.config.readOnly).toBe(true)
      })
    })
  })

  describe('Email Field Type', () => {
    const defaultConfig = { allowEmpty: false, lowercase: true }

    it('should have correct basic properties', () => {
      expect(EmailFieldType.name).toBe('email')
      expect(EmailFieldType.category).toBe('text')
      expect(EmailFieldType.description).toContain('Email address')
      expect(EmailFieldType.defaultValue).toBe('')
    })

    it('should validate valid email addresses', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'user+tag@example.co.uk',
        'firstname.lastname@company.com'
      ]
      
      for (const email of validEmails) {
        const result = await EmailFieldType.validate(email, defaultConfig, mockContext)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      }
    })

    it('should reject invalid email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        ''
      ]
      
      for (const email of invalidEmails) {
        const result = await EmailFieldType.validate(email, defaultConfig, mockContext)
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    it('should enforce domain restrictions', async () => {
      const restrictedConfig = {
        ...defaultConfig,
        allowedDomains: ['company.com', 'partner.org']
      }
      
      const validResult = await EmailFieldType.validate('user@company.com', restrictedConfig, mockContext)
      expect(validResult.valid).toBe(true)
      
      const invalidResult = await EmailFieldType.validate('user@external.com', restrictedConfig, mockContext)
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors[0].code).toBe('INVALID_DOMAIN')
    })

    it('should handle blocked domains', async () => {
      const blockedConfig = {
        ...defaultConfig,
        blockedDomains: ['tempmail.org', '10minutemail.com']
      }
      
      const validResult = await EmailFieldType.validate('user@gmail.com', blockedConfig, mockContext)
      expect(validResult.valid).toBe(true)
      
      const blockedResult = await EmailFieldType.validate('user@tempmail.org', blockedConfig, mockContext)
      expect(blockedResult.valid).toBe(false)
      expect(blockedResult.errors[0].code).toBe('INVALID_DOMAIN')
    })

    it('should serialize with lowercase conversion', () => {
      const email = 'Test@Example.COM'
      const serialized = EmailFieldType.serialize(email, defaultConfig)
      expect(serialized).toBe('test@example.com')
    })

    describe('utility functions', () => {
      it('should extract domain correctly', () => {
        expect(extractDomain('user@example.com')).toBe('example.com')
        expect(extractDomain('invalid-email')).toBeNull()
      })

      it('should extract local part correctly', () => {
        expect(extractLocalPart('user@example.com')).toBe('user')
        expect(extractLocalPart('invalid-email')).toBeNull()
      })

      it('should normalize email addresses', () => {
        expect(normalizeEmail('User@Example.COM')).toBe('user@example.com')
        expect(normalizeEmail('user+tag@gmail.com', { removeSubaddress: true })).toBe('user@gmail.com')
      })

      it('should create field configurations', () => {
        const basicField = createEmailField()
        expect(basicField.type).toBe('email')
        
        const corporateField = createCorporateEmailField(['company.com'])
        expect(corporateField.config.allowedDomains).toEqual(['company.com'])
      })
    })
  })

  describe('URL Field Type', () => {
    const defaultConfig = { allowEmpty: false, allowedProtocols: ['http', 'https'] }

    it('should have correct basic properties', () => {
      expect(URLFieldType.name).toBe('url')
      expect(URLFieldType.category).toBe('text')
      expect(URLFieldType.description).toContain('URL field')
      expect(URLFieldType.defaultValue).toBe('')
    })

    it('should validate valid URLs', async () => {
      const validURLs = [
        'https://www.example.com',
        'http://example.org',
        'https://subdomain.example.com/path',
        'https://example.com:8080/path?query=value#fragment'
      ]
      
      for (const url of validURLs) {
        const result = await URLFieldType.validate(url, defaultConfig, mockContext)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      }
    })

    it('should reject invalid URLs', async () => {
      const invalidURLs = [
        'not-a-url',
        'ftp://example.com', // Wrong protocol
        'https://',
        'https://.',
        ''
      ]
      
      for (const url of invalidURLs) {
        const result = await URLFieldType.validate(url, defaultConfig, mockContext)
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    it('should enforce HTTPS requirement', async () => {
      const httpsConfig = { ...defaultConfig, requireHTTPS: true }
      
      const httpsResult = await URLFieldType.validate('https://example.com', httpsConfig, mockContext)
      expect(httpsResult.valid).toBe(true)
      
      const httpResult = await URLFieldType.validate('http://example.com', httpsConfig, mockContext)
      expect(httpResult.valid).toBe(false)
    })

    it('should validate domain restrictions', async () => {
      const restrictedConfig = {
        ...defaultConfig,
        allowedDomains: ['example.com', 'trusted.org']
      }
      
      const validResult = await URLFieldType.validate('https://www.example.com', restrictedConfig, mockContext)
      expect(validResult.valid).toBe(true)
      
      const invalidResult = await URLFieldType.validate('https://external.com', restrictedConfig, mockContext)
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors[0].code).toBe('INVALID_DOMAIN')
    })

    it('should normalize URLs', () => {
      const config = { ...defaultConfig, normalize: true, defaultProtocol: 'https' }
      
      const normalized = URLFieldType.serialize('Example.COM/Path', config)
      expect(normalized).toBe('https://example.com/Path')
    })

    describe('utility functions', () => {
      it('should parse URLs correctly', () => {
        const parsed = parseURL('https://example.com/path?query=value')
        expect(parsed).not.toBeNull()
        expect(parsed!.hostname).toBe('example.com')
        expect(parsed!.pathname).toBe('/path')
      })

      it('should extract domain correctly', () => {
        expect(extractURLDomain('https://www.example.com/path')).toBe('www.example.com')
        expect(extractURLDomain('invalid-url')).toBeNull()
      })

      it('should check if URL is secure', () => {
        expect(isSecureURL('https://example.com')).toBe(true)
        expect(isSecureURL('http://example.com')).toBe(false)
      })

      it('should create field configurations', () => {
        const basicField = createURLField()
        expect(basicField.type).toBe('url')
        
        const httpsField = createHTTPSURLField()
        expect(httpsField.config.requireHTTPS).toBe(true)
      })
    })
  })

  describe('Image Field Type', () => {
    const defaultConfig = { allowEmpty: false }

    it('should have correct basic properties', () => {
      expect(ImageFieldType.name).toBe('image')
      expect(ImageFieldType.category).toBe('media')
      expect(ImageFieldType.description).toContain('Image field')
      expect(ImageFieldType.defaultValue).toBeNull()
    })

    it('should validate image values', async () => {
      const validImage = createImageValue('image-123', { alt: 'Test image' })
      
      const result = await ImageFieldType.validate(validImage, defaultConfig, mockContext)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid image values', async () => {
      const invalidImage = { _type: 'invalid', _ref: 'image-123' } as any
      
      const result = await ImageFieldType.validate(invalidImage, defaultConfig, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_TYPE')
    })

    it('should require alt text when configured', async () => {
      const altRequiredConfig = { ...defaultConfig, requireAlt: true }
      const imageWithoutAlt = createImageValue('image-123')
      
      const result = await ImageFieldType.validate(imageWithoutAlt, altRequiredConfig, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('Alt text is required')
    })

    it('should validate hotspot coordinates', async () => {
      const invalidHotspot = createImageValue('image-123', {
        hotspot: { x: 2, y: 0.5, width: 0.1, height: 0.1 } // x > 1 is invalid
      })
      
      const result = await ImageFieldType.validate(invalidHotspot, defaultConfig, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('Hotspot coordinates')
    })

    it('should serialize image values correctly', () => {
      const image = createImageValue('image-123', { 
        alt: '  Test image  ',
        caption: '  Test caption  '
      })
      
      const serialized = ImageFieldType.serialize(image, defaultConfig)
      expect(serialized!.alt).toBe('Test image') // Trimmed
      expect(serialized!.caption).toBe('Test caption') // Trimmed
    })

    it('should deserialize from string references', () => {
      const deserialized = ImageFieldType.deserialize('image-123', defaultConfig)
      expect(deserialized).toEqual({
        _type: 'reference',
        _ref: 'image-123'
      })
    })

    it('should handle null values based on allowEmpty config', async () => {
      const requiredConfig = { ...defaultConfig, allowEmpty: false }
      const optionalConfig = { ...defaultConfig, allowEmpty: true }
      
      const requiredResult = await ImageFieldType.validate(null, requiredConfig, mockContext)
      expect(requiredResult.valid).toBe(false)
      expect(requiredResult.errors[0].code).toBe('REQUIRED')
      
      const optionalResult = await ImageFieldType.validate(null, optionalConfig, mockContext)
      expect(optionalResult.valid).toBe(true)
    })

    describe('utility functions', () => {
      it('should create image values correctly', () => {
        const image = createImageValue('image-123', { alt: 'Test' })
        expect(image._ref).toBe('image-123')
        expect(image._type).toBe('reference')
        expect(image.alt).toBe('Test')
      })

      it('should create field configurations', () => {
        const basicField = createImageField()
        expect(basicField.type).toBe('image')
        
        const profileField = createProfileImageField()
        expect(profileField.config.aspectRatios).toEqual([1]) // Square
        expect(profileField.config.requireAlt).toBe(true)
      })
    })
  })

  describe('File Field Type', () => {
    const defaultConfig = { allowEmpty: false }

    it('should have correct basic properties', () => {
      expect(FileFieldType.name).toBe('file')
      expect(FileFieldType.category).toBe('media')
      expect(FileFieldType.description).toContain('Generic file field')
      expect(FileFieldType.defaultValue).toBeNull()
    })

    it('should validate file values', async () => {
      const validFile = {
        _type: 'reference' as const,
        _ref: 'file-123',
        filename: 'document.pdf'
      }
      
      const result = await FileFieldType.validate(validFile, defaultConfig, mockContext)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid file values', async () => {
      const invalidFile = { _type: 'invalid', _ref: 'file-123' } as any
      
      const result = await FileFieldType.validate(invalidFile, defaultConfig, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_VALUE')
    })

    it('should handle multiple files when configured', async () => {
      const multipleConfig = { ...defaultConfig, multiple: true, maxFiles: 3 }
      const files = [
        { _type: 'reference' as const, _ref: 'file-1' },
        { _type: 'reference' as const, _ref: 'file-2' }
      ]
      
      const result = await FileFieldType.validate(files, multipleConfig, mockContext)
      expect(result.valid).toBe(true)
    })

    it('should reject too many files', async () => {
      const multipleConfig = { ...defaultConfig, multiple: true, maxFiles: 2 }
      const files = [
        { _type: 'reference' as const, _ref: 'file-1' },
        { _type: 'reference' as const, _ref: 'file-2' },
        { _type: 'reference' as const, _ref: 'file-3' }
      ]
      
      const result = await FileFieldType.validate(files, multipleConfig, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('Too many files')
    })

    it('should serialize file values correctly', () => {
      const file = {
        _type: 'reference' as const,
        _ref: 'file-123',
        filename: '  document.pdf  ',
        title: '  My Document  '
      }
      
      const serialized = FileFieldType.serialize(file, defaultConfig)
      expect(serialized!.filename).toBe('document.pdf') // Trimmed
      expect(serialized!.title).toBe('My Document') // Trimmed
    })

    it('should handle arrays in serialization', () => {
      const files = [
        { _type: 'reference' as const, _ref: 'file-1', filename: 'doc1.pdf' },
        { _type: 'reference' as const, _ref: 'file-2', filename: 'doc2.pdf' }
      ]
      
      const serialized = FileFieldType.serialize(files, defaultConfig)
      expect(Array.isArray(serialized)).toBe(true)
      expect((serialized as any[]).length).toBe(2)
    })

    describe('utility functions', () => {
      it('should get file type category correctly', () => {
        expect(getFileTypeCategory('application/pdf')).toBe('document')
        expect(getFileTypeCategory('image/jpeg')).toBe('image')
        expect(getFileTypeCategory('video/mp4')).toBe('video')
        expect(getFileTypeCategory('unknown/type')).toBeNull()
      })

      it('should sanitize filenames', () => {
        expect(sanitizeFilename('My Document!.pdf')).toBe('my_document_.pdf')
        expect(sanitizeFilename('test@#$%file.txt')).toBe('test_file.txt') // Fixed expectation
        expect(sanitizeFilename('multiple___underscores.doc')).toBe('multiple_underscores.doc')
      })

      it('should create field configurations', () => {
        const basicField = createFileField()
        expect(basicField.type).toBe('file')
        
        const documentField = createDocumentField()
        expect(documentField.config.acceptedTypes).toContain('application/pdf')
        expect(documentField.config.storeMetadata).toBe(true)
      })
    })
  })

})