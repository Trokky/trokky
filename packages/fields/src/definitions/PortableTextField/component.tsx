import React, { useState, useCallback, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin';
import type { 
  PortableTextFieldDefinition,
  PortableTextContent,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDef
} from './definition';
import { 
  validatePortableTextField,
  sanitizePortableTextValue,
  getPlainTextFromPortableText,
  getPortableTextStats,
  normalizePortableTextContent,
  generateKey
} from './validation';
import { BLOCK_STYLES, MARKS } from './definition';
import { createStudioLogger } from '../../utils/logger';

const logger = createStudioLogger('PortableTextField');

type PortableTextFieldComponentProps = FieldComponentProps;


interface DragState {
  isDragging: boolean;
  draggedBlockKey: string | null;
  dragOverBlockKey: string | null;
  dragPosition: 'before' | 'after' | null;
}

export function PortableTextFieldComponent(props: PortableTextFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  if (definition.type !== 'portable') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected portable field</div>;
  }
  
  const portableDefinition = definition as PortableTextFieldDefinition;
  const options = portableDefinition.options || {};
  const validation = portableDefinition.validation || {};
  
  const sanitizedValue = useMemo(() => 
    sanitizePortableTextValue(value), 
    [value]
  );
  
  const normalizedContent = useMemo(() => 
    normalizePortableTextContent(sanitizedValue),
    [sanitizedValue]
  );
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedBlockKey: null,
    dragOverBlockKey: null,
    dragPosition: null
  });
  const editorRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const blockMenuRef = useRef<HTMLDivElement>(null);
  
  const contentStats = useMemo(() => 
    getPortableTextStats(sanitizedValue),
    [sanitizedValue]
  );
  
  // Close block menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (blockMenuRef.current && !blockMenuRef.current.contains(event.target as Node)) {
        setShowBlockMenu(false);
      }
    }
    
    if (showBlockMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBlockMenu]);
  
  // Ensure we always have at least one block for rendering
  const blocksToRender = useMemo(() => {
    if (!normalizedContent.blocks || normalizedContent.blocks.length === 0) {
      return [{
        _key: 'default-block',
        _type: 'block' as const,
        style: 'normal',
        children: [{
          _key: 'default-span',
          _type: 'span' as const,
          text: '',
          marks: []
        }]
      }];
    }
    return normalizedContent.blocks;
  }, [normalizedContent.blocks]);
  
  // Update content with new blocks
  const updateContent = useCallback((newBlocks: PortableTextBlock[]) => {
    const plainText = getPlainTextFromPortableText({ blocks: newBlocks });
    const updatedContent: PortableTextContent = {
      blocks: newBlocks,
      metadata: {
        blockCount: newBlocks.length,
        characterCount: plainText.length,
        wordCount: getPortableTextStats({ blocks: newBlocks }).words,
        lastModified: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    logger.debug('Updating portable text content', { 
      fieldId, 
      blockCount: newBlocks.length 
    });
    
    onChange(sanitizePortableTextValue(updatedContent));
  }, [onChange, fieldId]);
  
  // Handle text input in a block (preserve existing marks, only update text)
  const handleBlockInput = useCallback((blockKey: string, element: HTMLElement) => {
    const newText = element.textContent || '';
    
    // Store cursor position before updating
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const offset = range?.startOffset || 0;
    
    const blocks = blocksToRender.map(block => {
      if (block._key === blockKey) {
        return {
          ...block,
          children: [{
            ...block.children![0],
            text: newText
            // Keep existing marks - don't change them during typing
          }]
        };
      }
      return block;
    });
    
    updateContent(blocks);
    
    // Restore cursor position after content update, using the up-to-date element from refs
    requestAnimationFrame(() => {
      const blockWrapper = blockRefs.current.get(blockKey);
      const editableDiv = blockWrapper?.querySelector('[contenteditable="true"]') as HTMLElement;

      if (!editableDiv) {
        return;
      }

      // The text node is inside a span, which is the first child.
      const textNode = editableDiv.firstChild?.firstChild;

      if (textNode && window.getSelection) {
        const newSelection = window.getSelection();
        if (newSelection) {
          try {
            const newRange = document.createRange();
            const safeOffset = Math.min(offset, textNode.textContent?.length || 0);
            newRange.setStart(textNode, safeOffset);
            newRange.setEnd(textNode, safeOffset);
            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
          } catch (e) {
            // Fallback to focus
            editableDiv.focus();
          }
        }
      } else {
        // If no text node (e.g., empty block), just focus the div.
        editableDiv.focus();
      }
    });
  }, [blocksToRender, updateContent]);
  
  
  // Toggle text formatting (marks) - simple block-level approach
  const toggleMark = useCallback((mark: string) => {
    if (!selectedBlockKey) return;
    
    const blocks = blocksToRender.map(block => {
      if (block._key === selectedBlockKey && block.children) {
        const span = block.children[0];
        const marks = span.marks || [];
        const hasMark = marks.includes(mark);
        
        return {
          ...block,
          children: [{
            ...span,
            marks: hasMark 
              ? marks.filter(m => m !== mark)
              : [...marks, mark]
          }]
        };
      }
      return block;
    });
    
    updateContent(blocks);
  }, [selectedBlockKey, blocksToRender, updateContent]);
  
  // Change block style (heading, normal, etc.)
  const changeBlockStyle = useCallback((style: string) => {
    if (!selectedBlockKey) return;
    
    const blocks = blocksToRender.map(block => {
      if (block._key === selectedBlockKey) {
        return { ...block, style };
      }
      return block;
    });
    
    updateContent(blocks);
    setShowBlockMenu(false);
  }, [selectedBlockKey, blocksToRender, updateContent]);
  
  // Insert new block
  const insertBlock = useCallback((afterKey: string, style: string = 'normal') => {
    const newBlock: PortableTextBlock = {
      _key: generateKey(),
      _type: 'block',
      style,
      children: [{
        _key: generateKey(),
        _type: 'span',
        text: '',
        marks: []
      }]
    };
    
    const index = blocksToRender.findIndex(b => b._key === afterKey);
    const blocks = [...blocksToRender];
    
    // If index is -1 (not found), add to end
    if (index === -1) {
      blocks.push(newBlock);
    } else {
      blocks.splice(index + 1, 0, newBlock);
    }
    
    logger.debug('Inserting new block', { 
      fieldId, 
      afterKey, 
      newBlockKey: newBlock._key, 
      totalBlocks: blocks.length 
    });
    
    updateContent(blocks);
    
    // Focus new block after render
    setTimeout(() => {
      const newBlockEl = blockRefs.current.get(newBlock._key);
      
      if (newBlockEl) {
        const editableEl = newBlockEl.querySelector('[contenteditable]') as HTMLElement;
        
        if (editableEl) {
          editableEl.focus();
          setSelectedBlockKey(newBlock._key);
        }
      }
    }, 100);
    
    return newBlock._key;
  }, [blocksToRender, updateContent, fieldId]);
  
  
  // Delete block
  const deleteBlock = useCallback((blockKey: string) => {
    if (blocksToRender.length <= 1) return; // Keep at least one block
    
    // Get block content for confirmation message
    const block = blocksToRender.find(b => b._key === blockKey);
    const blockText = block?.children?.[0]?.text || '';
    const previewText = blockText.length > 50 ? blockText.substring(0, 50) + '...' : blockText;
    
    // Show confirmation dialog
    const message = previewText 
      ? `Are you sure you want to delete this block?\n\n"${previewText}"`
      : 'Are you sure you want to delete this empty block?';
    
    if (confirm(message)) {
      const blocks = blocksToRender.filter(b => b._key !== blockKey);
      updateContent(blocks);
      
      logger.info('Block deleted', { fieldId, blockKey });
    }
  }, [blocksToRender, updateContent, fieldId]);
  
  // Move block to new position
  const moveBlock = useCallback((blockKey: string, direction: 'up' | 'down') => {
    const currentIndex = blocksToRender.findIndex(b => b._key === blockKey);
    if (currentIndex === -1) return;
    
    let newIndex: number;
    if (direction === 'up') {
      if (currentIndex === 0) return; // Already at top
      newIndex = currentIndex - 1;
    } else {
      if (currentIndex === blocksToRender.length - 1) return; // Already at bottom
      newIndex = currentIndex + 1;
    }
    
    const blocks = [...blocksToRender];
    const [movedBlock] = blocks.splice(currentIndex, 1);
    blocks.splice(newIndex, 0, movedBlock);
    
    logger.debug('Moving block', { 
      fieldId, 
      blockKey, 
      direction, 
      from: currentIndex, 
      to: newIndex 
    });
    
    updateContent(blocks);
    
    // Keep focus on moved block
    setTimeout(() => {
      const blockEl = blockRefs.current.get(blockKey);
      const editableEl = blockEl?.querySelector('[contenteditable]') as HTMLElement;
      editableEl?.focus();
    }, 50);
  }, [blocksToRender, updateContent, fieldId]);
  
  // Move block to specific position (for drag and drop)
  const moveBlockToPosition = useCallback((blockKey: string, targetIndex: number) => {
    const currentIndex = blocksToRender.findIndex(b => b._key === blockKey);
    if (currentIndex === -1 || currentIndex === targetIndex) return;
    
    const blocks = [...blocksToRender];
    const [movedBlock] = blocks.splice(currentIndex, 1);
    
    // Adjust target index if moving down
    const adjustedIndex = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    blocks.splice(adjustedIndex, 0, movedBlock);
    
    logger.debug('Moving block to position', { 
      fieldId, 
      blockKey, 
      from: currentIndex, 
      to: adjustedIndex 
    });
    
    updateContent(blocks);
  }, [blocksToRender, updateContent, fieldId]);
  
  // Merge blocks (for backspace at start of block)
  const mergeWithPreviousBlock = useCallback((blockKey: string) => {
    const index = blocksToRender.findIndex(b => b._key === blockKey);
    if (index <= 0) return;
    
    const currentBlock = blocksToRender[index];
    const previousBlock = blocksToRender[index - 1];
    
    const mergedBlock: PortableTextBlock = {
      ...previousBlock,
      children: [{
        ...previousBlock.children![0],
        text: previousBlock.children![0].text + currentBlock.children![0].text
      }]
    };
    
    const blocks = [...blocksToRender];
    blocks[index - 1] = mergedBlock;
    blocks.splice(index, 1);
    
    updateContent(blocks);
  }, [blocksToRender, updateContent]);
  
  // Sanitize pasted content
  const sanitizePastedContent = useCallback((html: string): string => {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove all scripts, styles, and dangerous elements
    const dangerousElements = tempDiv.querySelectorAll('script, style, iframe, object, embed, form, input, button, link, meta');
    dangerousElements.forEach(el => el.remove());
    
    // Remove all event handlers and dangerous attributes
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      // Remove all event attributes (onclick, onmouseover, etc.)
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || 
            ['javascript:', 'data:', 'vbscript:'].some(prefix => attr.value.toLowerCase().includes(prefix))) {
          el.removeAttribute(attr.name);
        }
      });
      
      // Remove dangerous attributes
      ['src', 'href', 'action', 'formaction', 'background', 'cite', 'codebase', 'data'].forEach(attr => {
        if (el.hasAttribute(attr)) {
          const value = el.getAttribute(attr);
          if (value && (value.toLowerCase().startsWith('javascript:') || 
                       value.toLowerCase().startsWith('data:') ||
                       value.toLowerCase().startsWith('vbscript:'))) {
            el.removeAttribute(attr);
          }
        }
      });
    });
    
    // Extract only plain text to be safe
    return tempDiv.textContent || tempDiv.innerText || '';
  }, []);
  
  // Handle paste events
  const handlePaste = useCallback((e: React.ClipboardEvent, blockKey: string) => {
    e.preventDefault();
    
    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');
    
    // Get paste security settings (default to strict mode for safety)
    const pasteSecurity = options.pasteSecurity || { mode: 'strict' };
    const mode = pasteSecurity.mode || 'strict';
    const maxLength = pasteSecurity.maxPasteLength || 10000;
    const warnOnUnsafe = pasteSecurity.warnOnUnsafeContent !== false;
    
    // Check for dangerous content and warn user
    if (warnOnUnsafe && htmlData && (
      htmlData.includes('<script') || 
      htmlData.includes('javascript:') ||
      htmlData.includes('on"') || 
      htmlData.includes('<iframe') ||
      htmlData.includes('<object') ||
      htmlData.includes('<embed')
    )) {
      logger.error('Dangerous content detected in paste', { 
        containsScript: htmlData.includes('<script'),
        containsJavascript: htmlData.includes('javascript:'),
        containsEventHandlers: htmlData.includes('on"'),
        containsIframe: htmlData.includes('<iframe')
      });
    }
    
    let sanitizedText: string;
    
    // Handle different security modes
    switch (mode) {
      case 'strict':
        // Always use plain text only - safest option
        sanitizedText = textData;
        break;
        
      case 'safe':
        // Use sanitized HTML content, fallback to plain text
        sanitizedText = htmlData ? sanitizePastedContent(htmlData) : textData;
        break;
        
      case 'permissive':
        // Minimal sanitization - only remove obvious threats
        if (htmlData) {
          sanitizedText = sanitizePastedContent(htmlData);
        } else {
          sanitizedText = textData;
        }
        break;
        
      default:
        sanitizedText = textData; // Default to strict
    }
    
    if (!sanitizedText) return;
    
    // Apply length limit
    if (sanitizedText.length > maxLength) {
      sanitizedText = sanitizedText.substring(0, maxLength);
      logger.warn('Paste content truncated due to length limit', { maxLength });
    }
    
    // Split pasted content into lines and create blocks
    const lines = sanitizedText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return;
    
    // Update current block with first line
    const blocks = blocksToRender.map(block => {
      if (block._key === blockKey) {
        return {
          ...block,
          children: [{
            ...block.children![0],
            text: lines[0]
          }]
        };
      }
      return block;
    });
    
    // Create additional blocks for remaining lines
    if (lines.length > 1) {
      const currentIndex = blocks.findIndex(b => b._key === blockKey);
      for (let i = 1; i < lines.length; i++) {
        const newBlock: PortableTextBlock = {
          _key: generateKey(),
          _type: 'block',
          style: 'normal',
          children: [{
            _key: generateKey(),
            _type: 'span',
            text: lines[i],
            marks: []
          }]
        };
        blocks.splice(currentIndex + i, 0, newBlock);
      }
    }
    
    updateContent(blocks);
  }, [blocksToRender, updateContent, sanitizePastedContent, options.pasteSecurity]);
  
  // Handle keyboard events in block
  const handleBlockKeyDown = useCallback((e: KeyboardEvent<HTMLElement>, blockKey: string) => {
    const target = e.target as HTMLElement;
    const text = target.textContent || '';
    
    // Enter key - create new block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertBlock(blockKey);
    }
    
    // Backspace at start - merge with previous or delete
    if (e.key === 'Backspace' && text === '') {
      e.preventDefault();
      if (blocksToRender.length > 1) {
        mergeWithPreviousBlock(blockKey);
      }
    }
    
    // Block movement shortcuts (Alt + Up/Down)
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveBlock(blockKey, 'up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveBlock(blockKey, 'down');
          break;
      }
    }
    
    // Format shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          toggleMark('strong');
          break;
        case 'i':
          e.preventDefault();
          toggleMark('em');
          break;
        case 'u':
          e.preventDefault();
          toggleMark('underline');
          break;
      }
    }
  }, [blocksToRender, insertBlock, mergeWithPreviousBlock, toggleMark, moveBlock]);
  
  // Handle link creation
  const handleCreateLink = useCallback(() => {
    if (!linkUrl) return;
    
    if (!selectedBlockKey) {
      // If no selection, create a new link span
      const newBlock: PortableTextBlock = {
        _key: generateKey(),
        _type: 'block',
        style: 'normal',
        children: [{
          _key: generateKey(),
          _type: 'span',
          text: linkText || linkUrl,
          marks: ['link']
        }],
        markDefs: [{
          _key: 'link',
          _type: 'link',
          href: linkUrl
        }]
      };
      
      const blocks = [...blocksToRender, newBlock];
      updateContent(blocks);
    } else {
      // Add link to selected block
      const blocks = blocksToRender.map(block => {
        if (block._key === selectedBlockKey) {
          return {
            ...block,
            markDefs: [
              ...(block.markDefs || []),
              {
                _key: 'link',
                _type: 'link',
                href: linkUrl
              }
            ],
            children: block.children?.map(child => ({
              ...child,
              marks: [...(child.marks || []), 'link']
            })) || []
          };
        }
        return block;
      });
      updateContent(blocks);
    }
    
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
  }, [linkUrl, linkText, selectedBlockKey, blocksToRender, updateContent]);
  
  // Check if a mark is active for current block
  const isMarkActive = useCallback((mark: string): boolean => {
    if (!selectedBlockKey) return false;
    
    const block = blocksToRender.find(b => b._key === selectedBlockKey);
    if (!block || !block.children?.[0]) return false;
    
    return block.children[0].marks?.includes(mark) || false;
  }, [selectedBlockKey, blocksToRender]);
  
  // Get current block style
  const getCurrentBlockStyle = useCallback((): string => {
    if (!selectedBlockKey) return 'normal';
    
    const block = blocksToRender.find(b => b._key === selectedBlockKey);
    return block?.style || 'normal';
  }, [selectedBlockKey, blocksToRender]);
  
  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, blockKey: string) => {
    logger.debug('Drag start', { fieldId, blockKey });
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockKey);
    
    setDragState({
      isDragging: true,
      draggedBlockKey: blockKey,
      dragOverBlockKey: null,
      dragPosition: null
    });
  }, [fieldId]);
  
  const handleDragOver = useCallback((e: React.DragEvent, targetBlockKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!dragState.isDragging || dragState.draggedBlockKey === targetBlockKey) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';
    
    setDragState(prev => ({
      ...prev,
      dragOverBlockKey: targetBlockKey,
      dragPosition: position
    }));
  }, [dragState.isDragging, dragState.draggedBlockKey]);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear drag over state if leaving the block entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isLeavingBlock = (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    );
    
    if (isLeavingBlock) {
      setDragState(prev => ({
        ...prev,
        dragOverBlockKey: null,
        dragPosition: null
      }));
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, targetBlockKey: string) => {
    e.preventDefault();
    
    const draggedBlockKey = e.dataTransfer.getData('text/plain');
    if (!draggedBlockKey || draggedBlockKey === targetBlockKey) {
      setDragState({
        isDragging: false,
        draggedBlockKey: null,
        dragOverBlockKey: null,
        dragPosition: null
      });
      return;
    }
    
    const targetIndex = blocksToRender.findIndex(b => b._key === targetBlockKey);
    const dropIndex = dragState.dragPosition === 'before' ? targetIndex : targetIndex + 1;
    
    logger.debug('Drop block', { 
      fieldId, 
      draggedBlockKey, 
      targetBlockKey, 
      position: dragState.dragPosition,
      dropIndex 
    });
    
    moveBlockToPosition(draggedBlockKey, dropIndex);
    
    setDragState({
      isDragging: false,
      draggedBlockKey: null,
      dragOverBlockKey: null,
      dragPosition: null
    });
  }, [dragState.dragPosition, blocksToRender, moveBlockToPosition, fieldId]);
  
  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedBlockKey: null,
      dragOverBlockKey: null,
      dragPosition: null
    });
  }, []);
  
  // Toolbar button component
  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    title, 
    children 
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isDisabled || isReadonly}
      title={title}
      className={`
        px-2 py-1.5 rounded text-sm font-medium transition-all duration-150
        ${isActive 
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
        }
        ${disabled || isDisabled || isReadonly 
          ? 'opacity-40 cursor-not-allowed' 
          : 'cursor-pointer active:scale-95'
        }
      `}
    >
      {children}
    </button>
  );
  
  return (
    <div className={`portable-text-field ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col p-4' : 'overflow-visible'}`}>
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-lg shadow-sm">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Block type selector */}
              <div ref={blockMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowBlockMenu(!showBlockMenu)}
                  disabled={isDisabled || isReadonly}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <span>{getCurrentBlockStyle() === 'normal' ? 'Normal' : getCurrentBlockStyle().toUpperCase()}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showBlockMenu && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('normal')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('h1')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-lg"
                    >
                      Heading 1
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('h2')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-semibold"
                    >
                      Heading 2
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('h3')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                      Heading 3
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('blockquote')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors italic"
                    >
                      Quote
                    </button>
                  </div>
                )}
              </div>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
              
              {/* Text formatting */}
              <ToolbarButton
                onClick={() => toggleMark('strong')}
                isActive={isMarkActive('strong')}
                title="Bold (⌘B)"
              >
                <span className="font-bold">B</span>
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => toggleMark('em')}
                isActive={isMarkActive('em')}
                title="Italic (⌘I)"
              >
                <span className="italic">I</span>
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => toggleMark('underline')}
                isActive={isMarkActive('underline')}
                title="Underline (⌘U)"
              >
                <span className="underline">U</span>
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => toggleMark('strike')}
                isActive={isMarkActive('strike')}
                title="Strikethrough"
              >
                <span className="line-through">S</span>
              </ToolbarButton>
              
              <ToolbarButton
                onClick={() => toggleMark('code')}
                isActive={isMarkActive('code')}
                title="Code"
              >
                <span className="font-mono text-xs">{'<>'}</span>
              </ToolbarButton>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
              
              {/* Link */}
              <ToolbarButton
                onClick={() => setShowLinkDialog(true)}
                isActive={false}
                title="Add link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </ToolbarButton>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Stats toggle */}
              {(options.showBlockCount || options.showCharacterCount || options.showWordCount) && (
                <button
                  type="button"
                  onClick={() => setShowStats(!showStats)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {showStats ? 'Hide' : 'Show'} stats
                </button>
              )}
              
              {/* Fullscreen toggle */}
              {options.enableFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Stats bar */}
        {showStats && (
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            {options.showBlockCount && (
              <span>
                <span className="font-medium">Blocks:</span> {contentStats.blocks}
              </span>
            )}
            {options.showCharacterCount && (
              <span>
                <span className="font-medium">Characters:</span> {contentStats.characters}
              </span>
            )}
            {options.showWordCount && (
              <span>
                <span className="font-medium">Words:</span> {contentStats.words}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        className={`
          bg-white dark:bg-gray-900 border-x border-b border-gray-200 dark:border-gray-700 
          rounded-b-lg p-4 pr-16 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400
          ${isFullscreen ? 'flex-1 overflow-auto' : ''}
        `}
        style={{
          minHeight: isFullscreen ? 'auto' : '200px',
          maxHeight: isFullscreen ? 'none' : '500px',
          overflowY: isFullscreen ? 'auto' : 'auto'
        }}
        onClick={(e) => {
          // Click on empty area to focus last block
          if (e.target === editorRef.current && blocksToRender.length > 0) {
            const lastBlock = blocksToRender[blocksToRender.length - 1];
            const blockEl = blockRefs.current.get(lastBlock._key);
            const editableEl = blockEl?.querySelector('[contenteditable]') as HTMLElement;
            editableEl?.focus();
          }
        }}
      >
        {/* Render blocks */}
        {blocksToRender.map((block, index) => {
          const isSelected = selectedBlockKey === block._key;
          const text = block.children?.[0]?.text || '';
          const marks = block.children?.[0]?.marks || [];
          
          // Determine block element type
          let BlockElement: keyof JSX.IntrinsicElements = 'p';
          let blockClasses = '';
          
          switch (block.style) {
            case 'h1':
              BlockElement = 'h1';
              blockClasses = 'text-3xl font-bold mb-4 mt-6';
              break;
            case 'h2':
              BlockElement = 'h2';
              blockClasses = 'text-2xl font-semibold mb-3 mt-5';
              break;
            case 'h3':
              BlockElement = 'h3';
              blockClasses = 'text-xl font-semibold mb-2 mt-4';
              break;
            case 'h4':
              BlockElement = 'h4';
              blockClasses = 'text-lg font-medium mb-2 mt-3';
              break;
            case 'h5':
              BlockElement = 'h5';
              blockClasses = 'text-base font-medium mb-1 mt-2';
              break;
            case 'h6':
              BlockElement = 'h6';
              blockClasses = 'text-sm font-medium mb-1 mt-2';
              break;
            case 'blockquote':
              BlockElement = 'blockquote';
              blockClasses = 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4';
              break;
            default:
              blockClasses = 'mb-2';
          }
          
          // Apply marks to block-level formatting
          let markClasses = '';
          if (marks.includes('strong')) markClasses += ' font-semibold';
          if (marks.includes('em')) markClasses += ' italic';
          if (marks.includes('underline')) markClasses += ' underline';
          if (marks.includes('strike')) markClasses += ' line-through';
          if (marks.includes('code')) markClasses += ' font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm';
          
          return (
            <div key={block._key} className="relative">
              {/* Block controls - shown floating outside on right when selected */}
              {isSelected && !isDisabled && !isReadonly && (
                <div className="absolute left-full -ml-2 top-0 flex flex-col gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-1 z-20">
                  {/* Drag handle */}
                  <button
                    type="button"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, block._key)}
                    onDragEnd={handleDragEnd}
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing rounded transition-colors"
                    title="Drag to reorder (or use Alt+↑/↓)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </button>
                  
                  {/* Delete button */}
                  {blocksToRender.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBlock(block._key);
                      }}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete block"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              
              {/* Block content container */}
              <div
                ref={(el) => {
                  if (el) {
                    blockRefs.current.set(block._key, el);
                  } else {
                    blockRefs.current.delete(block._key);
                  }
                }}
                className={`
                  relative transition-all duration-150
                  ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400 rounded-md px-2' : ''}
                  ${!isReadonly && !isDisabled ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30 px-2 rounded-md' : ''}
                  ${dragState.isDragging && dragState.draggedBlockKey === block._key ? 'opacity-30 scale-95 bg-blue-50 dark:bg-blue-900/20' : ''}
                `}
                onClick={() => setSelectedBlockKey(block._key)}
                onDragOver={(e) => handleDragOver(e, block._key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, block._key)}
              >
                {/* Drop indicators */}
                {dragState.dragOverBlockKey === block._key && dragState.draggedBlockKey !== block._key && (
                  <>
                    {dragState.dragPosition === 'before' && (
                      <div className="absolute -top-3 left-0 right-0 flex items-center z-50 pointer-events-none">
                        <div className="w-full h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse" 
                             style={{ 
                               boxShadow: '0 0 20px rgba(59, 130, 246, 0.9), 0 0 40px rgba(59, 130, 246, 0.6)',
                               backgroundColor: 'rgb(59, 130, 246)'
                             }} />
                      </div>
                    )}
                    {dragState.dragPosition === 'after' && (
                      <div className="absolute -bottom-3 left-0 right-0 flex items-center z-50 pointer-events-none">
                        <div className="w-full h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse" 
                             style={{ 
                               boxShadow: '0 0 20px rgba(59, 130, 246, 0.9), 0 0 40px rgba(59, 130, 246, 0.6)',
                               backgroundColor: 'rgb(59, 130, 246)'
                             }} />
                      </div>
                    )}
                  </>
                )}
                
                <BlockElement
                className={`outline-none focus:outline-none text-gray-900 dark:text-gray-100 relative ${blockClasses}${markClasses}`}
                contentEditable={!isDisabled && !isReadonly}
                suppressContentEditableWarning
                onInput={(e) => {
                  const target = e.target as HTMLElement;
                  handleBlockInput(block._key, target);
                }}
                onKeyDown={(e) => handleBlockKeyDown(e, block._key)}
                onPaste={(e) => handlePaste(e, block._key)}
                onFocus={() => setSelectedBlockKey(block._key)}
                spellCheck={options.spellCheck !== false}
                data-placeholder={
                  !text ? (
                    block.style === 'h1' ? 'Heading 1' : 
                    block.style === 'h2' ? 'Heading 2' :
                    block.style === 'h3' ? 'Heading 3' :
                    block.style === 'blockquote' ? 'Quote...' :
                    options.placeholder || 'Type something...'
                  ) : undefined
                }
                style={{
                  minHeight: text ? 'auto' : '1.5em'
                }}
              >
                {text}
              </BlockElement>
              
              {/* Placeholder overlay */}
              {!text && (
                <div className="absolute inset-0 pointer-events-none text-gray-400 dark:text-gray-600 select-none">
                  <span className={blockClasses}>
                    {block.style === 'h1' ? 'Heading 1' : 
                     block.style === 'h2' ? 'Heading 2' :
                     block.style === 'h3' ? 'Heading 3' :
                     block.style === 'blockquote' ? 'Quote...' :
                     options.placeholder || 'Type something...'}
                  </span>
                </div>
              )}
              </div>
            </div>
          );
        })}
        
        {/* Add block button */}
        {!isDisabled && !isReadonly && (
          <div className="mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const lastBlock = blocksToRender[blocksToRender.length - 1];
                insertBlock(lastBlock._key);
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm font-medium"
            >
              + Add block
            </button>
          </div>
        )}
      </div>
      
      {/* Validation feedback */}
      {hasError && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          Please check the content requirements
        </div>
      )}
      
      {/* Character/block limits */}
      {(validation.maxBlocks || validation.maxLength) && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
          {validation.maxBlocks && (
            <span className={contentStats.blocks > validation.maxBlocks ? 'text-red-500 font-medium' : ''}>
              {contentStats.blocks}/{validation.maxBlocks} blocks
            </span>
          )}
          {validation.maxBlocks && validation.maxLength && ' • '}
          {validation.maxLength && (
            <span className={contentStats.characters > validation.maxLength ? 'text-red-500 font-medium' : ''}>
              {contentStats.characters}/{validation.maxLength} characters
            </span>
          )}
        </div>
      )}
      
      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Add Link
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="link-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL
                </label>
                <input
                  id="link-url"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
              
              <div>
                <label htmlFor="link-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Text (optional)
                </label>
                <input
                  id="link-text"
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Link text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLink}
                disabled={!linkUrl}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}