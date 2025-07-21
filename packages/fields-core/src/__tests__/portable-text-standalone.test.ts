/**
 * Standalone Portable Text Tests
 * Tests that don't require importing complex dependencies
 */

import {
  createTextBlock,
  createImageBlock,
  createCodeBlock,
  createSpan,
  createLinkMarkDef,
  normalizePortableText,
  getWordCount,
  getCharacterCount,
  extractImages,
  extractLinks,
  getPlainText,
  isTextBlock,
  isImageBlock,
  isCodeBlock,
  hasChildren,
  validateBlockStructure,
  validatePortableTextValue
} from '../types/portable-text/utils'
import { 
  StandalonePortableTextFieldType,
  createPortableTextField,
  createSimplePortableTextField,
  createRichPortableTextField,
  portableTextToHTML,
  portableTextToMarkdown,
  portableTextToPlainText,
  htmlToPortableText,
  markdownToPortableText
} from '../types/portable-text/field-standalone'
import { 
  BUILTIN_BLOCK_TYPES,
  BUILTIN_DECORATOR_MARKS,
  DEFAULT_PORTABLE_TEXT_CONFIG
} from '../types/portable-text/constants'
import {
  toHTML,
  toMarkdown,
  toPlainText
} from '../types/portable-text/serializers'
import type { PortableTextValue } from '../types/portable-text/types'

// Mock field context for testing
const mockContext = {
  fieldPath: ['content']
}

describe('Portable Text - Standalone Tests', () => {

  describe('Standalone Field Type', () => {
    it('should have correct basic properties', () => {
      expect(StandalonePortableTextFieldType.name).toBe('portableText')
      expect(StandalonePortableTextFieldType.category).toBe('text')
      expect(StandalonePortableTextFieldType.description).toContain('Rich text editor')
      expect(StandalonePortableTextFieldType.defaultValue).toEqual([])
    })

    it('should validate empty content as valid by default', () => {
      const result = StandalonePortableTextFieldType.validate([], DEFAULT_PORTABLE_TEXT_CONFIG, mockContext)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate null content as valid by default', () => {
      const result = StandalonePortableTextFieldType.validate(null as any, DEFAULT_PORTABLE_TEXT_CONFIG, mockContext)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate null content as invalid when minBlocks is set', () => {
      const config = { ...DEFAULT_PORTABLE_TEXT_CONFIG, minBlocks: 1 }
      const result = StandalonePortableTextFieldType.validate(null as any, config, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('REQUIRED')
    })

    it('should validate simple text block', () => {
      const value: PortableTextValue = [createTextBlock('Hello world')]
      const result = StandalonePortableTextFieldType.validate(value, DEFAULT_PORTABLE_TEXT_CONFIG, mockContext)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch invalid block types', () => {
      const config = { ...DEFAULT_PORTABLE_TEXT_CONFIG, allowedBlockTypes: ['block'] }
      const value: PortableTextValue = [createImageBlock('image123', 'Alt text')]
      
      const result = StandalonePortableTextFieldType.validate(value, config, mockContext)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_BLOCK_TYPE')
    })

    it('should serialize portable text value', () => {
      const value: PortableTextValue = [createTextBlock('Test content')]
      const result = StandalonePortableTextFieldType.serialize(value, DEFAULT_PORTABLE_TEXT_CONFIG)
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0]?._type).toBe('block')
    })

    it('should deserialize string to text block', () => {
      const result = StandalonePortableTextFieldType.deserialize('Hello world', DEFAULT_PORTABLE_TEXT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0]?._type).toBe('block')
      expect(result[0]?.children?.[0]?.text).toBe('Hello world')
    })

    it('should deserialize null to empty array', () => {
      const result = StandalonePortableTextFieldType.deserialize(null, DEFAULT_PORTABLE_TEXT_CONFIG)
      expect(result).toEqual([])
    })
  })

  describe('Field Configuration Helpers', () => {
    it('should create simple portable text field config', () => {
      const config = createSimplePortableTextField('Type here...')
      expect(config.type).toBe('portableText')
      expect(config.config.placeholder).toBe('Type here...')
      expect(config.config.allowedBlockTypes).toEqual(['block'])
      expect(config.config.allowedMarks).toEqual(['strong', 'em'])
    })

    it('should create rich portable text field config', () => {
      const config = createRichPortableTextField()
      expect(config.type).toBe('portableText')
      expect(config.config.allowedBlockTypes).toContain('block')
      expect(config.config.allowedBlockTypes).toContain('image')
      expect(config.config.allowedBlockTypes).toContain('code')
      expect(config.config.allowedMarks).toContain('strong')
      expect(config.config.allowedMarks).toContain('link')
    })
  })

  describe('Migration Helpers', () => {
    it('should convert HTML to portable text', () => {
      const html = '<p>Hello <strong>world</strong></p>'
      const result = htmlToPortableText(html)
      
      expect(result).toHaveLength(1)
      expect(result[0]?._type).toBe('block')
      expect(result[0]?.children?.[0]?.text).toBe('Hello world') // HTML tags stripped
    })

    it('should convert Markdown to portable text', () => {
      const markdown = '# Hello\n\nThis is a paragraph.\n\n## Subheading'
      const result = markdownToPortableText(markdown)
      
      expect(result).toHaveLength(3)
      expect(result[0]?.style).toBe('h1')
      expect(result[0].children?.[0]?.text).toBe('Hello')
      expect(result[1]?.style).toBe('normal')
      expect(result[1]?.children?.[0]?.text).toBe('This is a paragraph.')
      expect(result[2]?.style).toBe('h2')
      expect(result[2]?.children?.[0]?.text).toBe('Subheading')
    })

    it('should handle empty HTML', () => {
      const result = htmlToPortableText('')
      expect(result).toEqual([])
    })

    it('should handle empty Markdown', () => {
      const result = markdownToPortableText('')
      expect(result).toEqual([])
    })
  })

  describe('Block Creation Utilities', () => {
    it('should create text block correctly', () => {
      const block = createTextBlock('Hello world', 'h1', ['strong'])
      
      expect(block._type).toBe('block')
      expect(block.style).toBe('h1')
      expect(block.children).toHaveLength(1)
      expect(block.children[0]._type).toBe('span')
      expect(block.children?.[0]?.text).toBe('Hello world')
      expect(block.children[0].marks).toEqual(['strong'])
      expect(block._key).toBeDefined()
    })

    it('should create image block correctly', () => {
      const block = createImageBlock('image123', 'Alt text', 'Caption')
      
      expect(block._type).toBe('image')
      expect(block.asset._ref).toBe('image123')
      expect(block.asset._type).toBe('reference')
      expect(block.alt).toBe('Alt text')
      expect(block.caption).toBe('Caption')
      expect(block._key).toBeDefined()
    })

    it('should create code block correctly', () => {
      const block = createCodeBlock('console.log("hello")', 'javascript', 'app.js')
      
      expect(block._type).toBe('code')
      expect(block.code).toBe('console.log("hello")')
      expect(block.language).toBe('javascript')
      expect(block.filename).toBe('app.js')
      expect(block._key).toBeDefined()
    })

    it('should create span correctly', () => {
      const span = createSpan('Test text', ['strong', 'em'])
      
      expect(span._type).toBe('span')
      expect(span.text).toBe('Test text')
      expect(span.marks).toEqual(['strong', 'em'])
      expect(span._key).toBeDefined()
    })

    it('should create link mark definition correctly', () => {
      const markDef = createLinkMarkDef('https://example.com', 'Example', '_blank')
      
      expect(markDef._type).toBe('link')
      expect(markDef.href).toBe('https://example.com')
      expect(markDef.title).toBe('Example')
      expect(markDef.target).toBe('_blank')
      expect(markDef._key).toBeDefined()
    })
  })

  describe('Type Guards', () => {
    const textBlock = createTextBlock('Text')
    const imageBlock = createImageBlock('img1')
    const codeBlock = createCodeBlock('code')

    it('should identify text blocks', () => {
      expect(isTextBlock(textBlock)).toBe(true)
      expect(isTextBlock(imageBlock)).toBe(false)
      expect(isTextBlock(codeBlock)).toBe(false)
    })

    it('should identify image blocks', () => {
      expect(isImageBlock(imageBlock)).toBe(true)
      expect(isImageBlock(textBlock)).toBe(false)
      expect(isImageBlock(codeBlock)).toBe(false)
    })

    it('should identify code blocks', () => {
      expect(isCodeBlock(codeBlock)).toBe(true)
      expect(isCodeBlock(textBlock)).toBe(false)
      expect(isCodeBlock(imageBlock)).toBe(false)
    })

    it('should identify blocks with children', () => {
      expect(hasChildren(textBlock)).toBe(true)
      expect(hasChildren(imageBlock)).toBe(false)
      expect(hasChildren(codeBlock)).toBe(false)
    })
  })

  describe('Content Analysis', () => {
    const sampleContent: PortableTextValue = [
      createTextBlock('Hello world'),
      createTextBlock('This is a longer paragraph with more words.'),
      createImageBlock('image123', 'Test image'),
      createCodeBlock('const x = 1', 'javascript')
    ]

    it('should extract plain text correctly', () => {
      const text = getPlainText(sampleContent)
      expect(text).toContain('Hello world')
      expect(text).toContain('This is a longer paragraph with more words.')
      expect(text).toContain('const x = 1')
    })

    it('should count words correctly', () => {
      const count = getWordCount(sampleContent)
      expect(count).toBeGreaterThan(10)
      expect(typeof count).toBe('number')
    })

    it('should count characters correctly', () => {
      const countWithSpaces = getCharacterCount(sampleContent, true)
      const countWithoutSpaces = getCharacterCount(sampleContent, false)
      
      expect(countWithSpaces).toBeGreaterThan(countWithoutSpaces)
      expect(typeof countWithSpaces).toBe('number')
      expect(typeof countWithoutSpaces).toBe('number')
    })

    it('should extract images correctly', () => {
      const images = extractImages(sampleContent)
      expect(images).toHaveLength(1)
      expect(images[0]._type).toBe('image')
      expect(images[0].asset._ref).toBe('image123')
    })

    it('should extract links correctly', () => {
      const linkMarkDef = createLinkMarkDef('https://example.com')
      const span = createSpan('Link text', [linkMarkDef._key])
      const blockWithLink: PortableTextValue = [{
        _type: 'block',
        _key: 'block1',
        style: 'normal',
        children: [span],
        markDefs: [linkMarkDef]
      }]
      
      const links = extractLinks(blockWithLink)
      expect(links).toHaveLength(1)
      expect(links[0]._type).toBe('link')
      expect(links[0].href).toBe('https://example.com')
    })
  })

  describe('Content Validation', () => {
    it('should validate correct block structure', () => {
      const validBlock = createTextBlock('Valid content')
      expect(validateBlockStructure(validBlock)).toBe(true)
    })

    it('should reject invalid block structure', () => {
      const invalidBlock = { _type: 'block' } // Missing children
      expect(validateBlockStructure(invalidBlock as any)).toBe(false)
    })

    it('should validate portable text value', () => {
      const validValue: PortableTextValue = [
        createTextBlock('Valid content'),
        createImageBlock('img1')
      ]
      expect(validatePortableTextValue(validValue)).toBe(true)
    })

    it('should reject invalid portable text value', () => {
      const invalidValue = 'not an array'
      expect(validatePortableTextValue(invalidValue as any)).toBe(false)
    })
  })

  describe('Content Normalization', () => {
    it('should remove empty blocks', () => {
      const value: PortableTextValue = [
        createTextBlock(''), // Empty
        createTextBlock('Valid content'),
        createTextBlock('   '), // Whitespace only
        createTextBlock('Another valid block')
      ]
      
      const normalized = normalizePortableText(value)
      expect(normalized.length).toBeLessThan(value.length)
      expect(normalized.every(block => {
        if (hasChildren(block)) {
          return block.children.some(span => span.text.trim().length > 0)
        }
        return true
      })).toBe(true)
    })

    it('should remove orphaned mark definitions', () => {
      const orphanedMarkDef = createLinkMarkDef('https://orphaned.com')
      const usedMarkDef = createLinkMarkDef('https://used.com')
      const span = createSpan('Text with link', [usedMarkDef._key])
      
      const value: PortableTextValue = [{
        _type: 'block',
        _key: 'block1',
        style: 'normal',
        children: [span],
        markDefs: [orphanedMarkDef, usedMarkDef]
      }]
      
      const normalized = normalizePortableText(value)
      expect(normalized[0].markDefs).toHaveLength(1)
      expect(normalized[0].markDefs![0]._key).toBe(usedMarkDef._key)
    })
  })

  describe('Serialization', () => {
    const sampleContent: PortableTextValue = [
      createTextBlock('Hello world', 'h1'),
      createTextBlock('This is a paragraph.', 'normal'),
      createImageBlock('image123', 'Test image', 'Caption'),
      createCodeBlock('console.log("hello")', 'javascript')
    ]

    it('should convert to HTML', () => {
      const html = toHTML(sampleContent)
      
      expect(html).toContain('<h1>Hello world</h1>')
      expect(html).toContain('<p>This is a paragraph.</p>')
      expect(html).toContain('<img src="/assets/image123" alt="Test image"')
      expect(html).toContain('<figcaption>Caption</figcaption>')
      expect(html).toContain('console.log(&quot;hello&quot;)')
      expect(html).toContain('language-javascript')
    })

    it('should convert to Markdown', () => {
      const markdown = toMarkdown(sampleContent)
      
      expect(markdown).toContain('# Hello world')
      expect(markdown).toContain('This is a paragraph.')
      expect(markdown).toContain('![Test image](/assets/image123)')
      expect(markdown).toContain('```javascript')
      expect(markdown).toContain('console.log("hello")')
    })

    it('should convert to plain text', () => {
      const plainText = toPlainText(sampleContent)
      
      expect(plainText).toContain('Hello world')
      expect(plainText).toContain('This is a paragraph.')
      expect(plainText).toContain('console.log("hello")')
      expect(plainText).not.toContain('<')
      expect(plainText).not.toContain('>')
      expect(plainText).not.toContain('#')
    })

    it('should handle text with marks in HTML', () => {
      const span = createSpan('Bold text', ['strong'])
      const block: PortableTextValue = [{
        _type: 'block',
        _key: 'block1',
        style: 'normal',
        children: [span],
        markDefs: []
      }]
      
      const html = toHTML(block)
      expect(html).toContain('<strong>Bold text</strong>')
    })

    it('should handle links in HTML', () => {
      const linkMarkDef = createLinkMarkDef('https://example.com', 'Example')
      const span = createSpan('Visit site', [linkMarkDef._key])
      const block: PortableTextValue = [{
        _type: 'block',
        _key: 'block1',
        style: 'normal',
        children: [span],
        markDefs: [linkMarkDef]
      }]
      
      const html = toHTML(block)
      expect(html).toContain('<a href="https://example.com" title="Example">Visit site</a>')
    })
  })

  describe('Configuration Constants', () => {
    it('should have built-in block types', () => {
      expect(BUILTIN_BLOCK_TYPES).toBeDefined()
      expect(Array.isArray(BUILTIN_BLOCK_TYPES)).toBe(true)
      expect(BUILTIN_BLOCK_TYPES.length).toBeGreaterThan(0)
      
      const textBlockType = BUILTIN_BLOCK_TYPES.find(b => b.type === 'block')
      expect(textBlockType).toBeDefined()
      expect(textBlockType!.title).toBe('Text Block')
    })

    it('should have built-in decorator marks', () => {
      expect(BUILTIN_DECORATOR_MARKS).toBeDefined()
      expect(Array.isArray(BUILTIN_DECORATOR_MARKS)).toBe(true)
      expect(BUILTIN_DECORATOR_MARKS.length).toBeGreaterThan(0)
      
      const strongMark = BUILTIN_DECORATOR_MARKS.find(m => m.name === 'strong')
      expect(strongMark).toBeDefined()
      expect(strongMark!.title).toBe('Bold')
    })

    it('should have default configuration', () => {
      expect(DEFAULT_PORTABLE_TEXT_CONFIG).toBeDefined()
      expect(DEFAULT_PORTABLE_TEXT_CONFIG.blocks).toBeDefined()
      expect(DEFAULT_PORTABLE_TEXT_CONFIG.marks).toBeDefined()
      expect(DEFAULT_PORTABLE_TEXT_CONFIG.placeholder).toBeDefined()
      expect(DEFAULT_PORTABLE_TEXT_CONFIG.spellCheck).toBe(true)
    })
  })

  describe('Advanced Content Operations', () => {
    it('should handle complex nested marks', () => {
      const linkMarkDef = createLinkMarkDef('https://example.com')
      const span = createSpan('Bold linked text', ['strong', linkMarkDef._key])
      const block: PortableTextValue = [{
        _type: 'block',
        _key: 'block1',
        style: 'normal',
        children: [span],
        markDefs: [linkMarkDef]
      }]
      
      const html = toHTML(block)
      expect(html).toContain('strong')
      expect(html).toContain('href="https://example.com"')
      expect(html).toContain('Bold linked text')
    })

    it('should handle multiple spans in one block', () => {
      const spans = [
        createSpan('Normal text '),
        createSpan('bold text', ['strong']),
        createSpan(' and '),
        createSpan('italic text', ['em']),
        createSpan('.')
      ]
      
      const block: PortableTextValue = [{
        _type: 'block',
        _key: 'block1',
        style: 'normal',
        children: spans,
        markDefs: []
      }]
      
      const plainText = getPlainText(block)
      expect(plainText).toBe('Normal text bold text and italic text.')
      
      const html = toHTML(block)
      expect(html).toContain('<strong>bold text</strong>')
      expect(html).toContain('<em>italic text</em>')
    })

    it('should preserve block order in serialization', () => {
      const blocks: PortableTextValue = [
        createTextBlock('First block', 'h1'),
        createTextBlock('Second block', 'normal'),
        createImageBlock('img1'),
        createTextBlock('Third block', 'h2')
      ]
      
      const html = toHTML(blocks)
      const h1Index = html.indexOf('<h1>First block</h1>')
      const pIndex = html.indexOf('<p>Second block</p>')
      const figIndex = html.indexOf('<figure>')
      const h2Index = html.indexOf('<h2>Third block</h2>')
      
      expect(h1Index).toBeGreaterThan(-1)
      expect(pIndex).toBeGreaterThan(h1Index)
      expect(figIndex).toBeGreaterThan(pIndex)
      expect(h2Index).toBeGreaterThan(figIndex)
    })
  })

})