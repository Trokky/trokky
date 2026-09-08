import { describe, it, expect } from 'vitest'
import {
  countByMediaType,
  filterAndSortMedia,
  matchesMediaType,
  matchesSearchQuery,
} from '../pages/media/mediaFilters'
import type { MediaFile } from '../pages/media/types'

function makeFile(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    id: 'm1',
    filename: 'photo.png',
    contentType: 'image/png',
    size: 1000,
    url: '/media/m1/file',
    uploadedAt: '2024-01-01T00:00:00.000Z',
    _createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('matchesMediaType', () => {
  it('should keep everything under the all tab', () => {
    expect(matchesMediaType(makeFile({ contentType: 'application/zip' }), 'all')).toBe(true)
  })

  it('should split images, videos and audio by mime prefix', () => {
    expect(matchesMediaType(makeFile({ contentType: 'image/jpeg' }), 'images')).toBe(true)
    expect(matchesMediaType(makeFile({ contentType: 'video/mp4' }), 'images')).toBe(false)
    expect(matchesMediaType(makeFile({ contentType: 'video/mp4' }), 'videos')).toBe(true)
    expect(matchesMediaType(makeFile({ contentType: 'audio/mpeg' }), 'audio')).toBe(true)
  })

  it('should treat pdf, text and application types as documents', () => {
    expect(matchesMediaType(makeFile({ contentType: 'application/pdf' }), 'documents')).toBe(true)
    expect(matchesMediaType(makeFile({ contentType: 'text/plain' }), 'documents')).toBe(true)
    expect(matchesMediaType(makeFile({ contentType: 'image/png' }), 'documents')).toBe(false)
  })

  it('should treat zip, rar and tar as archives', () => {
    expect(matchesMediaType(makeFile({ contentType: 'application/zip' }), 'archives')).toBe(true)
    expect(matchesMediaType(makeFile({ contentType: 'application/x-tar' }), 'archives')).toBe(true)
    expect(matchesMediaType(makeFile({ contentType: 'image/png' }), 'archives')).toBe(false)
  })
})

describe('matchesSearchQuery', () => {
  const file = makeFile({
    filename: 'Beach.PNG',
    metadata: {
      title: 'Sunset',
      alt: 'A sunset over the sea',
      author: 'Ada',
      credit: 'City archive',
      tags: ['summer', 'coast'],
    },
  })

  it('should match the filename case-insensitively', () => {
    expect(matchesSearchQuery(file, 'beach')).toBe(true)
  })

  it('should match title, alt, author, credit and tags', () => {
    expect(matchesSearchQuery(file, 'sunset')).toBe(true)
    expect(matchesSearchQuery(file, 'over the sea')).toBe(true)
    expect(matchesSearchQuery(file, 'ada')).toBe(true)
    expect(matchesSearchQuery(file, 'archive')).toBe(true)
    expect(matchesSearchQuery(file, 'coast')).toBe(true)
  })

  it('should not match anything the file has no field for', () => {
    expect(matchesSearchQuery(makeFile(), 'sunset')).toBe(false)
  })
})

describe('filterAndSortMedia', () => {
  const older = makeFile({ id: 'a', filename: 'a.png', size: 10, _createdAt: '2024-01-01T00:00:00.000Z' })
  const newer = makeFile({ id: 'b', filename: 'b.png', size: 50, _createdAt: '2024-06-01T00:00:00.000Z' })
  const doc = makeFile({ id: 'c', filename: 'c.pdf', contentType: 'application/pdf', size: 30, _createdAt: '2024-03-01T00:00:00.000Z' })
  const all = [older, newer, doc]

  it('should sort newest first by default', () => {
    expect(filterAndSortMedia(all, 'all', '', 'date', 'desc').map(f => f.id)).toEqual(['b', 'c', 'a'])
  })

  it('should reverse the order when the direction is ascending', () => {
    expect(filterAndSortMedia(all, 'all', '', 'date', 'asc').map(f => f.id)).toEqual(['a', 'c', 'b'])
  })

  it('should sort by name and by size', () => {
    expect(filterAndSortMedia(all, 'all', '', 'name', 'desc').map(f => f.id)).toEqual(['a', 'b', 'c'])
    expect(filterAndSortMedia(all, 'all', '', 'size', 'desc').map(f => f.id)).toEqual(['b', 'c', 'a'])
  })

  it('should apply the type tab and the search box together', () => {
    expect(filterAndSortMedia(all, 'images', '', 'date', 'desc').map(f => f.id)).toEqual(['b', 'a'])
    expect(filterAndSortMedia(all, 'all', 'c.pdf', 'date', 'desc').map(f => f.id)).toEqual(['c'])
  })

  it('should leave the input array untouched', () => {
    filterAndSortMedia(all, 'all', '', 'name', 'asc')
    expect(all.map(f => f.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('countByMediaType', () => {
  const files = [
    makeFile({ id: 'a', contentType: 'image/png' }),
    makeFile({ id: 'b', contentType: 'video/mp4' }),
    makeFile({ id: 'c', contentType: 'application/pdf' }),
  ]

  it('should count every file under all', () => {
    expect(countByMediaType(files, 'all')).toBe(3)
  })

  it('should count only the files of one type', () => {
    expect(countByMediaType(files, 'images')).toBe(1)
    expect(countByMediaType(files, 'videos')).toBe(1)
    expect(countByMediaType(files, 'archives')).toBe(0)
  })
})
