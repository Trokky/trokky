import { describe, it, expect } from 'vitest'
import {
  buildMediaUrl,
  transformMediaObject,
} from '../services/api/media-urls'

const BACKEND = 'http://localhost:3210/api'

describe('buildMediaUrl', () => {
  it('should return an empty string for a missing asset reference', () => {
    expect(buildMediaUrl(BACKEND, '')).toBe('')
  })

  it('should build the original file URL when no variant is given', () => {
    expect(buildMediaUrl(BACKEND, 'abc123')).toBe(
      'http://localhost:3210/api/media/abc123/file'
    )
  })

  it('should build the variant URL when a variant is given', () => {
    expect(buildMediaUrl(BACKEND, 'abc123', 'thumbnail')).toBe(
      'http://localhost:3210/api/media/abc123/variants/thumbnail'
    )
  })
})

describe('transformMediaObject', () => {
  it('should pass through a value with no id', () => {
    expect(transformMediaObject(BACKEND, null)).toBeNull()
    expect(transformMediaObject(BACKEND, { filename: 'a.png' })).toEqual({
      filename: 'a.png',
    })
  })

  it('should add the original file URL', () => {
    expect(transformMediaObject(BACKEND, { id: 'm1', filename: 'a.png' })).toEqual(
      {
        id: 'm1',
        filename: 'a.png',
        url: 'http://localhost:3210/api/media/m1/file',
      }
    )
  })

  it('should add a URL to each variant while keeping its other fields', () => {
    const result = transformMediaObject(BACKEND, {
      id: 'm1',
      variants: { thumbnail: { width: 200 } },
    })

    expect(result.variants.thumbnail).toEqual({
      width: 200,
      url: 'http://localhost:3210/api/media/m1/variants/thumbnail',
    })
  })
})
