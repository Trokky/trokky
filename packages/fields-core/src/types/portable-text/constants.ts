/**
 * Portable Text Constants and Default Configurations
 */

import type {
  BlockTypeConfig,
  MarkConfig,
  AnnotationConfig,
  ListConfig,
  StyleConfig,
  PortableTextFieldConfig
} from './types'

// Built-in block types
export const BUILTIN_BLOCK_TYPES: BlockTypeConfig[] = [
  {
    type: 'block',
    title: 'Text Block',
    description: 'Standard text block with formatting',
    icon: 'text'
  },
  {
    type: 'image',
    title: 'Image',
    description: 'Image with optional caption and alt text',
    icon: 'image',
    fields: {
      asset: { type: 'reference', to: [{ type: 'image' }] },
      alt: { type: 'string', title: 'Alt text' },
      caption: { type: 'string', title: 'Caption' }
    }
  },
  {
    type: 'code',
    title: 'Code Block',
    description: 'Code block with syntax highlighting',
    icon: 'code',
    fields: {
      language: { type: 'string', title: 'Language' },
      filename: { type: 'string', title: 'Filename' },
      code: { type: 'text', title: 'Code' }
    }
  },
  {
    type: 'callout',
    title: 'Callout',
    description: 'Highlighted callout box',
    icon: 'info-outline',
    fields: {
      calloutType: {
        type: 'string',
        title: 'Type',
        options: ['info', 'warning', 'error', 'success']
      },
      title: { type: 'string', title: 'Title' }
    }
  }
]

// Built-in decorator marks
export const BUILTIN_DECORATOR_MARKS: MarkConfig[] = [
  {
    type: 'decorator',
    name: 'strong',
    title: 'Bold',
    description: 'Bold text',
    icon: 'format-bold',
    shortcut: 'Ctrl+B'
  },
  {
    type: 'decorator', 
    name: 'em',
    title: 'Italic',
    description: 'Italic text',
    icon: 'format-italic',
    shortcut: 'Ctrl+I'
  },
  {
    type: 'decorator',
    name: 'underline',
    title: 'Underline',
    description: 'Underlined text',
    icon: 'format-underlined',
    shortcut: 'Ctrl+U'
  },
  {
    type: 'decorator',
    name: 'strike-through',
    title: 'Strike-through',
    description: 'Strike-through text',
    icon: 'format-strikethrough'
  },
  {
    type: 'decorator',
    name: 'code',
    title: 'Inline Code',
    description: 'Inline code formatting',
    icon: 'code',
    shortcut: 'Ctrl+`'
  }
]

// Built-in annotation marks
export const BUILTIN_ANNOTATION_MARKS: AnnotationConfig[] = [
  {
    type: 'annotation',
    name: 'link',
    title: 'Link',
    description: 'External link',
    icon: 'link',
    shortcut: 'Ctrl+K',
    fields: {
      href: { type: 'url', title: 'URL' },
      title: { type: 'string', title: 'Title' },
      target: {
        type: 'string',
        title: 'Target',
        options: ['_blank', '_self']
      }
    }
  },
  {
    type: 'annotation',
    name: 'internalLink',
    title: 'Internal Link',
    description: 'Link to internal content',
    icon: 'link-variant',
    fields: {
      reference: { type: 'reference', title: 'Link to' }
    }
  },
  {
    type: 'annotation',
    name: 'comment',
    title: 'Comment',
    description: 'Editorial comment',
    icon: 'comment',
    fields: {
      comment: { type: 'text', title: 'Comment' },
      author: { type: 'string', title: 'Author' },
      timestamp: { type: 'datetime', title: 'Created at' }
    }
  }
]

// Built-in list types
export const BUILTIN_LIST_TYPES: ListConfig[] = [
  {
    type: 'bullet',
    title: 'Bullet List',
    icon: 'format-list-bulleted',
    maxNesting: 5
  },
  {
    type: 'number',
    title: 'Numbered List', 
    icon: 'format-list-numbered',
    maxNesting: 5
  }
]

// Built-in text styles
export const BUILTIN_TEXT_STYLES: StyleConfig[] = [
  {
    type: 'normal',
    title: 'Normal',
    description: 'Standard paragraph text',
    icon: 'format-paragraph'
  },
  {
    type: 'h1',
    title: 'Heading 1',
    description: 'Top level heading',
    icon: 'format-header-1'
  },
  {
    type: 'h2', 
    title: 'Heading 2',
    description: 'Second level heading',
    icon: 'format-header-2'
  },
  {
    type: 'h3',
    title: 'Heading 3',
    description: 'Third level heading',
    icon: 'format-header-3'
  },
  {
    type: 'h4',
    title: 'Heading 4',
    description: 'Fourth level heading',
    icon: 'format-header-4'
  },
  {
    type: 'h5',
    title: 'Heading 5',
    description: 'Fifth level heading',
    icon: 'format-header-5'
  },
  {
    type: 'h6',
    title: 'Heading 6',
    description: 'Sixth level heading',
    icon: 'format-header-6'
  },
  {
    type: 'blockquote',
    title: 'Quote',
    description: 'Block quote',
    icon: 'format-quote-close'
  }
]

// Default field configuration
export const DEFAULT_PORTABLE_TEXT_CONFIG: PortableTextFieldConfig = {
  blocks: [
    BUILTIN_BLOCK_TYPES[0], // text block
    BUILTIN_BLOCK_TYPES[1], // image
    BUILTIN_BLOCK_TYPES[2]  // code
  ],
  marks: [
    ...BUILTIN_DECORATOR_MARKS.slice(0, 2), // bold, italic
    BUILTIN_ANNOTATION_MARKS[0] // link
  ],
  annotations: [
    BUILTIN_ANNOTATION_MARKS[0] // link
  ],
  lists: BUILTIN_LIST_TYPES,
  styles: [
    BUILTIN_TEXT_STYLES[0], // normal
    BUILTIN_TEXT_STYLES[1], // h1
    BUILTIN_TEXT_STYLES[2], // h2
    BUILTIN_TEXT_STYLES[3], // h3
    BUILTIN_TEXT_STYLES[7]  // blockquote
  ],
  allowedBlockTypes: ['block', 'image', 'code'],
  allowedMarks: ['strong', 'em', 'link'],
  allowedAnnotations: ['link'],
  placeholder: 'Start writing...',
  spellCheck: true
}

// Minimal configuration for simple text editing
export const MINIMAL_PORTABLE_TEXT_CONFIG: PortableTextFieldConfig = {
  blocks: [BUILTIN_BLOCK_TYPES[0]], // text block only
  marks: BUILTIN_DECORATOR_MARKS.slice(0, 2), // bold, italic only
  annotations: [],
  lists: [],
  styles: [BUILTIN_TEXT_STYLES[0]], // normal only
  allowedBlockTypes: ['block'],
  allowedMarks: ['strong', 'em'],
  allowedAnnotations: [],
  placeholder: 'Type here...',
  spellCheck: true
}

// Rich configuration with all features
export const RICH_PORTABLE_TEXT_CONFIG: PortableTextFieldConfig = {
  blocks: BUILTIN_BLOCK_TYPES,
  marks: [...BUILTIN_DECORATOR_MARKS, ...BUILTIN_ANNOTATION_MARKS],
  annotations: BUILTIN_ANNOTATION_MARKS,
  lists: BUILTIN_LIST_TYPES,
  styles: BUILTIN_TEXT_STYLES,
  allowedBlockTypes: ['block', 'image', 'code', 'callout'],
  allowedMarks: ['strong', 'em', 'underline', 'strike-through', 'code', 'link', 'internalLink', 'comment'],
  allowedAnnotations: ['link', 'internalLink', 'comment'],
  placeholder: 'Start creating content...',
  spellCheck: true,
  maxBlocks: 1000
}

// Error codes for validation
export const PORTABLE_TEXT_ERROR_CODES = {
  INVALID_BLOCK_TYPE: 'INVALID_BLOCK_TYPE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_MARK: 'INVALID_MARK',
  INVALID_ANNOTATION: 'INVALID_ANNOTATION',
  MISSING_MARK_DEF: 'MISSING_MARK_DEF',
  ORPHANED_MARK_DEF: 'ORPHANED_MARK_DEF',
  INVALID_SPAN_STRUCTURE: 'INVALID_SPAN_STRUCTURE',
  EXCEEDS_MAX_BLOCKS: 'EXCEEDS_MAX_BLOCKS',
  BELOW_MIN_BLOCKS: 'BELOW_MIN_BLOCKS',
  INVALID_LIST_STRUCTURE: 'INVALID_LIST_STRUCTURE',
  INVALID_TEXT_STYLE: 'INVALID_TEXT_STYLE'
} as const