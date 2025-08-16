import React, { useCallback, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  LinkIcon,
  ListBulletIcon,
  NumberedListIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';

// Simple heading icons
const H1Icon = ({ className }: { className?: string }) => (
  <span className={`font-bold text-base ${className || ''}`}>H1</span>
);
const H2Icon = ({ className }: { className?: string }) => (
  <span className={`font-bold text-sm ${className || ''}`}>H2</span>
);
const H3Icon = ({ className }: { className?: string }) => (
  <span className={`font-bold text-xs ${className || ''}`}>H3</span>
);
import type { FieldComponentProps } from '../../base/FieldPlugin';
import type { RichTextFieldDefinition } from './definition';
import { createStudioLogger } from '../../utils/logger';

const logger = createStudioLogger('RichTextField');

type RichTextFieldComponentProps = FieldComponentProps;

// Toolbar button component
function ToolbarButton({ 
  onClick, 
  isActive = false, 
  isDisabled = false,
  icon: Icon,
  title 
}: {
  onClick: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className={`
        p-2 rounded transition-colors
        ${isActive 
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-900 dark:hover:text-white'}
      `}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Toolbar separator
function ToolbarSeparator() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />;
}

export function RichTextFieldComponent(props: RichTextFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  if (definition.type !== 'richtext') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected richtext field</div>;
  }
  
  const richtextDefinition = definition as RichTextFieldDefinition;
  const options = richtextDefinition.options || {};
  const validation = richtextDefinition.validation || {};
  
  // Character limit from validation
  const characterLimit = validation.maxLength;
  
  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  
  // Check if we're in dark mode
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: (options.headingLevels || [1, 2, 3]) as any
        }
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300'
        }
      }),
      Placeholder.configure({
        placeholder: options.placeholder || 'Start typing...'
      }),
      ...(characterLimit ? [CharacterCount.configure({ limit: characterLimit })] : [])
    ],
    content: value || '',
    editable: !isDisabled && !isReadonly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      logger.debug('Content updated', { fieldId, length: html.length });
      onChange(html);
    }
  });

  // Format operations
  const canUndo = editor?.can().undo() ?? false;
  const canRedo = editor?.can().redo() ?? false;
  
  // Add link functionality
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    
    const selection = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(selection.from, selection.to);
    const existingLink = editor.getAttributes('link').href;
    
    setLinkText(selectedText || '');
    setLinkUrl(existingLink || '');
    setShowLinkDialog(true);
  }, [editor]);
  
  const handleLinkSubmit = useCallback(() => {
    if (!editor) return;
    
    if (!linkUrl.trim()) {
      // Remove link if URL is empty
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      // Add or update link
      const selection = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(selection.from, selection.to);
      
      if (selectedText || linkText.trim()) {
        // If there's selected text or link text provided
        if (linkText.trim() && linkText !== selectedText) {
          // Replace selection with link text
          editor.chain().focus().deleteSelection().insertContent(linkText).setLink({ href: linkUrl }).run();
        } else {
          // Just add link to existing selection
          editor.chain().focus().setLink({ href: linkUrl }).run();
        }
      } else {
        // No selection, insert link text with URL
        const text = linkText.trim() || linkUrl;
        editor.chain().focus().insertContent(`<a href="${linkUrl}">${text}</a>`).run();
      }
    }
    
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
  }, [editor, linkUrl, linkText]);
  
  // Content statistics
  const stats = useMemo(() => {
    if (!editor) return { words: 0, characters: 0, readTime: 0 };
    
    const text = editor.state.doc.textContent;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = editor.storage.characterCount?.characters() ?? text.length;
    const readTime = Math.ceil(words / 200);
    
    return { words, characters, readTime };
  }, [editor?.state.doc, editor?.storage.characterCount]);
  
  if (!editor) {
    return <div>Loading editor...</div>;
  }
  
  return (
    <div className={`rich-text-field ${hasError ? 'border-l-4 border-red-400 dark:border-red-500 pl-4' : ''}`}>
      {/* Toolbar */}
      {!isReadonly && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-t-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Text formatting */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              isDisabled={isDisabled}
              icon={BoldIcon}
              title="Bold"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              isDisabled={isDisabled}
              icon={ItalicIcon}
              title="Italic"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              isDisabled={isDisabled}
              icon={UnderlineIcon}
              title="Underline"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              isDisabled={isDisabled}
              icon={StrikethroughIcon}
              title="Strikethrough"
            />
            
            <ToolbarSeparator />
            
            {/* Headings */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              isDisabled={isDisabled}
              icon={H1Icon}
              title="Heading 1"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              isDisabled={isDisabled}
              icon={H2Icon}
              title="Heading 2"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              isDisabled={isDisabled}
              icon={H3Icon}
              title="Heading 3"
            />
            
            <ToolbarSeparator />
            
            {/* Quote */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              isDisabled={isDisabled}
              icon={ChatBubbleBottomCenterTextIcon}
              title="Quote"
            />
            
            <ToolbarSeparator />
            
            {/* Links */}
            <ToolbarButton
              onClick={openLinkDialog}
              isActive={editor.isActive('link')}
              isDisabled={isDisabled}
              icon={LinkIcon}
              title="Add Link"
            />
            
            <ToolbarSeparator />
            
            {/* Lists */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              isDisabled={isDisabled}
              icon={ListBulletIcon}
              title="Bullet List"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              isDisabled={isDisabled}
              icon={NumberedListIcon}
              title="Numbered List"
            />
            
            <ToolbarSeparator />
            
            {/* History */}
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              isDisabled={isDisabled || !canUndo}
              icon={ArrowUturnLeftIcon}
              title="Undo"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              isDisabled={isDisabled || !canRedo}
              icon={ArrowUturnRightIcon}
              title="Redo"
            />
          </div>
        </div>
      )}
      
      {/* Editor */}
      <div 
        className={`
          border border-t-0 border-gray-200 dark:border-gray-700 
          ${isReadonly ? 'rounded-lg' : 'rounded-b-lg'}
          bg-white dark:bg-gray-900
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="tiptap-editor-container">
          <style dangerouslySetInnerHTML={{
            __html: `
              .tiptap-editor-container .ProseMirror h1 {
                font-size: 1.875rem !important;
                font-weight: 700 !important;
                margin-bottom: 1rem !important;
                margin-top: 0.5rem !important;
                line-height: 1.2 !important;
              }
              .tiptap-editor-container .ProseMirror h2 {
                font-size: 1.5rem !important;
                font-weight: 600 !important;
                margin-bottom: 0.75rem !important;
                margin-top: 0.5rem !important;
                line-height: 1.3 !important;
              }
              .tiptap-editor-container .ProseMirror h3 {
                font-size: 1.25rem !important;
                font-weight: 600 !important;
                margin-bottom: 0.5rem !important;
                margin-top: 0.5rem !important;
                line-height: 1.4 !important;
              }
              .tiptap-editor-container .ProseMirror blockquote {
                border-left: 3px solid #d1d5db !important;
                padding-left: 1rem !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                font-style: italic !important;
              }
              .dark .tiptap-editor-container .ProseMirror blockquote {
                border-left-color: #4b5563 !important;
              }
              .tiptap-editor-container .ProseMirror ul {
                list-style-type: disc !important;
                padding-left: 1.5rem !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
              }
              .tiptap-editor-container .ProseMirror ol {
                list-style-type: decimal !important;
                padding-left: 1.5rem !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
              }
              .tiptap-editor-container .ProseMirror li {
                margin-bottom: 0.25rem !important;
              }
              .tiptap-editor-container .ProseMirror {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
              }
              .tiptap-editor-container .ProseMirror:focus {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
              }
            `
          }} />
          <EditorContent 
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[150px] text-gray-900 dark:text-gray-100 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:border-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100"
          />
        </div>
      </div>
      
      {/* Footer with stats */}
      {options.showStats && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>{stats.words} words</span>
            <span>{stats.characters}{characterLimit ? ` / ${characterLimit}` : ''} characters</span>
            <span>{stats.readTime} min read</span>
          </div>
          {characterLimit && stats.characters > characterLimit && (
            <div className="text-red-500 dark:text-red-400">
              Exceeds character limit
            </div>
          )}
        </div>
      )}
      
      {/* Link Dialog Modal */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Link
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Enter link text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 bg-white dark:bg-gray-700"
                  style={{ 
                    WebkitBoxShadow: isDarkMode ? '0 0 0 1000px #374151 inset' : '0 0 0 1000px white inset',
                    WebkitTextFillColor: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 bg-white dark:bg-gray-700"
                  style={{ 
                    WebkitBoxShadow: isDarkMode ? '0 0 0 1000px #374151 inset' : '0 0 0 1000px white inset',
                    WebkitTextFillColor: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setLinkText('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                {linkUrl.trim() ? 'Add Link' : 'Remove Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}