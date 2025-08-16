import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Image from '@tiptap/extension-image';
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
  ChatBubbleBottomCenterTextIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
  PhotoIcon
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

// Simple trash icon
const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
import type { FieldComponentProps } from '../../base/FieldPlugin';
import type { RichTextFieldDefinition } from './definition';
import { createStudioLogger } from '../../utils/logger';
import { MediaBrowser } from '../MediaField/MediaBrowser';
import type { MediaFieldValue } from '../MediaField/definition';

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
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly, studioContext } = props;
  
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
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Image browser state
  const [showImageBrowser, setShowImageBrowser] = useState(false);
  
  // Image toolbar state
  const [selectedImageNode, setSelectedImageNode] = useState<any>(null);
  const [showImageToolbar, setShowImageToolbar] = useState(false);
  const [availableVariants, setAvailableVariants] = useState<Record<string, any>>({});
  
  // Store content when entering fullscreen to ensure persistence
  const [contentBackup, setContentBackup] = useState<string>('');
  
  // Editor container references for positioning
  const editorContainerRef = useRef<HTMLDivElement>(null);
  
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
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg'
        },
        allowBase64: true
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
    },
    onSelectionUpdate: ({ editor }) => {
      handleSelectionUpdate(editor);
    }
  });

  // Ensure editor content is synced when toggling fullscreen
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentContent = editor.getHTML();
      if (currentContent !== value) {
        editor.commands.setContent(value, false); // false = don't emit update event
      }
    }
  }, [editor, value, isFullscreen]);

  // Format operations
  const canUndo = editor?.can().undo() ?? false;
  const canRedo = editor?.can().redo() ?? false;
  

  // Handle selection updates to detect image selection
  const handleSelectionUpdate = useCallback((editor: any) => {
    const { selection } = editor.state;
    
    // First, clear any existing manual selection attributes
    const allImages = editor.view.dom.querySelectorAll('img');
    allImages.forEach((img: HTMLImageElement) => {
      img.removeAttribute('data-selected');
    });
    
    // Check if an image node is selected
    if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
      const imageNode = selection.node;
      const imageSrc = imageNode.attrs.src;
      
      // Add manual selection attribute as fallback
      const selectedImg = editor.view.dom.querySelector(`img[src="${imageSrc}"]`);
      if (selectedImg) {
        selectedImg.setAttribute('data-selected', 'true');
        // Log detailed CSS debugging info
        const computedStyle = window.getComputedStyle(selectedImg);
        logger.debug('Manual selection attribute applied to image', { 
          imageSrc,
          hasSelectedNodeClass: selectedImg.classList.contains('ProseMirror-selectednode'),
          hasDataAttribute: selectedImg.hasAttribute('data-selected'),
          border: computedStyle.border,
          boxShadow: computedStyle.boxShadow,
          transform: computedStyle.transform,
          zIndex: computedStyle.zIndex
        });
        // Force browser console log for easier debugging
        console.log('🔍 Image selection debug:', {
          element: selectedImg,
          classes: selectedImg.className,
          attributes: Array.from(selectedImg.attributes).map(attr => `${(attr as Attr).name}="${(attr as Attr).value}"`),
          computedBorder: computedStyle.border,
          computedBoxShadow: computedStyle.boxShadow
        });
      }
      
      setSelectedImageNode(imageNode);
      
      // Extract asset ID from the URL to load variants
      const assetIdMatch = imageSrc.match(/\/media\/([^\/]+)/);
      if (assetIdMatch && studioContext?.apiClient) {
        const assetId = assetIdMatch[1];
        
        // Load media metadata to get available variants
        studioContext.apiClient.getMediaById(assetId)
          .then(response => {
            if (response.success && response.data?.file?.metadata?.imageVariants) {
              setAvailableVariants(response.data.file.metadata.imageVariants);
            }
          })
          .catch(error => {
            logger.error('Failed to load image variants', error);
          });
      }
      
      // Show contextual toolbar (no positioning needed)
      setShowImageToolbar(true);
    } else {
      // No image selected, hide toolbar
      setShowImageToolbar(false);
      setSelectedImageNode(null);
      setAvailableVariants({});
    }
  }, [studioContext?.apiClient, logger]);
  
  // Fullscreen toggle with content backup
  const toggleFullscreen = useCallback(() => {
    if (!editor) return;
    
    if (!isFullscreen) {
      // Entering fullscreen - backup current content
      const currentContent = editor.getHTML();
      setContentBackup(currentContent);
      logger.debug('Entering fullscreen, backed up content', { length: currentContent.length });
    } else {
      // Exiting fullscreen - ensure content is preserved
      const currentContent = editor.getHTML();
      logger.debug('Exiting fullscreen, current content', { length: currentContent.length });
      if (currentContent && currentContent !== contentBackup) {
        // Content changed in fullscreen, make sure it's saved
        onChange(currentContent);
      }
    }
    
    setIsFullscreen(!isFullscreen);
  }, [editor, isFullscreen, contentBackup, onChange]);


  // Escape key handler for fullscreen mode
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when fullscreen
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isFullscreen, toggleFullscreen]);


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
  
  // Handle image selection from media browser
  const handleImageSelected = useCallback((selectedValue: MediaFieldValue) => {
    if (!editor || !selectedValue?.asset?._ref) {
      return;
    }
    
    const assetId = selectedValue.asset._ref;
    let altText = selectedValue.alt || '';
    
    // Get the media metadata to extract the correct URL
    if (studioContext?.apiClient) {
      studioContext.apiClient.getMediaById(assetId)
        .then(response => {
          if (response.success && response.data?.file) {
            const mediaFile = response.data.file;
            let imageUrl: string;
            
            // Use metadata alt text if no alt text was provided
            if (!selectedValue.alt) {
              altText = mediaFile.metadata?.alt || mediaFile.filename || '';
            }
            
            // Get the correct URL from the API response
            if (selectedValue.variant && selectedValue.variant !== 'original') {
              // Use variant URL from metadata
              const variantData = mediaFile.metadata?.imageVariants?.[selectedValue.variant];
              if (variantData?.url) {
                imageUrl = variantData.url;
              } else {
                logger.warn(`Variant '${selectedValue.variant}' not found, falling back to original`);
                imageUrl = mediaFile.url;
              }
            } else {
              // Use original file URL from metadata
              imageUrl = mediaFile.url;
            }
            
            // Insert the image into the editor
            editor.chain().focus().setImage({ 
              src: imageUrl, 
              alt: altText,
              title: altText
            }).run();
            
            logger.info('Image inserted successfully', {
              imageUrl,
              altText,
              assetId,
              variant: selectedValue.variant
            });
          } else {
            logger.error('Invalid media metadata response', response);
          }
        })
        .catch(error => {
          logger.error('Failed to load image asset', error);
        });
    } else {
      logger.warn('No Studio context available for image URL resolution');
    }
    
    setShowImageBrowser(false);
  }, [editor, studioContext?.apiClient, logger]);
  
  // Handle variant change for selected image
  const handleVariantChange = useCallback((variantName: string) => {
    if (!editor || !selectedImageNode) return;
    
    const imageSrc = selectedImageNode.attrs.src;
    const assetIdMatch = imageSrc.match(/\/media\/([^\/]+)/);
    
    if (assetIdMatch) {
      const assetId = assetIdMatch[1];
      let newImageUrl: string;
      
      if (variantName === 'original') {
        // Use original file URL
        newImageUrl = imageSrc.replace(/\/variants\/[^\/]+/, '/file');
      } else {
        // Use variant URL
        const variantData = availableVariants[variantName];
        if (variantData?.url) {
          newImageUrl = variantData.url;
        } else {
          logger.warn(`Variant '${variantName}' not found`);
          return;
        }
      }
      
      // Update the image src attribute
      editor.chain().focus().updateAttributes('image', { src: newImageUrl }).run();
      
      // Update the selected image node in state to reflect the new src
      setSelectedImageNode({
        ...selectedImageNode,
        attrs: {
          ...selectedImageNode.attrs,
          src: newImageUrl
        }
      });
      
      logger.info('Image variant changed', { 
        assetId, 
        variant: variantName, 
        newUrl: newImageUrl 
      });
    }
  }, [editor, selectedImageNode, availableVariants, logger]);
  
  // Get current variant from image URL
  const getCurrentVariant = useCallback((imageSrc: string) => {
    if (imageSrc.includes('/variants/')) {
      const variantMatch = imageSrc.match(/\/variants\/([^\/]+)/);
      return variantMatch ? variantMatch[1] : 'original';
    }
    return 'original';
  }, []);

  // Handle image deletion
  const handleDeleteImage = useCallback(() => {
    if (!editor) return;
    
    editor.chain().focus().deleteSelection().run();
    setShowImageToolbar(false);
    setSelectedImageNode(null);
    setAvailableVariants({});
    
    logger.info('Image deleted');
  }, [editor, logger]);
  
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
    <>
      {/* Normal Mode */}
      {!isFullscreen && (
        <div className={`rich-text-field ${hasError ? 'border-l-4 border-red-400 dark:border-red-500 pl-4' : ''}`}>
          {/* Toolbar */}
          {!isReadonly && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-t-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="flex items-center justify-between">
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
            
            {/* Images */}
            <ToolbarButton
              onClick={() => setShowImageBrowser(true)}
              isActive={false}
              isDisabled={isDisabled}
              icon={PhotoIcon}
              title="Insert Image"
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
                
                {/* Fullscreen toggle (if enabled) - separated on the right */}
                {options.enableFullscreen && (
                  <ToolbarButton
                    onClick={toggleFullscreen}
                    isActive={isFullscreen}
                    isDisabled={isDisabled}
                    icon={ArrowsPointingOutIcon}
                    title="Fullscreen"
                  />
                )}
              </div>
        </div>
      )}
      
      {/* Contextual Image Toolbar */}
      {!isReadonly && showImageToolbar && selectedImageNode && (
        <div className="border-l border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhotoIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Image Options:</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Variant Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Variant:</label>
                <select
                  value={getCurrentVariant(selectedImageNode.attrs.src)}
                  onChange={(e) => handleVariantChange(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isDisabled}
                >
                  <option value="original">Original</option>
                  {Object.entries(availableVariants).map(([variantName, variantData]: [string, any]) => (
                    <option key={variantName} value={variantName}>
                      {variantName.charAt(0).toUpperCase() + variantName.slice(1)} ({variantData.width}×{variantData.height})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDeleteImage}
                disabled={isDisabled}
                className="px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
                title="Delete Image"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </div>
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
        <div className="tiptap-editor-container relative" ref={editorContainerRef}>
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
              .tiptap-editor-container .ProseMirror img {
                max-width: 100% !important;
                height: auto !important;
                border-radius: 0.5rem !important;
                margin: 0.5rem 0 !important;
                display: block !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
              }
              .tiptap-editor-container .ProseMirror img:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
              }
              /* Direct image selection styles with maximum specificity */
              img.ProseMirror-selectednode {
                border: 4px solid #3b82f6 !important;
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 20px rgba(59, 130, 246, 0.4) !important;
                transform: scale(1.03) !important;
                outline: none !important;
                background: rgba(59, 130, 246, 0.1) !important;
                position: relative !important;
                z-index: 100 !important;
              }
              
              /* Backup selector with blue styling to match */
              .ProseMirror img[data-selected="true"] {
                border: 3px solid #3b82f6 !important;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(59, 130, 246, 0.2) !important;
                transform: scale(1.02) !important;
                outline: none !important;
              }
              
              /* Selection container styles */
              .rich-text-field .tiptap-editor-container .ProseMirror .ProseMirror-selectednode,
              .tiptap-editor-container .ProseMirror .ProseMirror-selectednode {
                position: relative !important;
                margin: 8px !important;
              }
              
              .rich-text-field .tiptap-editor-container .ProseMirror .ProseMirror-selectednode::before,
              .tiptap-editor-container .ProseMirror .ProseMirror-selectednode::before {
                content: '' !important;
                position: absolute !important;
                top: -8px !important;
                left: -8px !important;
                right: -8px !important;
                bottom: -8px !important;
                border: 2px dashed #3b82f6 !important;
                border-radius: 1rem !important;
                pointer-events: none !important;
                background: rgba(59, 130, 246, 0.05) !important;
                z-index: 9 !important;
              }
              
              .dark .rich-text-field .tiptap-editor-container .ProseMirror .ProseMirror-selectednode::before,
              .dark .tiptap-editor-container .ProseMirror .ProseMirror-selectednode::before {
                border-color: #60a5fa !important;
                background: rgba(96, 165, 250, 0.05) !important;
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
          {!isFullscreen && (
            <EditorContent 
              key="editor-content"
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[150px] text-gray-900 dark:text-gray-100 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:border-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100"
            />
          )}
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
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col">
          {/* Fullscreen Toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 flex-shrink-0">
            <div className="flex items-center justify-between">
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
                
                {/* Images */}
                <ToolbarButton
                  onClick={() => setShowImageBrowser(true)}
                  isActive={false}
                  isDisabled={isDisabled}
                  icon={PhotoIcon}
                  title="Insert Image"
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
              
              {/* Close button */}
              <ToolbarButton
                onClick={toggleFullscreen}
                isActive={false}
                isDisabled={false}
                icon={XMarkIcon}
                title="Exit Fullscreen"
              />
            </div>
          </div>
          
          {/* Contextual Image Toolbar - Fullscreen */}
          {showImageToolbar && selectedImageNode && (
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhotoIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Image Options:</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Variant Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Variant:</label>
                    <select
                      value={getCurrentVariant(selectedImageNode.attrs.src)}
                      onChange={(e) => handleVariantChange(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isDisabled}
                    >
                      <option value="original">Original</option>
                      {Object.entries(availableVariants).map(([variantName, variantData]: [string, any]) => (
                        <option key={variantName} value={variantName}>
                          {variantName.charAt(0).toUpperCase() + variantName.slice(1)} ({variantData.width}×{variantData.height})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={handleDeleteImage}
                    disabled={isDisabled}
                    className="px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
                    title="Delete Image"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Fullscreen Editor Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 tiptap-editor-container">
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
                  .tiptap-editor-container .ProseMirror img {
                    max-width: 100% !important;
                    height: auto !important;
                    border-radius: 0.5rem !important;
                    margin: 0.5rem 0 !important;
                    display: block !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                  }
                  .tiptap-editor-container .ProseMirror img:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                  }
                  /* High specificity selection styles - Fullscreen */
                  .tiptap-editor-container .ProseMirror img.ProseMirror-selectednode,
                  .ProseMirror img.ProseMirror-selectednode {
                    border: 4px solid #3b82f6 !important;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 20px rgba(59, 130, 246, 0.4) !important;
                    transform: scale(1.03) !important;
                    outline: none !important;
                    transition: all 0.2s ease !important;
                    position: relative !important;
                    z-index: 10 !important;
                  }
                  
                  .dark .tiptap-editor-container .ProseMirror img.ProseMirror-selectednode,
                  .dark .ProseMirror img.ProseMirror-selectednode {
                    border-color: #60a5fa !important;
                    box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.3), 0 4px 20px rgba(96, 165, 250, 0.5) !important;
                  }
                  
                  /* Selection container styles - Fullscreen */
                  .tiptap-editor-container .ProseMirror .ProseMirror-selectednode {
                    position: relative !important;
                    margin: 8px !important;
                  }
                  
                  .tiptap-editor-container .ProseMirror .ProseMirror-selectednode::before {
                    content: '' !important;
                    position: absolute !important;
                    top: -8px !important;
                    left: -8px !important;
                    right: -8px !important;
                    bottom: -8px !important;
                    border: 2px dashed #3b82f6 !important;
                    border-radius: 1rem !important;
                    pointer-events: none !important;
                    background: rgba(59, 130, 246, 0.05) !important;
                    z-index: 9 !important;
                  }
                  
                  .dark .tiptap-editor-container .ProseMirror .ProseMirror-selectednode::before {
                    border-color: #60a5fa !important;
                    background: rgba(96, 165, 250, 0.05) !important;
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
                key="editor-content"
                editor={editor}
                className="prose prose-sm dark:prose-invert max-w-none p-8 h-full overflow-y-auto text-gray-900 dark:text-gray-100 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:border-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror]:h-full [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100"
              />
            </div>
          </div>
          
          {/* Fullscreen Footer with stats */}
          {options.showStats && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 flex-shrink-0">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-6">
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
            </div>
          )}
        </div>
      )}
      
      {/* Image Browser Modal */}
      {showImageBrowser && (
        <MediaBrowser
          isOpen={showImageBrowser}
          onClose={() => setShowImageBrowser(false)}
          onSelect={handleImageSelected}
          mediaTypeFilter="image"
          showVariantSelector={true}
          context="richtext-image"
          apiClient={studioContext?.apiClient}
          logger={studioContext?.logger}
        />
      )}
      
    </>
  );
}