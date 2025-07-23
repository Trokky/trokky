/**
 * Standalone Portable Text Field Type Implementation
 * This version doesn't import from @trokky/core to avoid circular dependencies in tests
 */

import type { 
  PortableTextValue, 
  PortableTextFieldConfig 
} from './types.js'
import { DEFAULT_PORTABLE_TEXT_CONFIG } from './constants.js'
import { normalizePortableText } from './utils.js'
import { toHTML, toMarkdown, toPlainText } from './serializers.js'

// Minimal interfaces for standalone usage
interface StandaloneValidationError {
  field: string
  message: string
  code: string
}

interface StandaloneValidationResult {
  valid: boolean
  errors: StandaloneValidationError[]
}

interface StandaloneFieldContext {
  fieldPath: string[]
}

interface StandaloneFieldType<TConfig, TValue> {
  name: string
  category: string
  description: string
  validate(value: TValue, config: TConfig, context: StandaloneFieldContext): StandaloneValidationResult
  serialize(value: TValue, config: TConfig): TValue
  deserialize(data: any, config: TConfig): TValue
  defaultValue: TValue
}

export const StandalonePortableTextFieldType: StandaloneFieldType<PortableTextFieldConfig, PortableTextValue> = {
  name: 'portableText',
  category: 'text',
  description: 'Rich text editor with structured content blocks and annotations',

  validate(value: PortableTextValue, config: PortableTextFieldConfig, context: StandaloneFieldContext): StandaloneValidationResult {
    // Use default config if none provided
    const fieldConfig = { ...DEFAULT_PORTABLE_TEXT_CONFIG, ...config }
    
    // Basic value validation
    if (value == null) {
      if (fieldConfig.minBlocks && fieldConfig.minBlocks > 0) {
        return {
          valid: false,
          errors: [{
            field: context.fieldPath.join('.'),
            message: 'Portable text content is required',
            code: 'REQUIRED'
          }]
        }
      }
      return { valid: true, errors: [] }
    }

    // Basic structure validation
    if (!Array.isArray(value)) {
      return {
        valid: false,
        errors: [{
          field: context.fieldPath.join('.'),
          message: 'Portable text value must be an array',
          code: 'INVALID_STRUCTURE'
        }]
      }
    }

    // Block count validation
    const errors: StandaloneValidationError[] = []
    
    if (fieldConfig.maxBlocks && value.length > fieldConfig.maxBlocks) {
      errors.push({
        field: context.fieldPath.join('.'),
        message: `Too many blocks. Maximum allowed: ${fieldConfig.maxBlocks}`,
        code: 'EXCEEDS_MAX_BLOCKS'
      })
    }

    if (fieldConfig.minBlocks && value.length < fieldConfig.minBlocks) {
      errors.push({
        field: context.fieldPath.join('.'),
        message: `Too few blocks. Minimum required: ${fieldConfig.minBlocks}`,
        code: 'BELOW_MIN_BLOCKS'
      })
    }

    // Basic block type validation
    value.forEach((block, index) => {
      if (!block._type) {
        errors.push({
          field: `${context.fieldPath.join('.')}.${index}`,
          message: 'Block must have a _type',
          code: 'INVALID_BLOCK_TYPE'
        })
      }

      if (fieldConfig.allowedBlockTypes && !fieldConfig.allowedBlockTypes.includes(block._type)) {
        errors.push({
          field: `${context.fieldPath.join('.')}.${index}`,
          message: `Block type "${block._type}" is not allowed`,
          code: 'INVALID_BLOCK_TYPE'
        })
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  },

  serialize(value: PortableTextValue, config: PortableTextFieldConfig): PortableTextValue {
    if (!value) {
      return []
    }

    // Normalize the portable text by removing empty blocks and orphaned mark definitions
    return normalizePortableText(value)
  },

  deserialize(data: any, config: PortableTextFieldConfig): PortableTextValue {
    if (!data) {
      return []
    }

    // Handle different input formats
    if (typeof data === 'string') {
      // If it's a string, treat it as plain text and convert to portable text
      return [{
        _type: 'block',
        _key: Math.random().toString(36).substr(2, 9),
        style: 'normal',
        children: [{
          _type: 'span',
          _key: Math.random().toString(36).substr(2, 9),
          text: data,
          marks: []
        }],
        markDefs: []
      }]
    }

    if (Array.isArray(data)) {
      // Assume it's already portable text format
      return normalizePortableText(data)
    }

    // Fallback to empty array for unknown formats
    return []
  },

  defaultValue: []
}

// Helper functions for working with portable text fields
export function createPortableTextField(config: Partial<PortableTextFieldConfig> = {}) {
  return {
    type: 'portableText',
    config: { ...DEFAULT_PORTABLE_TEXT_CONFIG, ...config }
  }
}

export function createSimplePortableTextField(placeholder?: string) {
  return createPortableTextField({
    blocks: [{ type: 'block', title: 'Text Block', icon: 'text' }],
    marks: [
      { type: 'decorator', name: 'strong', title: 'Bold', icon: 'format-bold' },
      { type: 'decorator', name: 'em', title: 'Italic', icon: 'format-italic' }
    ],
    annotations: [],
    styles: [{ type: 'normal', title: 'Normal', icon: 'format-paragraph' }],
    allowedBlockTypes: ['block'],
    allowedMarks: ['strong', 'em'],
    allowedAnnotations: [],
    placeholder: placeholder || 'Start typing...'
  })
}

export function createRichPortableTextField(config: Partial<PortableTextFieldConfig> = {}) {
  return createPortableTextField({
    blocks: [
      { type: 'block', title: 'Text Block', icon: 'text' },
      { type: 'image', title: 'Image', icon: 'image' },
      { type: 'code', title: 'Code Block', icon: 'code' },
      { type: 'callout', title: 'Callout', icon: 'info-outline' }
    ],
    marks: [
      { type: 'decorator', name: 'strong', title: 'Bold', icon: 'format-bold' },
      { type: 'decorator', name: 'em', title: 'Italic', icon: 'format-italic' },
      { type: 'decorator', name: 'underline', title: 'Underline', icon: 'format-underlined' },
      { type: 'decorator', name: 'code', title: 'Inline Code', icon: 'code' },
      { type: 'annotation', name: 'link', title: 'Link', icon: 'link' }
    ],
    annotations: [
      { 
        type: 'annotation', 
        name: 'link', 
        title: 'Link', 
        icon: 'link',
        fields: {
          href: { type: 'url', title: 'URL' },
          title: { type: 'string', title: 'Title' }
        }
      }
    ],
    styles: [
      { type: 'normal', title: 'Normal', icon: 'format-paragraph' },
      { type: 'h1', title: 'Heading 1', icon: 'format-header-1' },
      { type: 'h2', title: 'Heading 2', icon: 'format-header-2' },
      { type: 'h3', title: 'Heading 3', icon: 'format-header-3' },
      { type: 'blockquote', title: 'Quote', icon: 'format-quote-close' }
    ],
    lists: [
      { type: 'bullet', title: 'Bullet List', icon: 'format-list-bulleted' },
      { type: 'number', title: 'Numbered List', icon: 'format-list-numbered' }
    ],
    allowedBlockTypes: ['block', 'image', 'code', 'callout'],
    allowedMarks: ['strong', 'em', 'underline', 'code', 'link'],
    allowedAnnotations: ['link'],
    placeholder: 'Start creating content...',
    ...config
  })
}

// Utility functions for converting portable text to other formats
export function portableTextToHTML(value: PortableTextValue, config?: PortableTextFieldConfig): string {
  return toHTML(value)
}

export function portableTextToMarkdown(value: PortableTextValue, config?: PortableTextFieldConfig): string {
  return toMarkdown(value)
}

export function portableTextToPlainText(value: PortableTextValue, config?: PortableTextFieldConfig): string {
  return toPlainText(value)
}

// Migration helpers
export function htmlToPortableText(html: string): PortableTextValue {
  // Simple HTML to portable text conversion
  const text = html
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim()

  if (!text) {
    return []
  }

  return [{
    _type: 'block',
    _key: Math.random().toString(36).substr(2, 9),
    style: 'normal',
    children: [{
      _type: 'span',
      _key: Math.random().toString(36).substr(2, 9),
      text,
      marks: []
    }],
    markDefs: []
  }]
}

export function markdownToPortableText(markdown: string): PortableTextValue {
  // Simple markdown to portable text conversion
  const lines = markdown.split('\n').filter(line => line.trim())
  
  return lines.map(line => {
    let style = 'normal'
    let text = line.trim()

    // Check for headings
    if (text.startsWith('# ')) {
      style = 'h1'
      text = text.substring(2)
    } else if (text.startsWith('## ')) {
      style = 'h2'
      text = text.substring(3)
    } else if (text.startsWith('### ')) {
      style = 'h3'
      text = text.substring(4)
    } else if (text.startsWith('> ')) {
      style = 'blockquote'
      text = text.substring(2)
    }

    return {
      _type: 'block',
      _key: Math.random().toString(36).substr(2, 9),
      style,
      children: [{
        _type: 'span',
        _key: Math.random().toString(36).substr(2, 9),
        text,
        marks: []
      }],
      markDefs: []
    }
  })
}