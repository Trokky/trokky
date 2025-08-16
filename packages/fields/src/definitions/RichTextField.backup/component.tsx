import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FC } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  LinkIcon,
  PhotoIcon,
  ListBulletIcon,
  NumberedListIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  EyeIcon,
  ChartBarIcon,
  ArrowsPointingOutIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import type { FieldComponentProps } from '../../base/FieldPlugin';
import type { RichTextFieldDefinition } from './definition';
import { MediaBrowser } from '../MediaField/MediaBrowser';
import { createStudioLogger } from '../../utils/logger';
import { sanitizePastedContent, SECURITY_PRESETS } from './sanitizer';

const logger = createStudioLogger('RichTextField');


type RichTextFieldComponentProps = FieldComponentProps;

export function RichTextFieldComponent(props: RichTextFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly, studioContext } = props;
  
  if (definition.type !== 'richtext') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected richtext field</div>;
  }
  
  const richtextDefinition = definition as RichTextFieldDefinition;
  const options = richtextDefinition.options || {};
  const validation = richtextDefinition.validation || {};
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [sanitizationWarnings, setSanitizationWarnings] = useState<string[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  
  // Get current HTML content
  const currentHtml = useMemo(() => {
    if (typeof value === 'string') return value;
    return '';
  }, [value]);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      editorRef.current.innerHTML = currentHtml;
      setIsInitialized(true);
    }
  }, [currentHtml, isInitialized]);
  
  // Update editor when external value changes
  useEffect(() => {
    if (editorRef.current && isInitialized && currentHtml !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = currentHtml;
    }
  }, [currentHtml, isInitialized]);
  
  // Content statistics
  const contentStats = useMemo(() => {
    const text = editorRef.current?.textContent || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    const readTime = Math.ceil(words / 200);
    
    return { words, characters, readTime };
  }, [currentHtml]);
  
  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;
      logger.debug('Editor content updated', { fieldId, length: newHtml.length });
      onChange(newHtml);
    }
  }, [onChange, fieldId]);
  
  // Handle paste events with sanitization
  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
    
    // Get HTML content if available, otherwise fallback to plain text
    const htmlContent = clipboardData.getData('text/html');
    const textContent = clipboardData.getData('text/plain');
    
    const contentToSanitize = htmlContent || textContent;
    if (!contentToSanitize) return;
    
    // Get paste security configuration
    const pasteConfig = options.pasteSecurity || SECURITY_PRESETS.safe;
    
    // Sanitize the content
    const result = sanitizePastedContent(contentToSanitize, pasteConfig);
    
    logger.debug('Paste content sanitized', {
      fieldId,
      originalLength: result.originalContent.length,
      sanitizedLength: result.sanitizedContent.length,
      wasModified: result.wasModified,
      warnings: result.warnings
    });
    
    // Show warnings if configured and content was modified
    if (pasteConfig.showSanitizationWarning && result.wasModified && result.warnings.length > 0) {
      setSanitizationWarnings(result.warnings);
      setShowWarnings(true);
      
      // Auto-hide warnings after 5 seconds
      setTimeout(() => {
        setShowWarnings(false);
      }, 5000);
    }
    
    // Insert sanitized content
    if (editorRef.current) {
      editorRef.current.focus();
      
      // Use different insertion methods based on content type
      if (result.sanitizedContent.includes('<')) {
        // HTML content
        document.execCommand('insertHTML', false, result.sanitizedContent);
      } else {
        // Plain text content
        document.execCommand('insertText', false, result.sanitizedContent);
      }
      
      handleContentChange();
    }
  }, [options.pasteSecurity, fieldId, handleContentChange]);
  
  // Format text using document.execCommand (fallback for modern approach)
  const formatText = useCallback((command: string, value?: any) => {
    if (editorRef.current) {
      editorRef.current.focus();
      try {
        document.execCommand(command, false, value);
        handleContentChange();
      } catch (error) {
        logger.warn('Command not supported', { command, error });
      }
    }
  }, [handleContentChange]);
  
  // Handle media selection from browser
  const handleMediaSelect = useCallback((media: any) => {
    logger.debug('Media selected for insertion', { media, fieldId });
    
    if (editorRef.current && media && (media.type === 'image' || media.mimeType?.startsWith('image/'))) {
      // Get the proper public URL - check for url field first, then fallback to API path
      const imageUrl = media.url || media.publicUrl || `/api/media/${media._id || media.id}`;
      const alt = media.metadata?.alt || media.alt || media.title || 'Uploaded image';
      const imgHtml = `<img src="${imageUrl}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;" />`;
      
      // Ensure editor is focused and insert image
      editorRef.current.focus();
      
      // Try different insertion methods for better compatibility
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const imgElement = document.createElement('div');
        imgElement.innerHTML = imgHtml;
        range.insertNode(imgElement.firstChild!);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Fallback to execCommand
        document.execCommand('insertHTML', false, imgHtml);
      }
      
      // Trigger change event
      setTimeout(() => handleContentChange(), 100);
      
      logger.info('Image inserted into rich text', { fieldId, mediaId: media._id || media.id, imageUrl });
    } else {
      logger.warn('Invalid media selection or not an image', { media, fieldId });
    }
    setShowMediaBrowser(false);
  }, [fieldId, handleContentChange]);
  
  // Handle link insertion
  const handleAddLink = useCallback(() => {
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed;
    
    if (hasSelection) {
      setShowLinkDialog(true);
    } else {
      // No selection, prompt for URL
      const url = prompt('Enter URL:');
      if (url) {
        formatText('createLink', url);
      }
    }
  }, [formatText]);
  
  const handleLinkSubmit = useCallback(() => {
    if (linkUrl) {
      formatText('createLink', linkUrl);
      setShowLinkDialog(false);
      setLinkUrl('');
    }
  }, [linkUrl, formatText]);
  
  // Check if current format is active
  const isFormatActive = useCallback((format: string) => {
    try {
      return document.queryCommandState(format);
    } catch {
      return false;
    }
  }, []);
  
  // Toolbar button component
  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    title, 
    children, 
    className = '' 
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isDisabled || isReadonly}
      title={title}
      className={`
        p-2 rounded transition-colors ${className}
        ${isActive 
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
        }
        ${disabled || isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {children}
    </button>
  );
  
  const Separator = () => <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />;
  
  return (
    <>
      {/* Rich Text Editor Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .richtext-editor h1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 1rem 0; line-height: 1.2; }
          .richtext-editor h2 { font-size: 1.5rem; font-weight: 600; margin: 1.25rem 0 0.75rem 0; line-height: 1.3; }
          .richtext-editor h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem 0; line-height: 1.4; }
          .richtext-editor p { margin: 0.75rem 0; }
          .richtext-editor ul, .richtext-editor ol { margin: 0.75rem 0; padding-left: 1.5rem; }
          .richtext-editor ul { list-style-type: disc; }
          .richtext-editor ol { list-style-type: decimal; }
          .richtext-editor li { margin: 0.25rem 0; display: list-item; list-style-position: outside; }
          .richtext-editor ul li { list-style-type: disc; }
          .richtext-editor ol li { list-style-type: decimal; }
          .richtext-editor blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #6b7280; }
          .dark .richtext-editor blockquote { border-left-color: #4b5563; color: #9ca3af; }
          .richtext-editor strong { font-weight: 600; }
          .richtext-editor em { font-style: italic; }
          .richtext-editor u { text-decoration: underline; }
          .richtext-editor s { text-decoration: line-through; }
          .richtext-editor a { color: #3b82f6; text-decoration: underline; }
          .dark .richtext-editor a { color: #60a5fa; }
          .richtext-editor img { max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0; display: block; }
        `
      }} />
      
      <div className={`richtext-field ${hasError ? 'border-l-4 border-red-400 pl-4' : ''} ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col' : ''}`}>
      {/* Toolbar */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-t-md bg-gray-50 dark:bg-gray-800 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Text formatting */}
            <ToolbarButton
              onClick={() => formatText('bold')}
              isActive={isFormatActive('bold')}
              title="Bold"
            >
              <BoldIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('italic')}
              isActive={isFormatActive('italic')}
              title="Italic"
            >
              <ItalicIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('underline')}
              isActive={isFormatActive('underline')}
              title="Underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('strikeThrough')}
              isActive={isFormatActive('strikeThrough')}
              title="Strikethrough"
            >
              <StrikethroughIcon className="h-4 w-4" />
            </ToolbarButton>
            
            <Separator />
            
            {/* Headings */}
            <ToolbarButton
              onClick={() => formatText('formatBlock', '<h1>')}
              isActive={false}
              title="Heading 1"
            >
              <span className="text-sm font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('formatBlock', '<h2>')}
              isActive={false}
              title="Heading 2"
            >
              <span className="text-sm font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('formatBlock', '<h3>')}
              isActive={false}
              title="Heading 3"
            >
              <span className="text-sm font-bold">H3</span>
            </ToolbarButton>
            
            <Separator />
            
            {/* Lists and blockquote */}
            <ToolbarButton
              onClick={() => formatText('insertUnorderedList')}
              isActive={isFormatActive('insertUnorderedList')}
              title="Bullet List"
            >
              <ListBulletIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('insertOrderedList')}
              isActive={isFormatActive('insertOrderedList')}
              title="Numbered List"
            >
              <NumberedListIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('formatBlock', '<blockquote>')}
              isActive={false}
              title="Blockquote"
            >
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
            </ToolbarButton>
            
            <Separator />
            
            {/* Link and Image */}
            <ToolbarButton
              onClick={handleAddLink}
              isActive={false}
              title="Add Link"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                if (studioContext?.apiClient) {
                  // Use proper MediaBrowser integration
                  setShowMediaBrowser(true);
                } else {
                  // Fallback for non-Studio environments
                  const url = prompt('Enter image URL:');
                  if (url) {
                    const imgHtml = `<img src="${url}" alt="Image" class="max-w-full h-auto rounded" />`;
                    if (editorRef.current) {
                      editorRef.current.focus();
                      document.execCommand('insertHTML', false, imgHtml);
                      handleContentChange();
                    }
                  }
                }
              }}
              title="Insert Image"
            >
              <span className="text-lg">🖼️</span>
            </ToolbarButton>
            
            <Separator />
            
            {/* History */}
            <ToolbarButton
              onClick={() => formatText('undo')}
              title="Undo"
            >
              <ArrowUturnLeftIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => formatText('redo')}
              title="Redo"
            >
              <ArrowUturnRightIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Stats toggle */}
            {(options.showCharacterCount || options.showWordCount || options.showReadTime) && (
              <ToolbarButton
                onClick={() => setShowStats(!showStats)}
                isActive={showStats}
                title="Toggle statistics"
                className="text-xs"
              >
                <ChartBarIcon className="h-4 w-4" />
              </ToolbarButton>
            )}
            
            {/* Fullscreen toggle */}
            {options.enableFullscreen && (
              <ToolbarButton
                onClick={() => setIsFullscreen(!isFullscreen)}
                isActive={isFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <XMarkIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
              </ToolbarButton>
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
      <div className={`
        border-x border-b border-gray-200 dark:border-gray-700 
        ${isFullscreen ? 'flex-1 overflow-hidden' : ''}
      `}>
        <div
          ref={editorRef}
          contentEditable={!isDisabled && !isReadonly}
          suppressContentEditableWarning={true}
          onInput={handleContentChange}
          onPaste={handlePaste as any}
          spellCheck={options.spellCheck !== false}
          className={`
            richtext-editor p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white leading-relaxed
            ${options.editorClasses || ''}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${isReadonly ? 'pointer-events-none' : ''}
          `}
          style={{
            minHeight: isFullscreen ? 'auto' : (options.minHeight || '200px'),
            maxHeight: isFullscreen ? 'none' : (options.maxHeight || '600px'),
            overflowY: isFullscreen ? 'auto' : 'auto'
          }}
        />
        
        {/* Placeholder */}
        {!currentHtml && (
          <div className="absolute top-4 left-4 text-gray-400 dark:text-gray-500 pointer-events-none">
            {options.placeholder || 'Start typing...'}
          </div>
        )}
      </div>
      
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
      
      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowLinkDialog(false); setLinkUrl(''); }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={!linkUrl}
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Sanitization Warnings */}
      {showWarnings && sanitizationWarnings.length > 0 && (
        <div className="fixed bottom-4 right-4 max-w-md bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-start justify-between">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Content was sanitized for security
                </h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <ul className="list-disc list-inside space-y-1">
                    {sanitizationWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              <button
                type="button"
                className="bg-yellow-50 dark:bg-yellow-900/50 rounded-md p-1.5 text-yellow-400 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                onClick={() => setShowWarnings(false)}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Media Browser */}
      {showMediaBrowser && (
        <MediaBrowser
          isOpen={showMediaBrowser}
          onClose={() => setShowMediaBrowser(false)}
          onSelect={handleMediaSelect}
          mediaTypeFilter="image"
          context="richtext"
          apiClient={studioContext?.apiClient}
          logger={studioContext?.logger || logger}
        />
      )}
      </div>
    </>
  );
}