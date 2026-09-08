import React from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { PortableTextFieldDefinition } from './definition';

interface PortableTextToolbarProps {
  options: NonNullable<PortableTextFieldDefinition['options']>;
  contentStats: { blocks: number; characters: number; words: number };
  isDisabled?: boolean;
  isReadonly?: boolean;
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
  showStats: boolean;
  setShowStats: (value: boolean) => void;
  showBlockMenu: boolean;
  setShowBlockMenu: (value: boolean) => void;
  blockMenuRef: React.RefObject<HTMLDivElement | null>;
  getCurrentBlockStyle: () => string;
  changeBlockStyle: (style: string) => void;
  isMarkActive: (mark: string) => boolean;
  toggleMark: (mark: string) => void;
  setShowLinkDialog: (value: boolean) => void;
}

/**
 * The toolbar above the editor: the block style menu, the mark buttons, the
 * link button, and the stats and fullscreen switches.
 */
export function PortableTextToolbar({
  options,
  contentStats,
  isDisabled,
  isReadonly,
  isFullscreen,
  setIsFullscreen,
  showStats,
  setShowStats,
  showBlockMenu,
  setShowBlockMenu,
  blockMenuRef,
  getCurrentBlockStyle,
  changeBlockStyle,
  isMarkActive,
  toggleMark,
  setShowLinkDialog,
}: PortableTextToolbarProps) {
  const { t } = useT('fields');

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
                  <span>{getCurrentBlockStyle() === 'normal' ? t('types.portableText.normal') : getCurrentBlockStyle().toUpperCase()}</span>
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
                      {t('types.portableText.normal')}
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('h1')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold text-lg"
                    >
                      {t('types.portableText.heading1')}
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('h2')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-semibold"
                    >
                      {t('types.portableText.heading2')}
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('h3')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                      {t('types.portableText.heading3')}
                    </button>
                    <button
                      type="button"
                      onClick={() => changeBlockStyle('blockquote')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors italic"
                    >
                      {t('types.portableText.quote')}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
              
              {/* Text formatting */}
              <ToolbarButton
                onClick={() => toggleMark('strong')}
                isActive={isMarkActive('strong')}
                title={t('types.portableText.bold')}
              >
                <span className="font-bold">B</span>
              </ToolbarButton>

              <ToolbarButton
                onClick={() => toggleMark('em')}
                isActive={isMarkActive('em')}
                title={t('types.portableText.italic')}
              >
                <span className="italic">I</span>
              </ToolbarButton>

              <ToolbarButton
                onClick={() => toggleMark('underline')}
                isActive={isMarkActive('underline')}
                title={t('types.portableText.underline')}
              >
                <span className="underline">U</span>
              </ToolbarButton>

              <ToolbarButton
                onClick={() => toggleMark('strike')}
                isActive={isMarkActive('strike')}
                title={t('types.portableText.strikethrough')}
              >
                <span className="line-through">S</span>
              </ToolbarButton>

              <ToolbarButton
                onClick={() => toggleMark('code')}
                isActive={isMarkActive('code')}
                title={t('types.portableText.code')}
              >
                <span className="font-mono text-xs">{'<>'}</span>
              </ToolbarButton>

              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

              {/* Link */}
              <ToolbarButton
                onClick={() => setShowLinkDialog(true)}
                isActive={false}
                title={t('types.portableText.addLink')}
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
                  {showStats ? t('types.portableText.hideStats') : t('types.portableText.showStats')}
                </button>
              )}
              
              {/* Fullscreen toggle */}
              {options.enableFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={isFullscreen ? t('types.portableText.exitFullscreen') : t('types.portableText.fullscreen')}
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
  );
}
