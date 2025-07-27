import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { 
  RichTextFieldDefinition,
  RichTextContent,
  RichTextOperations,
  ToolbarGroup
} from './definition.js';
import { 
  validateRichTextField,
  sanitizeRichTextValue,
  getDefaultRichTextValue,
  getHTMLContent,
  getTextContent,
  getContentStats,
  normalizeRichTextContent
} from './validation.js';

type RichTextFieldComponentProps = FieldComponentProps;

export function RichTextFieldComponent(props: RichTextFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  if (definition.type !== 'richtext') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected richtext field</div>;
  }
  
  const richtextDefinition = definition as RichTextFieldDefinition;
  const options = richtextDefinition.options || {};
  const validation = richtextDefinition.validation || {};
  
  const sanitizedValue = useMemo(() => 
    sanitizeRichTextValue(value), 
    [value]
  );
  
  const normalizedContent = useMemo(() => 
    normalizeRichTextContent(sanitizedValue),
    [sanitizedValue]
  );
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [showStats, setShowStats] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const lastValueRef = useRef<string>('');
  
  const contentStats = useMemo(() => 
    getContentStats(sanitizedValue),
    [sanitizedValue]
  );
  
  // Initialize editor content only once per field instance
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current) {
      const initialContent = getHTMLContent(sanitizedValue) || '';
      editorRef.current.innerHTML = initialContent;
      lastValueRef.current = initialContent;
      isInitializedRef.current = true;
      console.log(`RichTextField ${fieldId} initialized with content:`, initialContent.slice(0, 50));
    }
  }, [sanitizedValue, fieldId]);
  
  // Handle external value changes (but not our own changes)
  useEffect(() => {
    if (editorRef.current && isInitializedRef.current) {
      const newContent = getHTMLContent(sanitizedValue) || '';
      if (newContent !== lastValueRef.current && newContent !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = newContent;
        lastValueRef.current = newContent;
      }
    }
  }, [sanitizedValue]);
  
  // Rich text operations
  const operations: RichTextOperations = useMemo(() => ({
    insertText: (text: string) => {
      if (editorRef.current) {
        document.execCommand('insertText', false, text);
        handleContentChange();
      }
    },
    
    insertHTML: (html: string) => {
      if (editorRef.current) {
        document.execCommand('insertHTML', false, html);
        handleContentChange();
      }
    },
    
    insertMedia: (url: string, type: 'image' | 'video', alt?: string) => {
      if (type === 'image') {
        const img = `<img src="${url}" alt="${alt || ''}" style="max-width: 100%; height: auto;" />`;
        operations.insertHTML(img);
      } else if (type === 'video') {
        const video = `<video src="${url}" controls style="max-width: 100%; height: auto;"></video>`;
        operations.insertHTML(video);
      }
    },
    
    formatText: (format: string, value?: any) => {
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(format, false, value);
        updateActiveFormats();
        handleContentChange();
      }
    },
    
    toggleFormat: (format: string) => {
      operations.formatText(format);
    },
    
    getHTML: () => {
      return editorRef.current?.innerHTML || '';
    },
    
    getText: () => {
      return editorRef.current?.textContent || '';
    },
    
    getStats: () => {
      const text = operations.getText();
      return {
        words: contentStats.words,
        characters: contentStats.characters,
        readTime: contentStats.readTime
      };
    },
    
    focus: () => {
      editorRef.current?.focus();
    },
    
    clear: () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        handleContentChange();
      }
    },
    
    undo: () => {
      document.execCommand('undo');
      handleContentChange();
    },
    
    redo: () => {
      document.execCommand('redo');
      handleContentChange();
    }
  }), [contentStats]);
  
  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;
      const newText = editorRef.current.textContent || '';
      
      // Update our tracking ref to prevent circular updates
      lastValueRef.current = newHtml;
      
      console.log(`RichTextField ${fieldId} content changed:`, newText.slice(0, 50));
      
      // Calculate stats from the new content
      const newStats = {
        words: newText.trim().split(/\s+/).filter(word => word.length > 0).length,
        characters: newText.length,
        readTime: Math.ceil(newText.trim().split(/\s+/).filter(word => word.length > 0).length / 200)
      };
      
      const newContent: RichTextContent = {
        html: newHtml,
        text: newText,
        metadata: {
          wordCount: newStats.words,
          characterCount: newStats.characters,
          readTime: newStats.readTime,
          lastModified: new Date().toISOString()
        }
      };
      
      onChange(sanitizeRichTextValue(newContent));
    }
  }, [onChange, fieldId]);
  
  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strikethrough');
    
    setActiveFormats(formats);
  }, []);
  
  // Handle selection change to update active formats
  useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveFormats();
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateActiveFormats]);
  
  // Toolbar configuration
  const defaultToolbar = options.toolbar || [
    'bold', 'italic', 'underline', 'strikethrough',
    '|',
    'heading1', 'heading2', 'heading3',
    '|',
    'bulletList', 'orderedList', 'blockquote',
    '|',
    'link', 'image',
    '|',
    'undo', 'redo'
  ];
  
  // Render toolbar button
  const renderToolbarButton = (item: string | ToolbarGroup, index: number) => {
    // Handle toolbar groups
    if (typeof item === 'object' && 'name' in item) {
      return (
        <div key={`group-${index}`} className="flex items-center gap-1">
          {item.items.map((subItem: string, subIndex: number) => renderToolbarButton(subItem, subIndex))}
        </div>
      );
    }
    
    const stringItem = item as string;
    if (stringItem === '|') {
      return <div key={`separator-${index}`} className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />;
    }
    
    const isActive = activeFormats.has(stringItem);
    const buttonClass = `
      p-2 rounded text-sm transition-colors
      ${isActive 
        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
      }
      ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `;
    
    const handleToolbarAction = () => {
      if (isDisabled || isReadonly) return;
      
      switch (stringItem) {
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough':
          operations.toggleFormat(stringItem === 'strikethrough' ? 'strikeThrough' : stringItem);
          break;
        case 'heading1':
          operations.formatText('formatBlock', 'h1');
          break;
        case 'heading2':
          operations.formatText('formatBlock', 'h2');
          break;
        case 'heading3':
          operations.formatText('formatBlock', 'h3');
          break;
        case 'bulletList':
          operations.formatText('insertUnorderedList');
          break;
        case 'orderedList':
          operations.formatText('insertOrderedList');
          break;
        case 'blockquote':
          operations.formatText('formatBlock', 'blockquote');
          break;
        case 'link':
          const url = prompt('Enter URL:');
          if (url) {
            operations.formatText('createLink', url);
          }
          break;
        case 'image':
          const imageUrl = prompt('Enter image URL:');
          if (imageUrl) {
            operations.insertMedia(imageUrl, 'image');
          }
          break;
        case 'undo':
          operations.undo();
          break;
        case 'redo':
          operations.redo();
          break;
      }
    };
    
    // Button icons and labels
    const getButtonContent = () => {
      switch (stringItem) {
        case 'bold': return <strong>B</strong>;
        case 'italic': return <em>I</em>;
        case 'underline': return <u>U</u>;
        case 'strikethrough': return <s>S</s>;
        case 'heading1': return 'H1';
        case 'heading2': return 'H2';
        case 'heading3': return 'H3';
        case 'bulletList': return '•';
        case 'orderedList': return '1.';
        case 'blockquote': return '"';
        case 'link': return '🔗';
        case 'image': return '🖼️';
        case 'undo': return '↶';
        case 'redo': return '↷';
        default: return stringItem;
      }
    };
    
    return (
      <button
        key={`button-${stringItem}-${index}`}
        type="button"
        className={buttonClass}
        onClick={handleToolbarAction}
        title={stringItem}
        disabled={isDisabled || isReadonly}
      >
        {getButtonContent()}
      </button>
    );
  };
  
  return (
    <div className={`richtext-field ${hasError ? 'border-l-4 border-red-400 pl-4' : ''} ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''}`}>
      {/* Toolbar */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-t-md bg-gray-50 dark:bg-gray-800 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            {defaultToolbar.map(renderToolbarButton)}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Stats toggle */}
            {(options.showCharacterCount || options.showWordCount || options.showReadTime) && (
              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Stats
              </button>
            )}
            
            {/* Fullscreen toggle */}
            {options.enableFullscreen && (
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? '⊗' : '⊡'}
              </button>
            )}
          </div>
        </div>
        
        {/* Stats bar */}
        {showStats && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {options.showCharacterCount && (
              <span>Characters: {contentStats.characters}</span>
            )}
            {options.showWordCount && (
              <span>Words: {contentStats.words}</span>
            )}
            {options.showReadTime && (
              <span>Read time: {contentStats.readTime} min</span>
            )}
          </div>
        )}
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!isDisabled && !isReadonly}
        className={`
          border-x border-b border-gray-200 dark:border-gray-700 p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
          ${options.editorClasses || ''}
          ${isFullscreen ? 'flex-1 overflow-auto' : ''}
        `}
        style={{
          minHeight: isFullscreen ? 'auto' : (options.minHeight || '200px'),
          maxHeight: isFullscreen ? 'none' : (options.maxHeight || '600px'),
          overflowY: isFullscreen ? 'auto' : 'auto'
        }}
        onInput={handleContentChange}
        onFocus={updateActiveFormats}
        spellCheck={options.spellCheck}
      />
      
      
      {/* Character/word limits */}
      {(validation.maxLength || validation.maxWords) && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
          {validation.maxLength && (
            <span className={contentStats.characters > validation.maxLength ? 'text-red-500' : ''}>
              {contentStats.characters}/{validation.maxLength} characters
            </span>
          )}
          {validation.maxLength && validation.maxWords && ' • '}
          {validation.maxWords && (
            <span className={contentStats.words > validation.maxWords ? 'text-red-500' : ''}>
              {contentStats.words}/{validation.maxWords} words
            </span>
          )}
        </div>
      )}
    </div>
  );
}