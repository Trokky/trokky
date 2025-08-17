import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

export interface PortableTextValidation extends BaseValidation {
  minBlocks?: number;
  maxBlocks?: number;
  minLength?: number;
  maxLength?: number;
  allowedBlockTypes?: string[];
  requiredBlockTypes?: string[];
  allowedMarks?: string[];
  allowedStyles?: string[];
  customValidation?: (content: PortableTextContent) => boolean | string;
}

export interface PortableTextFieldOptions extends BaseFieldOptions {
  enabledBlockTypes?: string[];
  enabledMarks?: string[];
  enabledStyles?: string[];
  spellCheck?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  showBlockCount?: boolean;
  showCharacterCount?: boolean;
  showWordCount?: boolean;
  enableFullscreen?: boolean;
  collapsible?: boolean;
  defaultBlockType?: string;
  maxNestingDepth?: number;
  
  // Paste security options
  pasteSecurity?: {
    mode?: 'strict' | 'safe' | 'permissive'; // strict = plain text only, safe = sanitized HTML, permissive = minimal sanitization
    allowedDomains?: string[]; // For links in permissive mode
    stripFormatting?: boolean; // Remove all formatting from pasted content
    maxPasteLength?: number; // Limit pasted content length
    warnOnUnsafeContent?: boolean; // Show warning when dangerous content is detected
  };
}

// Portable text block structure
export interface PortableTextBlock {
  _key: string;
  _type: string;
  style?: string;
  level?: number;
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
}

// Text spans with marks
export interface PortableTextSpan {
  _key: string;
  _type: 'span';
  text: string;
  marks?: string[];
}

// Mark definitions (for links, references, etc.)
export interface PortableTextMarkDef {
  _key: string;
  _type: string;
  [key: string]: any; // Allow additional properties for different mark types
}

// Link mark definition
export interface PortableTextLinkMark extends PortableTextMarkDef {
  _type: 'link';
  href: string;
  title?: string;
  target?: '_blank' | '_self';
}

// Reference mark definition
export interface PortableTextReferenceMark extends PortableTextMarkDef {
  _type: 'reference';
  reference: {
    _ref: string;
    _type: string;
  };
}

// Complete portable text content
export interface PortableTextContent {
  blocks: PortableTextBlock[];
  metadata?: {
    blockCount?: number;
    characterCount?: number;
    wordCount?: number;
    lastModified?: string;
    version?: string;
  };
}

export interface PortableTextFieldDefinition extends BaseFieldDefinition {
  type: 'portable';
  validation?: PortableTextValidation;
  options?: PortableTextFieldOptions;
  default?: PortableTextContent;
}

export const PORTABLE_TEXT_FIELD_DEFAULTS = {
  validation: {
    required: false,
    minBlocks: 0,
    maxBlocks: 100,
    minLength: 0,
    maxLength: 50000,
    allowedBlockTypes: ['block', 'heading', 'list', 'quote', 'code'],
    allowedMarks: ['strong', 'em', 'underline', 'code', 'link'],
    allowedStyles: ['normal', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']
  } as PortableTextValidation,
  
  options: {
    placeholder: 'Start writing...',
    enabledBlockTypes: ['block', 'heading', 'list', 'quote'],
    enabledMarks: ['strong', 'em', 'underline', 'link'],
    enabledStyles: ['normal', 'h1', 'h2', 'h3', 'blockquote'],
    spellCheck: true,
    theme: 'light',
    showBlockCount: false,
    showCharacterCount: true,
    showWordCount: true,
    enableFullscreen: true,
    collapsible: false,
    defaultBlockType: 'block',
    maxNestingDepth: 3
  } as PortableTextFieldOptions,
  
  default: {
    blocks: [],
    metadata: {
      blockCount: 0,
      characterCount: 0,
      wordCount: 0,
      version: '1.0'
    }
  } as PortableTextContent
};

// Block type definitions
export const BLOCK_TYPES = {
  BLOCK: 'block',
  HEADING: 'heading', 
  LIST: 'list',
  LIST_ITEM: 'listItem',
  QUOTE: 'quote',
  CODE: 'code',
  IMAGE: 'image',
  DIVIDER: 'divider'
} as const;

// Style definitions
export const BLOCK_STYLES = {
  NORMAL: 'normal',
  H1: 'h1',
  H2: 'h2', 
  H3: 'h3',
  H4: 'h4',
  H5: 'h5',
  H6: 'h6',
  BLOCKQUOTE: 'blockquote'
} as const;

// Mark definitions
export const MARKS = {
  STRONG: 'strong',
  EM: 'em',
  UNDERLINE: 'underline',
  CODE: 'code',
  STRIKE: 'strike',
  LINK: 'link',
  REFERENCE: 'reference'
} as const;

// Operations for portable text
export interface PortableTextOperations {
  insertBlock: (blockType: string, style?: string, position?: number) => void;
  removeBlock: (blockKey: string) => void;
  updateBlock: (blockKey: string, updates: Partial<PortableTextBlock>) => void;
  moveBlock: (blockKey: string, newPosition: number) => void;
  
  insertText: (blockKey: string, text: string, position: number) => void;
  deleteText: (blockKey: string, start: number, end: number) => void;
  
  toggleMark: (blockKey: string, spanKey: string, mark: string) => void;
  addMark: (blockKey: string, spanKey: string, mark: string, markDef?: PortableTextMarkDef) => void;
  removeMark: (blockKey: string, spanKey: string, mark: string) => void;
  
  convertBlockType: (blockKey: string, newType: string, newStyle?: string) => void;
  
  getPlainText: () => string;
  getStats: () => { blocks: number; characters: number; words: number };
  
  focus: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}