/**
 * Portable Text Field Type Implementation
 */

import type { FieldType, ValidationResult, FieldContext } from '@trokky/core'
import { FieldCategory } from '@trokky/core'
import type { 
  PortableTextValue, 
  PortableTextFieldConfig 
} from './types.js'
import { DEFAULT_PORTABLE_TEXT_CONFIG } from './constants.js'
import { validatePortableText } from './validation.js'
import { normalizePortableText } from './utils.js'
import { toHTML, toMarkdown, toPlainText } from './serializers.js'
import { createValidationResult } from '../../utils/validation.js'

export const PortableTextFieldType: FieldType<PortableTextFieldConfig, PortableTextValue> = {
  name: 'portableText',
  category: FieldCategory.TEXT,
  description: 'Rich text editor with structured content blocks and annotations',

  validate(value: PortableTextValue, config: PortableTextFieldConfig, context: FieldContext): ValidationResult {
    // Use default config if none provided
    const fieldConfig = { ...DEFAULT_PORTABLE_TEXT_CONFIG, ...config }
    
    // Basic value validation
    if (value == null) {
      if (fieldConfig.minBlocks && fieldConfig.minBlocks > 0) {
        return createValidationResult([{
          field: context.fieldPath.join('.'),
          message: 'Portable text content is required',
          code: 'REQUIRED'
        }])
      }
      return createValidationResult([])
    }

    // Validate portable text structure and content
    const portableTextResult = validatePortableText(value, fieldConfig, context)
    
    // Convert portable text errors to standard validation errors
    const validationErrors = portableTextResult.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code
    }))

    return createValidationResult(validationErrors)
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
  // This is a basic implementation - a full implementation would use a proper HTML parser
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
  // This is a basic implementation - a full implementation would use a markdown parser
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