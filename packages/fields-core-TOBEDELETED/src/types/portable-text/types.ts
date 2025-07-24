/**
 * Portable Text Types and Interfaces
 * Based on Sanity's Portable Text specification
 */

// Core Portable Text value type
export type PortableTextValue = PortableTextBlock[]

// Base interface for all portable text objects
export interface PortableTextObject {
  _type: string
  _key?: string
}

// Main block interface
export interface PortableTextBlock extends PortableTextObject {
  _type: string
  children?: PortableTextSpan[]
  style?: string
  listItem?: string
  level?: number
  markDefs?: PortableTextMarkDefinition[]
}

// Text span within blocks
export interface PortableTextSpan extends PortableTextObject {
  _type: 'span'
  text: string
  marks?: string[]
}

// Mark definition for annotations
export interface PortableTextMarkDefinition extends PortableTextObject {
  _type: string
  _key: string
  [key: string]: any
}

// Built-in block types
export interface TextBlock extends PortableTextBlock {
  _type: 'block'
  style: 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote'
  children: PortableTextSpan[]
  markDefs?: PortableTextMarkDefinition[]
}

export interface ListBlock extends PortableTextBlock {
  _type: 'block'
  listItem: 'bullet' | 'number'
  level: number
  children: PortableTextSpan[]
  markDefs?: PortableTextMarkDefinition[]
}

// Custom block types
export interface ImageBlock extends PortableTextBlock {
  _type: 'image'
  asset: {
    _ref: string
    _type: 'reference'
  }
  alt?: string
  caption?: string
  crop?: {
    top: number
    bottom: number
    left: number
    right: number
  }
  hotspot?: {
    x: number
    y: number
    height: number
    width: number
  }
}

export interface CodeBlock extends PortableTextBlock {
  _type: 'code'
  language?: string
  filename?: string
  code: string
  highlightedLines?: number[]
}

export interface CalloutBlock extends PortableTextBlock {
  _type: 'callout'
  calloutType: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children: PortableTextSpan[]
}

// Built-in marks
export type DecoratorMark = 'strong' | 'em' | 'underline' | 'strike-through' | 'code'

// Built-in annotations
export interface LinkAnnotation extends PortableTextMarkDefinition {
  _type: 'link'
  href: string
  title?: string
  target?: '_blank' | '_self'
}

export interface InternalLinkAnnotation extends PortableTextMarkDefinition {
  _type: 'internalLink'
  reference: {
    _ref: string
    _type: 'reference'
  }
}

export interface CommentAnnotation extends PortableTextMarkDefinition {
  _type: 'comment'
  comment: string
  author?: string
  timestamp?: string
}

// Configuration interfaces
export interface PortableTextFieldConfig {
  // Block types configuration
  blocks?: BlockTypeConfig[]
  
  // Marks configuration
  marks?: MarkConfig[]
  
  // Annotations configuration
  annotations?: AnnotationConfig[]
  
  // List configuration
  lists?: ListConfig[]
  
  // Styles configuration
  styles?: StyleConfig[]
  
  // Validation rules
  maxBlocks?: number
  minBlocks?: number
  allowedBlockTypes?: string[]
  allowedMarks?: string[]
  allowedAnnotations?: string[]
  
  // Editor configuration
  placeholder?: string
  readOnly?: boolean
  spellCheck?: boolean
}

export interface BlockTypeConfig {
  type: string
  title: string
  description?: string
  icon?: string
  fields?: Record<string, any> // Field definitions for custom blocks
  preview?: {
    title?: string
    subtitle?: string
    media?: string
  }
}

export interface MarkConfig {
  type: 'decorator' | 'annotation'
  name: string
  title: string
  description?: string
  icon?: string
  component?: string // Component name for custom rendering
  shortcut?: string // Keyboard shortcut
}

export interface AnnotationConfig extends MarkConfig {
  type: 'annotation'
  fields?: Record<string, any> // Field definitions for annotation data
}

export interface ListConfig {
  type: 'bullet' | 'number'
  title: string
  icon?: string
  maxNesting?: number
}

export interface StyleConfig {
  type: string
  title: string
  description?: string
  icon?: string
  component?: string
  blockEditor?: {
    render?: string
  }
}

// Serialization types
export interface SerializationOptions {
  format: 'html' | 'markdown' | 'plaintext' | 'react'
  customComponents?: Record<string, any>
  markComponents?: Record<string, any>
  blockComponents?: Record<string, any>
  unknownBlockComponent?: any
  unknownMarkComponent?: any
}

// Validation types
export interface PortableTextValidationResult {
  valid: boolean
  errors: PortableTextValidationError[]
}

export interface PortableTextValidationError {
  path: string[]
  message: string
  code: string
  blockIndex?: number
  spanIndex?: number
}

// Editor types
export interface PortableTextEditorProps {
  value: PortableTextValue
  config: PortableTextFieldConfig
  onChange: (value: PortableTextValue) => void
  onBlur?: () => void
  onFocus?: () => void
  readOnly?: boolean
  placeholder?: string
}

// Utility types
export type PortableTextQuery = {
  blockType?: string | string[]
  markType?: string | string[]
  hasText?: boolean
  textContains?: string
}

export type PortableTextTransform = (blocks: PortableTextValue) => PortableTextValue