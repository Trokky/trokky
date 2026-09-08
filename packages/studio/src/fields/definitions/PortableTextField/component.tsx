import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin';
import type { PortableTextFieldDefinition } from './definition';
import {
  sanitizePortableTextValue,
  getPortableTextStats,
  normalizePortableTextContent,
  generateKey
} from './validation';
import type { PortableTextBlock } from './definition';
import { Dialog } from '@/components/ui/Dialog.js';
import { PortableTextRenderer } from './PortableTextRenderer';
import { PortableTextToolbar } from './PortableTextToolbar';
import { PortableTextBlockRow } from './PortableTextBlockRow';
import { usePortableTextBlocks } from './usePortableTextBlocks';
import { usePortableTextPaste } from './usePortableTextPaste';
import { usePortableTextDrag, useDragState } from './usePortableTextDrag';

type PortableTextFieldComponentProps = FieldComponentProps;

export function PortableTextFieldComponent(props: PortableTextFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly, mode } = props;
  const { t } = useT('fields');

  if (definition.type !== 'portable') {
    return <div className="text-red-500 text-sm">{t('errors.invalidFieldConfig', { type: 'portable' })}</div>;
  }
  
  const portableDefinition = definition as PortableTextFieldDefinition;
  const options = portableDefinition.options || {};
  const validation = portableDefinition.validation || {};
  
  // Check if we're in read-only mode
  const isViewMode = mode === 'preview' || isReadonly || isDisabled;
  
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
  const editorRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const blockMenuRef = useRef<HTMLDivElement>(null);
  
  // Declared here, before the read-only return below, because that is where it
  // lived before the split; moving it after would change the hook sequence.
  const [dragState, setDragState] = useDragState();

  const contentStats = useMemo(() => 
    getPortableTextStats(sanitizedValue),
    [sanitizedValue]
  );


  // Render read-only view
  if (isViewMode) {
    return (
      <div className="py-2">
        {normalizedContent.blocks && normalizedContent.blocks.length > 0 ? (
          <div className="space-y-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <PortableTextRenderer blocks={normalizedContent.blocks} />
            </div>

            
            {/* Stats display in read-only mode */}
            {(options.showBlockCount || options.showCharacterCount || options.showWordCount) && (
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                {options.showBlockCount && (
                  <span>
                    <span className="font-medium">{t('types.portableText.blocks')}</span> {contentStats.blocks}
                  </span>
                )}
                {options.showCharacterCount && (
                  <span>
                    <span className="font-medium">{t('types.portableText.characters')}</span> {contentStats.characters}
                  </span>
                )}
                {options.showWordCount && (
                  <span>
                    <span className="font-medium">{t('types.portableText.words')}</span> {contentStats.words}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-400 italic text-sm">{t('types.portableText.noContent')}</span>
        )}
      </div>
    );
  }
  
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
  

  const {
    blocksToRender,
    updateContent,
    handleBlockInput,
    toggleMark,
    changeBlockStyle,
    insertBlock,
    deleteBlock,
    moveBlockToPosition,
    handleBlockKeyDown,
    isMarkActive,
    getCurrentBlockStyle,
  } = usePortableTextBlocks({
    normalizedContent,
    onChange,
    fieldId,
    isViewMode,
    selectedBlockKey,
    setSelectedBlockKey,
    setShowBlockMenu,
    blockRefs,
  });

  const { handlePaste } = usePortableTextPaste({
    blocksToRender,
    updateContent,
    options,
  });

  const {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = usePortableTextDrag({
    blocksToRender,
    moveBlockToPosition,
    fieldId,
    dragState,
    setDragState,
  });

  
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
  

  return (
    <div className={`portable-text-field ${isFullscreen ? 'fixed inset-0 z-overlay bg-white dark:bg-gray-900 flex flex-col p-4' : 'overflow-visible'}`}>
      {/* Toolbar */}
      <PortableTextToolbar
        options={options}
        contentStats={contentStats}
        isDisabled={isDisabled}
        isReadonly={isReadonly}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        showStats={showStats}
        setShowStats={setShowStats}
        showBlockMenu={showBlockMenu}
        setShowBlockMenu={setShowBlockMenu}
        blockMenuRef={blockMenuRef}
        getCurrentBlockStyle={getCurrentBlockStyle}
        changeBlockStyle={changeBlockStyle}
        isMarkActive={isMarkActive}
        toggleMark={toggleMark}
        setShowLinkDialog={setShowLinkDialog}
      />

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
        {blocksToRender.map((block) => (
          <PortableTextBlockRow
            key={block._key}
            block={block}
            isSelected={selectedBlockKey === block._key}
            isDisabled={isDisabled}
            isReadonly={isReadonly}
            blockCount={blocksToRender.length}
            dragState={dragState}
            options={options}
            blockRefs={blockRefs}
            setSelectedBlockKey={setSelectedBlockKey}
            deleteBlock={deleteBlock}
            handleBlockInput={handleBlockInput}
            handleBlockKeyDown={handleBlockKeyDown}
            handlePaste={handlePaste}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleDragEnd={handleDragEnd}
          />
        ))}

        
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
              {t('types.portableText.addBlock')}
            </button>
          </div>
        )}
      </div>
      
      {/* Validation feedback */}
      {hasError && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t('types.portableText.checkRequirements')}
        </div>
      )}
      
      {/* Character/block limits */}
      {(validation.maxBlocks || validation.maxLength) && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
          {validation.maxBlocks && (
            <span className={contentStats.blocks > validation.maxBlocks ? 'text-red-500 font-medium' : ''}>
              {t('types.portableText.blocksCount', { current: contentStats.blocks, max: validation.maxBlocks })}
            </span>
          )}
          {validation.maxBlocks && validation.maxLength && ' • '}
          {validation.maxLength && (
            <span className={contentStats.characters > validation.maxLength ? 'text-red-500 font-medium' : ''}>
              {t('types.portableText.charactersCount', { current: contentStats.characters, max: validation.maxLength })}
            </span>
          )}
        </div>
      )}
      
      {/* Link Dialog */}
      {showLinkDialog && (
        <Dialog
          open={showLinkDialog}
          onClose={() => {
            setShowLinkDialog(false);
            setLinkUrl('');
            setLinkText('');
          }}
          variant="center"
          size="sm"
          title={t('types.portableText.linkDialog.title')}
        >
          <Dialog.Body>
            <div className="space-y-4">
              <div>
                <label htmlFor="link-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('types.portableText.linkDialog.url')}
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
                  {t('types.portableText.linkDialog.textOptional')}
                </label>
                <input
                  id="link-text"
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder={t('types.portableText.linkDialog.textPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

          </Dialog.Body>
          <Dialog.Footer>
            <button
              type="button"
              onClick={() => {
                setShowLinkDialog(false);
                setLinkUrl('');
                setLinkText('');
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
            >
              {t('types.portableText.linkDialog.cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreateLink}
              disabled={!linkUrl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              {t('types.portableText.linkDialog.add')}
            </button>
          </Dialog.Footer>
        </Dialog>
      )}
    </div>
  );
}