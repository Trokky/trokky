import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition';

export interface RichTextValidation extends BaseValidation {
  minLength?: number;
  maxLength?: number;
  minWords?: number;
  maxWords?: number;
  requiredElements?: string[];
  prohibitedElements?: string[];
  customValidation?: (content: string) => boolean | string;
}

/**
 * Output format for richtext content storage
 * - 'html': HTML string (default, backwards compatible)
 * - 'prosemirror': ProseMirror/TipTap JSON document structure
 * - 'markdown': Markdown string
 */
export type RichTextOutputFormat = 'html' | 'prosemirror' | 'markdown';

export interface RichTextFieldOptions extends BaseFieldOptions {
  /**
   * Output format for storage
   * - 'html': HTML string (default)
   * - 'prosemirror': ProseMirror JSON document
   * - 'markdown': Markdown string
   */
  outputFormat?: RichTextOutputFormat;
  /** Toolbar items to show */
  toolbar?: string[];
  /** Heading levels to allow (e.g., [1, 2, 3] for H1, H2, H3) */
  headingLevels?: number[];
  /** Editor theme */
  theme?: 'light' | 'dark' | 'auto';
  /** Enable spell check */
  spellCheck?: boolean;
  /** Show content statistics */
  showStats?: boolean;
  showCharacterCount?: boolean;
  showWordCount?: boolean;
  showReadTime?: boolean;
  /** Enable media uploads */
  enableMediaUpload?: boolean;
  /** Enable full-screen mode */
  enableFullscreen?: boolean;
  /** Editor height constraints */
  maxHeight?: string;
  minHeight?: string;
  /** Custom CSS classes */
  editorClasses?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Paste security configuration */
  pasteSecurity?: PasteSecurityConfig;
}

export interface ToolbarGroup {
  name: string;
  items: string[];
}

/**
 * ProseMirror document node structure
 */
export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

/**
 * ProseMirror document structure (TipTap JSON format)
 */
export interface ProseMirrorDocument {
  type: 'doc';
  content: ProseMirrorNode[];
}

/**
 * Rich text content value - can be string (HTML/Markdown) or ProseMirror JSON
 */
export type RichTextValue = string | ProseMirrorDocument;

// Simple rich text content (just HTML) - kept for backwards compatibility
export interface RichTextContent {
  /** HTML content */
  html: string;
  /** Plain text content (auto-generated) */
  text: string;
  /** Content metadata */
  metadata?: {
    wordCount?: number;
    characterCount?: number;
    readTime?: number;
    lastModified?: string;
  };
}


export const RICHTEXT_FIELD_DEFAULTS = {
  validation: {
    required: false,
    minLength: 0,
    maxLength: 10000,
    minWords: 0,
    maxWords: 2000
  } as RichTextValidation,
  
  options: {
    outputFormat: 'html',
    placeholder: 'Start typing...',
    toolbar: [
      'bold', 'italic', 'underline', 'strikethrough',
      '|',
      'heading1', 'heading2', 'heading3',
      '|',
      'bulletList', 'orderedList', 'blockquote',
      '|',
      'link', 'image',
      '|',
      'undo', 'redo'
    ],
    theme: 'auto',
    spellCheck: true,
    showCharacterCount: true,
    showWordCount: true,
    showReadTime: false,
    enableFullscreen: true,
    minHeight: '200px',
    maxHeight: '600px',
    editorClasses: '',
    pasteSecurity: {
      mode: 'safe',
      maxPasteLength: 10000,
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre'],
      allowedAttributes: {
        'a': ['href', 'title', 'target', 'rel', 'class'],
        'table': ['class'],
        'th': ['colspan', 'rowspan', 'class'],
        'td': ['colspan', 'rowspan', 'class'],
        'tr': ['class'],
        'thead': ['class'],
        'tbody': ['class'],
        'pre': ['class'],
        'code': ['class']
      },
      linkPolicy: 'sanitize',
      allowedDomains: [],
      imagePolicy: 'strip',
      showSanitizationWarning: true,
      stripFormatting: false
    }
  } as RichTextFieldOptions,
  
  default: ''
};

// Simple rich text field interface (HTML-based)
export interface RichTextFieldDefinition extends BaseFieldDefinition {
  type: 'richtext';
  validation?: RichTextValidation;
  options?: RichTextFieldOptions;
  default?: string; // Simple HTML string for now
}

// Paste security configuration
export interface PasteSecurityConfig {
  /** Security mode: strict = text only, safe = basic HTML, permissive = advanced HTML */
  mode?: 'strict' | 'safe' | 'permissive';
  /** Maximum length of pasted content */
  maxPasteLength?: number;
  /** Allowed HTML tags (safe/permissive modes) */
  allowedTags?: string[];
  /** Allowed HTML attributes per tag */
  allowedAttributes?: Record<string, string[]>;
  /** How to handle links: strip, sanitize, validate */
  linkPolicy?: 'strip' | 'sanitize' | 'validate';
  /** Allowed link domains (validate mode) */
  allowedDomains?: string[];
  /** How to handle images: strip, proxy, allow */
  imagePolicy?: 'strip' | 'proxy' | 'allow';
  /** Show warning when content is sanitized */
  showSanitizationWarning?: boolean;
  /** Strip all formatting from pasted content */
  stripFormatting?: boolean;
}

