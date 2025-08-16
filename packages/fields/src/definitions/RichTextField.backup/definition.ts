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

export interface RichTextFieldOptions extends BaseFieldOptions {
  /** Available text styles */
  styles?: Array<{
    name: string;
    title: string;
    value: string;
    component?: React.ComponentType;
  }>;
  /** Available decorators (marks) */
  decorators?: Array<{
    name: string;
    title: string;
    icon?: React.ComponentType;
    component?: React.ComponentType;
  }>;
  /** Available annotations (links, etc.) */
  annotations?: Array<{
    name: string;
    title: string;
    type: object;
    icon?: React.ComponentType;
    component?: React.ComponentType;
  }>;
  /** Available block types */
  blockTypes?: Array<{
    name: string;
    title: string;
    value: string;
  }>;
  /** Available list types */
  lists?: Array<{
    name: string;
    title: string;
    value: string;
  }>;
  /** Editor theme */
  theme?: 'light' | 'dark' | 'auto';
  /** Enable spell check */
  spellCheck?: boolean;
  /** Enable markdown shortcuts */
  markdownShortcuts?: boolean;
  /** Auto-save interval (milliseconds) */
  autoSave?: number;
  /** Show content statistics */
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
}

export interface ToolbarGroup {
  name: string;
  items: string[];
}

// Simple rich text content (just HTML)
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
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
      allowedAttributes: {
        'a': ['href', 'title']
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

// Simplified toolbar configuration
export interface RichTextFieldOptions extends BaseFieldOptions {
  /** Toolbar items to show */
  toolbar?: string[];
  /** Editor theme */
  theme?: 'light' | 'dark' | 'auto';
  /** Enable spell check */
  spellCheck?: boolean;
  /** Show content statistics */
  showCharacterCount?: boolean;
  showWordCount?: boolean;
  showReadTime?: boolean;
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