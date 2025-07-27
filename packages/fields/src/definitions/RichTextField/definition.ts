import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

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
  toolbar?: Array<string | ToolbarGroup>;
  spellCheck?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  markdownShortcuts?: boolean;
  autoSave?: number;
  showCharacterCount?: boolean;
  showWordCount?: boolean;
  showReadTime?: boolean;
  enableMediaUpload?: boolean;
  enableLinkEditing?: boolean;
  enableTables?: boolean;
  enableCodeHighlighting?: boolean;
  maxHeight?: string;
  minHeight?: string;
  enableFullscreen?: boolean;
  editorClasses?: string;
}

export interface ToolbarGroup {
  name: string;
  items: string[];
}

export interface RichTextContent {
  html?: string;
  text?: string;
  blocks?: RichTextBlock[];
  metadata?: {
    wordCount?: number;
    characterCount?: number;
    readTime?: number;
    lastModified?: string;
  };
}

export interface RichTextBlock {
  type: 'paragraph' | 'heading' | 'list' | 'quote' | 'code' | 'image' | 'video' | 'divider';
  content?: string;
  attrs?: Record<string, any>;
  children?: RichTextBlock[];
}

export interface RichTextFieldDefinition extends BaseFieldDefinition {
  type: 'richtext';
  validation?: RichTextValidation;
  options?: RichTextFieldOptions;
  default?: string | RichTextContent;
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
    spellCheck: true,
    theme: 'light',
    markdownShortcuts: true,
    autoSave: 5000,
    showCharacterCount: true,
    showWordCount: true,
    showReadTime: false,
    enableMediaUpload: true,
    enableLinkEditing: true,
    enableTables: false,
    enableCodeHighlighting: true,
    minHeight: '200px',
    maxHeight: '600px',
    enableFullscreen: true,
    editorClasses: ''
  } as RichTextFieldOptions,
  
  default: '' as string
};

export interface RichTextOperations {
  insertText: (text: string) => void;
  insertHTML: (html: string) => void;
  insertMedia: (url: string, type: 'image' | 'video', alt?: string) => void;
  formatText: (format: string, value?: any) => void;
  toggleFormat: (format: string) => void;
  getHTML: () => string;
  getText: () => string;
  getStats: () => { words: number; characters: number; readTime: number };
  focus: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}