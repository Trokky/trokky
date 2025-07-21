/**
 * Portable Text Utility Functions
 */

import type {
  PortableTextValue,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDefinition,
  TextBlock,
  ListBlock,
  ImageBlock,
  CodeBlock,
  CalloutBlock,
  PortableTextQuery
} from './types'

// Block creation utilities
export function createTextBlock(
  text: string,
  style: 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' = 'normal',
  marks: string[] = []
): TextBlock {
  return {
    _type: 'block',
    _key: generateKey(),
    style,
    children: [createSpan(text, marks)],
    markDefs: []
  }
}

export function createListBlock(
  text: string,
  listItem: 'bullet' | 'number',
  level: number = 1,
  marks: string[] = []
): ListBlock {
  return {
    _type: 'block',
    _key: generateKey(),
    listItem,
    level,
    children: [createSpan(text, marks)],
    markDefs: []
  }
}

export function createImageBlock(
  assetRef: string,
  alt?: string,
  caption?: string
): ImageBlock {
  return {
    _type: 'image',
    _key: generateKey(),
    asset: {
      _ref: assetRef,
      _type: 'reference'
    },
    alt,
    caption
  }
}

export function createCodeBlock(
  code: string,
  language?: string,
  filename?: string
): CodeBlock {
  return {
    _type: 'code',
    _key: generateKey(),
    code,
    language,
    filename
  }
}

export function createCalloutBlock(
  text: string,
  calloutType: 'info' | 'warning' | 'error' | 'success',
  title?: string
): CalloutBlock {
  return {
    _type: 'callout',
    _key: generateKey(),
    calloutType,
    title,
    children: [createSpan(text)]
  }
}

// Span and mark utilities
export function createSpan(text: string, marks: string[] = []): PortableTextSpan {
  return {
    _type: 'span',
    _key: generateKey(),
    text,
    marks
  }
}

export function createMarkDef(
  type: string,
  data: Record<string, any> = {}
): PortableTextMarkDefinition {
  return {
    _type: type,
    _key: generateKey(),
    ...data
  }
}

export function createLinkMarkDef(href: string, title?: string, target?: string): PortableTextMarkDefinition {
  return createMarkDef('link', { href, title, target })
}

export function createInternalLinkMarkDef(reference: string): PortableTextMarkDefinition {
  return createMarkDef('internalLink', {
    reference: {
      _ref: reference,
      _type: 'reference'
    }
  })
}

// Key generation
export function generateKey(): string {
  return Math.random().toString(36).substr(2, 9)
}

// Block type guards
export function isTextBlock(block: PortableTextBlock): block is TextBlock {
  return block._type === 'block' && !block.listItem
}

export function isListBlock(block: PortableTextBlock): block is ListBlock {
  return block._type === 'block' && !!block.listItem
}

export function isImageBlock(block: PortableTextBlock): block is ImageBlock {
  return block._type === 'image'
}

export function isCodeBlock(block: PortableTextBlock): block is CodeBlock {
  return block._type === 'code'
}

export function isCalloutBlock(block: PortableTextBlock): block is CalloutBlock {
  return block._type === 'callout'
}

export function hasChildren(block: PortableTextBlock): block is PortableTextBlock & { children: PortableTextSpan[] } {
  return 'children' in block && Array.isArray(block.children)
}

// Content analysis utilities
export function getPlainText(blocks: PortableTextValue): string {
  return blocks
    .map(block => {
      if (hasChildren(block)) {
        return block.children.map(span => span.text).join('')
      }
      if (isCodeBlock(block)) {
        return block.code
      }
      return ''
    })
    .join('\n')
    .trim()
}

export function getWordCount(blocks: PortableTextValue): number {
  const text = getPlainText(blocks)
  return text.split(/\s+/).filter(word => word.length > 0).length
}

export function getCharacterCount(blocks: PortableTextValue, includeSpaces: boolean = true): number {
  const text = getPlainText(blocks)
  return includeSpaces ? text.length : text.replace(/\s/g, '').length
}

export function getReadingTime(blocks: PortableTextValue, wordsPerMinute: number = 200): number {
  const wordCount = getWordCount(blocks)
  return Math.ceil(wordCount / wordsPerMinute)
}

// Content querying
export function queryBlocks(blocks: PortableTextValue, query: PortableTextQuery): PortableTextBlock[] {
  return blocks.filter(block => {
    // Filter by block type
    if (query.blockType) {
      const allowedTypes = Array.isArray(query.blockType) ? query.blockType : [query.blockType]
      if (!allowedTypes.includes(block._type)) {
        return false
      }
    }

    // Filter by mark type
    if (query.markType && hasChildren(block)) {
      const allowedMarks = Array.isArray(query.markType) ? query.markType : [query.markType]
      const hasRequiredMark = block.children.some(span =>
        span.marks?.some(mark => allowedMarks.includes(mark))
      )
      if (!hasRequiredMark) {
        return false
      }
    }

    // Filter by text content
    if (query.hasText !== undefined) {
      const hasText = hasChildren(block) && block.children.some(span => span.text.trim().length > 0)
      if (query.hasText !== hasText) {
        return false
      }
    }

    // Filter by text contains
    if (query.textContains && hasChildren(block)) {
      const blockText = block.children.map(span => span.text).join('').toLowerCase()
      if (!blockText.includes(query.textContains.toLowerCase())) {
        return false
      }
    }

    return true
  })
}

// Content extraction
export function extractImages(blocks: PortableTextValue): ImageBlock[] {
  return blocks.filter(isImageBlock)
}

export function extractLinks(blocks: PortableTextValue): PortableTextMarkDefinition[] {
  const links: PortableTextMarkDefinition[] = []
  
  blocks.forEach(block => {
    if (hasChildren(block) && block.markDefs) {
      block.markDefs.forEach(markDef => {
        if (markDef._type === 'link' || markDef._type === 'internalLink') {
          links.push(markDef)
        }
      })
    }
  })
  
  return links
}

export function extractHeadings(blocks: PortableTextValue): TextBlock[] {
  return blocks
    .filter(isTextBlock)
    .filter(block => block.style && block.style.startsWith('h'))
}

// Content transformation
export function insertBlockAt(blocks: PortableTextValue, index: number, block: PortableTextBlock): PortableTextValue {
  const newBlocks = [...blocks]
  newBlocks.splice(index, 0, block)
  return newBlocks
}

export function removeBlockAt(blocks: PortableTextValue, index: number): PortableTextValue {
  const newBlocks = [...blocks]
  newBlocks.splice(index, 1)
  return newBlocks
}

export function replaceBlockAt(blocks: PortableTextValue, index: number, block: PortableTextBlock): PortableTextValue {
  const newBlocks = [...blocks]
  newBlocks[index] = block
  return newBlocks
}

export function moveBlock(blocks: PortableTextValue, fromIndex: number, toIndex: number): PortableTextValue {
  const newBlocks = [...blocks]
  const [movedBlock] = newBlocks.splice(fromIndex, 1)
  newBlocks.splice(toIndex, 0, movedBlock)
  return newBlocks
}

// Mark utilities
export function addMarkToSpan(span: PortableTextSpan, mark: string): PortableTextSpan {
  const marks = span.marks || []
  if (!marks.includes(mark)) {
    return { ...span, marks: [...marks, mark] }
  }
  return span
}

export function removeMarkFromSpan(span: PortableTextSpan, mark: string): PortableTextSpan {
  const marks = span.marks || []
  return { ...span, marks: marks.filter(m => m !== mark) }
}

export function toggleMarkOnSpan(span: PortableTextSpan, mark: string): PortableTextSpan {
  const marks = span.marks || []
  if (marks.includes(mark)) {
    return removeMarkFromSpan(span, mark)
  } else {
    return addMarkToSpan(span, mark)
  }
}

// Validation utilities
export function validateBlockStructure(block: PortableTextBlock): boolean {
  // Every block must have a _type
  if (!block._type) {
    return false
  }

  // Text blocks must have children
  if (block._type === 'block' && !hasChildren(block)) {
    return false
  }

  // Validate children structure
  if (hasChildren(block)) {
    return block.children.every(child => 
      child._type === 'span' && 
      typeof child.text === 'string'
    )
  }

  return true
}

export function validatePortableTextValue(value: PortableTextValue): boolean {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every(validateBlockStructure)
}

// Cleanup utilities
export function removeEmptyBlocks(blocks: PortableTextValue): PortableTextValue {
  return blocks.filter(block => {
    if (hasChildren(block)) {
      return block.children.some(span => span.text.trim().length > 0)
    }
    return true // Keep non-text blocks
  })
}

export function removeOrphanedMarkDefs(blocks: PortableTextValue): PortableTextValue {
  return blocks.map(block => {
    if (!hasChildren(block) || !block.markDefs) {
      return block
    }

    const usedMarkKeys = new Set<string>()
    block.children.forEach(span => {
      span.marks?.forEach(mark => {
        usedMarkKeys.add(mark)
      })
    })

    const cleanedMarkDefs = block.markDefs.filter(markDef => 
      usedMarkKeys.has(markDef._key)
    )

    return {
      ...block,
      markDefs: cleanedMarkDefs.length > 0 ? cleanedMarkDefs : undefined
    }
  })
}

export function normalizePortableText(blocks: PortableTextValue): PortableTextValue {
  return removeOrphanedMarkDefs(removeEmptyBlocks(blocks))
}