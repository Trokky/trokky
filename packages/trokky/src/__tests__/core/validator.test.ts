/**
 * Unit tests for DocumentValidator null / empty handling.
 *
 * The Studio sends null for cleared fields and '' for slugs it has not
 * generated yet; the validator must accept those for optional fields while
 * still rejecting them for required ones.
 */

import { describe, it, expect } from 'vitest'
import { DocumentValidator } from '../../core/validation/validator.js'
import { SchemaRegistry } from '../../core/schema/registry.js'
import type { ContentSchema, ValidationResult } from '../../core/types/index.js'

const schemas: ContentSchema[] = [
  {
    name: 'articles',
    type: 'document',
    title: 'Articles',
    fields: {
      title: { type: 'string', required: true },
      subtitle: { type: 'string' },
      views: { type: 'number' },
      featured: { type: 'boolean' },
      tags: { type: 'array', of: { type: 'string' } },
      author: { type: 'reference', to: 'authors' },
      seo: {
        type: 'object',
        fields: {
          metaTitle: { type: 'string' }
        }
      },
      slug: { type: 'slug', source: 'title' }
    }
  },
  {
    name: 'pages',
    type: 'document',
    title: 'Pages',
    fields: {
      title: { type: 'string', required: true },
      slug: { type: 'slug', required: true, source: 'title' }
    }
  },
  {
    name: 'flags',
    type: 'document',
    title: 'Flags',
    fields: {
      enabled: { type: 'boolean', required: true },
      labels: { type: 'array', required: true, of: { type: 'string' } }
    }
  }
]

function createValidator(): DocumentValidator {
  return new DocumentValidator(new SchemaRegistry(schemas))
}

function fieldErrors(result: ValidationResult, field: string): string[] {
  return result.errors.filter(error => error.field === field).map(error => error.message)
}

describe('DocumentValidator', () => {
  const validator = createValidator()

  it('should accept a null reference field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', author: null })

    expect(result.valid).toBe(true)
    expect(fieldErrors(result, 'author')).toEqual([])
  })

  it('should accept a null number field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', views: null })

    expect(result.valid).toBe(true)
  })

  it('should accept a null optional object field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', seo: null })

    expect(result.valid).toBe(true)
  })

  it('should accept a null optional string field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', subtitle: null })

    expect(result.valid).toBe(true)
  })

  it('should reject a null required string field', () => {
    const result = validator.validateDocument('articles', { title: null })

    expect(result.valid).toBe(false)
    expect(fieldErrors(result, 'title').length).toBeGreaterThan(0)
  })

  it('should accept an empty optional slug field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', slug: '' })

    expect(result.valid).toBe(true)
  })

  it('should reject an empty required slug field', () => {
    const result = validator.validateDocument('pages', { title: 'Page', slug: '' })

    expect(result.valid).toBe(false)
    expect(fieldErrors(result, 'slug')).toContain('Slug cannot be empty')
  })

  it('should accept a null optional boolean field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', featured: null })

    expect(result.valid).toBe(true)
  })

  it('should accept a null optional array field', () => {
    const result = validator.validateDocument('articles', { title: 'Post', tags: null })

    expect(result.valid).toBe(true)
  })

  it('should reject a null required boolean field', () => {
    const result = validator.validateDocument('flags', { enabled: null, labels: [] })

    expect(result.valid).toBe(false)
    expect(fieldErrors(result, 'enabled').length).toBeGreaterThan(0)
  })

  it('should reject a null required array field', () => {
    const result = validator.validateDocument('flags', { enabled: true, labels: null })

    expect(result.valid).toBe(false)
    expect(fieldErrors(result, 'labels').length).toBeGreaterThan(0)
  })

  it('should accept a null optional property inside an object field', () => {
    const result = validator.validateDocument('articles', {
      title: 'Post',
      seo: { metaTitle: null }
    })

    expect(result.valid).toBe(true)
  })

  it('should still accept populated values for the relaxed fields', () => {
    const result = validator.validateDocument('articles', {
      title: 'Post',
      subtitle: 'Sub',
      views: 42,
      featured: true,
      tags: ['news'],
      author: { _ref: 'author-1' },
      seo: { metaTitle: 'Meta' },
      slug: 'post'
    })

    expect(result.valid).toBe(true)
  })
})
