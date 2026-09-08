import { useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import type React from 'react';
import { useT } from '@trokky/trokky/i18n';
import type {
  PortableTextContent,
  PortableTextBlock
} from './definition';
import {
  sanitizePortableTextValue,
  getPlainTextFromPortableText,
  getPortableTextStats,
  generateKey
} from './validation';
import { createStudioLogger } from '../../../utils/logger';

const logger = createStudioLogger('PortableTextField');

interface UsePortableTextBlocksOptions {
  normalizedContent: PortableTextContent;
  onChange?: (value: unknown) => void;
  fieldId?: string;
  isViewMode: boolean | undefined;
  selectedBlockKey: string | null;
  setSelectedBlockKey: (key: string | null) => void;
  setShowBlockMenu: (show: boolean) => void;
  blockRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

/**
 * The block list and every edit that reshapes it: typing, marks, style,
 * insert, delete, move, merge. The `_key` on a block and on its spans is
 * content, so every operation here carries the existing keys through and only
 * ever mints a new one for a block that did not exist.
 */
export function usePortableTextBlocks({
  normalizedContent,
  onChange,
  fieldId,
  isViewMode,
  selectedBlockKey,
  setSelectedBlockKey,
  setShowBlockMenu,
  blockRefs,
}: UsePortableTextBlocksOptions) {
  const { t } = useT('fields');

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
    if (isViewMode || !onChange) return;
    
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
  }, [onChange, fieldId, isViewMode]);
  
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
      ? t('types.portableText.deleteConfirmWithText', { text: previewText })
      : t('types.portableText.deleteEmptyConfirm');

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
  return {
    blocksToRender,
    updateContent,
    handleBlockInput,
    toggleMark,
    changeBlockStyle,
    insertBlock,
    deleteBlock,
    moveBlock,
    moveBlockToPosition,
    mergeWithPreviousBlock,
    handleBlockKeyDown,
    isMarkActive,
    getCurrentBlockStyle,
  };
}
