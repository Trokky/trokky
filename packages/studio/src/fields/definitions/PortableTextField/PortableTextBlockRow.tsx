import React from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { PortableTextBlock, PortableTextFieldDefinition } from './definition';
import { getBlockPresentation, getMarkClasses } from './blockStyles';
import type { DragState } from './usePortableTextDrag';

interface PortableTextBlockRowProps {
  block: PortableTextBlock;
  isSelected: boolean;
  isDisabled?: boolean;
  isReadonly?: boolean;
  blockCount: number;
  dragState: DragState;
  options: NonNullable<PortableTextFieldDefinition['options']>;
  blockRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  setSelectedBlockKey: (key: string | null) => void;
  deleteBlock: (blockKey: string) => void;
  handleBlockInput: (blockKey: string, element: HTMLElement) => void;
  handleBlockKeyDown: (e: React.KeyboardEvent<HTMLElement>, blockKey: string) => void;
  handlePaste: (e: React.ClipboardEvent, blockKey: string) => void;
  handleDragStart: (e: React.DragEvent, blockKey: string) => void;
  handleDragOver: (e: React.DragEvent, targetBlockKey: string) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetBlockKey: string) => void;
  handleDragEnd: () => void;
}

/**
 * One editable block: its controls, its drop indicators, and the
 * contenteditable element itself. The block keeps its `_key`; nothing here
 * mints or drops one.
 */
export function PortableTextBlockRow({
  block,
  isSelected,
  isDisabled,
  isReadonly,
  blockCount,
  dragState,
  options,
  blockRefs,
  setSelectedBlockKey,
  deleteBlock,
  handleBlockInput,
  handleBlockKeyDown,
  handlePaste,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
}: PortableTextBlockRowProps) {
  const { t } = useT('fields');

  const text = block.children?.[0]?.text || '';
  const marks = block.children?.[0]?.marks || [];

  // Determine block element type
  const { BlockElement, blockClasses } = getBlockPresentation(block.style);

  // Apply marks to block-level formatting
  const markClasses = getMarkClasses(marks);

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
                    title={t('types.portableText.dragToReorder')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </button>
                  
                  {/* Delete button */}
                  {blockCount > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBlock(block._key);
                      }}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title={t('types.portableText.deleteBlock')}
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
                onInput={(e: React.FormEvent<HTMLElement>) => {
                  const target = e.target as HTMLElement;
                  handleBlockInput(block._key, target);
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => handleBlockKeyDown(e, block._key)}
                onPaste={(e: React.ClipboardEvent<HTMLElement>) => handlePaste(e, block._key)}
                onFocus={() => setSelectedBlockKey(block._key)}
                spellCheck={options.spellCheck !== false}
                data-placeholder={
                  !text ? (
                    block.style === 'h1' ? t('types.portableText.heading1') :
                    block.style === 'h2' ? t('types.portableText.heading2') :
                    block.style === 'h3' ? t('types.portableText.heading3') :
                    block.style === 'blockquote' ? t('types.portableText.quotePlaceholder') :
                    options.placeholder || t('types.portableText.placeholder')
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
                    {block.style === 'h1' ? t('types.portableText.heading1') :
                     block.style === 'h2' ? t('types.portableText.heading2') :
                     block.style === 'h3' ? t('types.portableText.heading3') :
                     block.style === 'blockquote' ? t('types.portableText.quotePlaceholder') :
                     options.placeholder || t('types.portableText.placeholder')}
                  </span>
                </div>
              )}
              </div>
            </div>
  );
}
