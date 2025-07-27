import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { 
  PortableTextFieldDefinition,
  PortableTextContent,
  PortableTextOperations,
  PortableTextBlock,
  PortableTextSpan
} from './definition.js';
import { 
  validatePortableTextField,
  sanitizePortableTextValue,
  getDefaultPortableTextValue,
  getPlainTextFromPortableText,
  getPortableTextStats,
  normalizePortableTextContent,
  generateKey
} from './validation.js';
import { BLOCK_STYLES, MARKS } from './definition.js';

type PortableTextFieldComponentProps = FieldComponentProps;

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
  const editorRef = useRef<HTMLDivElement>(null);
  
  const contentStats = useMemo(() => 
    getPortableTextStats(sanitizedValue),
    [sanitizedValue]
  );
  
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
  
  // Portable text operations
  const operations: PortableTextOperations = useMemo(() => ({
    insertBlock: (blockType: string, style?: string, position?: number) => {
      const newBlock: PortableTextBlock = {
        _key: generateKey(),
        _type: blockType as any,
        style: style || 'normal',
        children: [{
          _key: generateKey(),
          _type: 'span' as const,
          text: '',
          marks: []
        }]
      };
      
      // If we're working with an empty default block, replace it
      const currentBlocks = normalizedContent.blocks || [];
      const blocks = [...currentBlocks];
      const insertAt = position !== undefined ? position : blocks.length;
      blocks.splice(insertAt, 0, newBlock);
      
      updateContent({ ...normalizedContent, blocks });
    },
    
    removeBlock: (blockKey: string) => {
      const currentBlocks = normalizedContent.blocks || [];
      const blocks = currentBlocks.filter(block => block._key !== blockKey);
      
      // If we removed all blocks, the component will show a default block for rendering
      // but we'll store empty blocks array
      updateContent({ ...normalizedContent, blocks });
    },
    
    updateBlock: (blockKey: string, updates: Partial<PortableTextBlock>) => {
      const currentBlocks = normalizedContent.blocks || [];
      const blocks = currentBlocks.map(block => 
        block._key === blockKey ? { ...block, ...updates } : block
      );
      updateContent({ ...normalizedContent, blocks });
    },
    
    moveBlock: (blockKey: string, newPosition: number) => {
      const currentBlocks = normalizedContent.blocks || [];
      const blocks = [...currentBlocks];
      const currentIndex = blocks.findIndex(block => block._key === blockKey);
      
      if (currentIndex === -1) return;
      
      const [movedBlock] = blocks.splice(currentIndex, 1);
      blocks.splice(newPosition, 0, movedBlock);
      
      updateContent({ ...normalizedContent, blocks });
    },
    
    insertText: (blockKey: string, text: string, position: number) => {
      // Simplified implementation - would need more sophisticated cursor handling
      const blocks = (normalizedContent.blocks || []).map(block => {
        if (block._key === blockKey && block.children && block.children[0]) {
          const span = block.children[0];
          const newText = span.text.slice(0, position) + text + span.text.slice(position);
          return {
            ...block,
            children: [{
              ...span,
              text: newText
            }]
          };
        }
        return block;
      });
      updateContent({ ...normalizedContent, blocks });
    },
    
    deleteText: (blockKey: string, start: number, end: number) => {
      const blocks = (normalizedContent.blocks || []).map(block => {
        if (block._key === blockKey && block.children && block.children[0]) {
          const span = block.children[0];
          const newText = span.text.slice(0, start) + span.text.slice(end);
          return {
            ...block,
            children: [{
              ...span,
              text: newText
            }]
          };
        }
        return block;
      });
      updateContent({ ...normalizedContent, blocks });
    },
    
    toggleMark: (blockKey: string, spanKey: string, mark: string) => {
      const blocks = (normalizedContent.blocks || []).map(block => {
        if (block._key === blockKey && block.children) {
          const children = block.children.map(child => {
            if (child._key === spanKey) {
              const marks = child.marks || [];
              const hasmark = marks.includes(mark);
              return {
                ...child,
                marks: hasmark 
                  ? marks.filter(m => m !== mark)
                  : [...marks, mark]
              };
            }
            return child;
          });
          return { ...block, children };
        }
        return block;
      });
      updateContent({ ...normalizedContent, blocks });
    },
    
    addMark: (blockKey: string, spanKey: string, mark: string) => {
      operations.toggleMark(blockKey, spanKey, mark);
    },
    
    removeMark: (blockKey: string, spanKey: string, mark: string) => {
      const blocks = (normalizedContent.blocks || []).map(block => {
        if (block._key === blockKey && block.children) {
          const children = block.children.map(child => {
            if (child._key === spanKey) {
              return {
                ...child,
                marks: (child.marks || []).filter(m => m !== mark)
              };
            }
            return child;
          });
          return { ...block, children };
        }
        return block;
      });
      updateContent({ ...normalizedContent, blocks });
    },
    
    convertBlockType: (blockKey: string, newType: string, newStyle?: string) => {
      operations.updateBlock(blockKey, { _type: newType, style: newStyle });
    },
    
    getPlainText: () => {
      return getPlainTextFromPortableText(normalizedContent);
    },
    
    getStats: () => contentStats,
    
    focus: () => {
      editorRef.current?.focus();
    },
    
    clear: () => {
      const emptyBlock: PortableTextBlock = {
        _key: generateKey(),
        _type: 'block' as const,
        style: 'normal',
        children: [{
          _key: generateKey(),
          _type: 'span' as const,
          text: '',
          marks: []
        }]
      };
      
      updateContent({
        blocks: [emptyBlock],
        metadata: {
          blockCount: 1,
          characterCount: 0,
          wordCount: 0,
          lastModified: new Date().toISOString(),
          version: '1.0'
        }
      });
    },
    
    undo: () => {
      // Would implement undo/redo with history stack
      console.log('Undo not implemented yet');
    },
    
    redo: () => {
      // Would implement undo/redo with history stack
      console.log('Redo not implemented yet');
    }
  }), [normalizedContent, contentStats]);
  
  const updateContent = useCallback((newContent: PortableTextContent) => {
    const updatedContent = {
      ...newContent,
      metadata: {
        ...newContent.metadata,
        blockCount: newContent.blocks.length,
        characterCount: getPlainTextFromPortableText(newContent).length,
        wordCount: getPortableTextStats(newContent).words,
        lastModified: new Date().toISOString()
      }
    };
    
    onChange(sanitizePortableTextValue(updatedContent));
  }, [onChange]);
  
  // Render a single block
  const renderBlock = (block: PortableTextBlock, index: number) => {
    const isSelected = selectedBlockKey === block._key;
    const text = block.children?.[0]?.text || '';
    const marks = block.children?.[0]?.marks || [];
    
    const blockElement = () => {
      switch (block.style) {
        case 'h1':
          return 'h1';
        case 'h2':
          return 'h2';
        case 'h3':
          return 'h3';
        case 'h4':
          return 'h4';
        case 'h5':
          return 'h5';
        case 'h6':
          return 'h6';
        case 'blockquote':
          return 'blockquote';
        default:
          return 'p';
      }
    };
    
    const blockClass = `
      outline-none border-l-2 transition-colors cursor-text
      ${isSelected 
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
      }
      ${block.style === 'blockquote' ? 'italic pl-4 border-l-4 border-gray-300 dark:border-gray-600' : 'pl-2'}
      ${hasError ? 'border-red-400' : ''}
    `;
    
    const textClass = `
      ${marks.includes('strong') ? 'font-bold' : ''}
      ${marks.includes('em') ? 'italic' : ''}
      ${marks.includes('underline') ? 'underline' : ''}
      ${marks.includes('code') ? 'font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded' : ''}
      ${marks.includes('strike') ? 'line-through' : ''}
    `;
    
    const Element = blockElement() as keyof JSX.IntrinsicElements;
    
    return (
      <div
        key={block._key}
        className={`group relative ${isSelected ? 'ring-1 ring-blue-500 rounded' : ''}`}
        onClick={() => setSelectedBlockKey(block._key)}
      >
        {/* Block controls */}
        {isSelected && !isDisabled && !isReadonly && (
          <div className="absolute -left-8 top-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => operations.removeBlock(block._key)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded text-xs"
              title="Delete block"
            >
              ×
            </button>
          </div>
        )}
        
        <Element
          className={blockClass}
          contentEditable={!isDisabled && !isReadonly}
          suppressContentEditableWarning
          onInput={(e) => {
            const newText = (e.target as HTMLElement).textContent || '';
            if (block.children && block.children[0]) {
              operations.updateBlock(block._key, {
                children: [{
                  ...block.children[0],
                  text: newText
                }]
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              operations.insertBlock('block', 'normal', index + 1);
            }
            if (e.key === 'Backspace' && text === '' && blocksToRender.length > 1) {
              e.preventDefault();
              operations.removeBlock(block._key);
            }
          }}
        >
          <span className={textClass}>
            {text || (
              <span className="text-gray-400 italic">
                {options.placeholder || 'Type something...'}
              </span>
            )}
          </span>
        </Element>
      </div>
    );
  };
  
  return (
    <div className={`portable-text-field ${hasError ? 'border-l-4 border-red-400 pl-4' : ''} ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4' : ''}`}>
      {/* Toolbar */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-t-md bg-gray-50 dark:bg-gray-800 p-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Portable Text</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
              Structured
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Stats toggle */}
            {(options.showBlockCount || options.showCharacterCount || options.showWordCount) && (
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
            {options.showBlockCount && (
              <span>Blocks: {contentStats.blocks}</span>
            )}
            {options.showCharacterCount && (
              <span>Characters: {contentStats.characters}</span>
            )}
            {options.showWordCount && (
              <span>Words: {contentStats.words}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        className="border border-gray-200 dark:border-gray-700 rounded-b-md p-4 space-y-2 min-h-[200px] focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400"
        style={{
          minHeight: isFullscreen ? '300px' : '200px',
          maxHeight: isFullscreen ? 'none' : '500px',
          overflowY: 'auto'
        }}
      >
        {blocksToRender.map((block, index) => renderBlock(block, index))}
        
        {/* Add block button */}
        {!isDisabled && !isReadonly && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => operations.insertBlock('block', 'normal')}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 rounded-md px-3 py-2 w-full transition-colors"
            >
              + Add block
            </button>
          </div>
        )}
      </div>
      
      {/* Block/character limits */}
      {(validation.maxBlocks || validation.maxLength) && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
          {validation.maxBlocks && (
            <span className={contentStats.blocks > validation.maxBlocks ? 'text-red-500' : ''}>
              {contentStats.blocks}/{validation.maxBlocks} blocks
            </span>
          )}
          {validation.maxBlocks && validation.maxLength && ' • '}
          {validation.maxLength && (
            <span className={contentStats.characters > validation.maxLength ? 'text-red-500' : ''}>
              {contentStats.characters}/{validation.maxLength} characters
            </span>
          )}
        </div>
      )}
    </div>
  );
}