import { MediaMetadata } from '@trokky/core'

export const sampleBlogPost = {
  title: 'Test Blog Post',
  content: 'This is a test blog post content.',
  author: 'John Doe',
  publishedAt: new Date('2024-01-01'),
  tags: ['test', 'blog'],
  metadata: {
    excerpt: 'This is a test...',
    readingTime: 5,
    featured: true
  }
}

export const sampleUser = {
  email: 'john@example.com',
  name: 'John Doe',
  bio: 'A test user',
  active: true
}

export const samplePage = {
  title: 'Home Page',
  slug: 'home',
  content: 'Welcome to our website',
  published: true
}

// Mock File implementation for testing
export class MockFile implements File {
  public readonly name: string
  public readonly type: string
  public readonly size: number
  public readonly lastModified: number
  private content: ArrayBuffer

  constructor(content: string | ArrayBuffer, filename: string, options: { type?: string } = {}) {
    this.name = filename
    this.type = options.type || 'application/octet-stream'
    if (typeof content === 'string') {
      const encoded = new TextEncoder().encode(content)
      const sliced = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer | SharedArrayBuffer
      // Ensure we have ArrayBuffer, not SharedArrayBuffer
      if (sliced instanceof ArrayBuffer) {
        this.content = sliced
      } else {
        // Copy SharedArrayBuffer to ArrayBuffer
        const sharedBuffer = sliced as SharedArrayBuffer
        const arrayBuffer = new ArrayBuffer(sharedBuffer.byteLength)
        new Uint8Array(arrayBuffer).set(new Uint8Array(sharedBuffer))
        this.content = arrayBuffer
      }
    } else {
      this.content = content
    }
    this.size = this.content.byteLength
    this.lastModified = Date.now()
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.content
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this.content)
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(this.content)
  }

  stream(): ReadableStream {
    const content = this.content
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(content))
        controller.close()
      }
    })
  }

  slice(start?: number, end?: number, contentType?: string): Blob {
    const slicedContent = this.content.slice(start, end)
    return new MockFile(slicedContent, this.name, { type: contentType || this.type }) as any
  }

  get webkitRelativePath(): string {
    return ''
  }
}

export function createMockFile(content: string, filename: string, type: string): File {
  return new MockFile(content, filename, { type }) as any
}

export function createMockMediaMetadata(filename: string, contentType: string, size: number): MediaMetadata {
  const extension = filename.split('.').pop() || ''
  return {
    id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    filename,
    contentType,
    size,
    extension
  }
}