import type React from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { useT } from '@trokky/trokky/i18n'

/**
 * The editing surface itself, with the ProseMirror styles it needs: the
 * bordered inline box, and the full-height fullscreen one. Both switch between
 * the rendered editor and the HTML source textarea.
 *
 * The markup keeps the indentation it had inside the field component so the
 * template literals it contains - the class list and the injected CSS - carry
 * exactly the same text as before.
 */

interface EditorSurfaceProps {
  editor: Editor
  isSourceView: boolean
  sourceCode: string
  onSourceChange: (value: string) => void
  isDisabled?: boolean
  isReadonly?: boolean
}

interface InlineEditorSurfaceProps extends EditorSurfaceProps {
  isFullscreen?: boolean
  editorContainerRef: React.RefObject<HTMLDivElement | null>
}

export function InlineEditorSurface({
  editor,
  isSourceView,
  sourceCode,
  onSourceChange,
  isDisabled,
  isReadonly,
  isFullscreen,
  editorContainerRef,
}: InlineEditorSurfaceProps) {
  const { t } = useT('fields')

  return (
          <div
            className={`
          border border-t-0 border-gray-200 dark:border-gray-700
          ${isReadonly ? 'rounded-lg' : 'rounded-b-lg'}
          bg-white dark:bg-gray-900
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
          >
            <div
              className="tiptap-editor-container relative min-h-[300px]"
              ref={editorContainerRef}
            >
              <style
                dangerouslySetInnerHTML={{
                  __html: `
              /*
               * The Placeholder extension only sets data-placeholder and the
               * is-editor-empty class on the first node; rendering it is ours to do.
               */
              .tiptap-editor-container .ProseMirror .is-editor-empty:first-child::before {
                content: attr(data-placeholder);
                float: left;
                height: 0;
                pointer-events: none;
                color: #9ca3af;
              }
              .dark .tiptap-editor-container .ProseMirror .is-editor-empty:first-child::before {
                color: #6b7280;
              }
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

              /* Table Styles */
              .tiptap-editor-container .ProseMirror table {
                border-collapse: collapse !important;
                table-layout: fixed !important;
                width: 100% !important;
                margin: 1rem 0 !important;
                overflow: hidden !important;
                border: 2px solid #d1d5db !important;
                border-radius: 0.5rem !important;
              }
              .dark .tiptap-editor-container .ProseMirror table {
                border-color: #4b5563 !important;
              }
              .tiptap-editor-container .ProseMirror td, .tiptap-editor-container .ProseMirror th {
                min-width: 1em !important;
                border: 1px solid #d1d5db !important;
                padding: 0.75rem !important;
                vertical-align: top !important;
                box-sizing: border-box !important;
                position: relative !important;
                background: #ffffff !important;
              }
              .dark .tiptap-editor-container .ProseMirror td, .dark .tiptap-editor-container .ProseMirror th {
                border-color: #4b5563 !important;
                background: #1f2937 !important;
              }
              .tiptap-editor-container .ProseMirror th {
                font-weight: 600 !important;
                text-align: left !important;
                background-color: #f9fafb !important;
              }
              .dark .tiptap-editor-container .ProseMirror th {
                background-color: #374151 !important;
              }
              .tiptap-editor-container .ProseMirror .selectedCell:after {
                z-index: 2 !important;
                position: absolute !important;
                content: "" !important;
                left: 0 !important;
                right: 0 !important;
                top: 0 !important;
                bottom: 0 !important;
                background: rgba(59, 130, 246, 0.2) !important;
                pointer-events: none !important;
              }

              /* Table cell content styling */
              .tiptap-editor-container .ProseMirror td > *, .tiptap-editor-container .ProseMirror th > * {
                margin-bottom: 0 !important;
              }

              /* Code Block Styles */
              .tiptap-editor-container .ProseMirror pre {
                background: #1f2937 !important;
                color: #f9fafb !important;
                font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace !important;
                padding: 1rem !important;
                border-radius: 0.5rem !important;
                overflow-x: auto !important;
                margin: 1rem 0 !important;
                border: 1px solid #374151 !important;
                font-size: 0.875rem !important;
                line-height: 1.5 !important;
              }
              .dark .tiptap-editor-container .ProseMirror pre {
                background: #0f172a !important;
                border-color: #1e293b !important;
              }
              .tiptap-editor-container .ProseMirror pre code {
                color: inherit !important;
                padding: 0 !important;
                background: none !important;
                font-size: inherit !important;
                border-radius: 0 !important;
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
                min-height: 300px !important;
              }
              .tiptap-editor-container {
                min-height: 300px !important;
              }
              .tiptap-editor-container .ProseMirror:focus {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
              }
            `,
                }}
              />
              {!isFullscreen && (
                <>
                  {isSourceView ? (
                    <textarea
                      value={sourceCode}
                      onChange={e => onSourceChange(e.target.value)}
                      className="w-full h-full p-4 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-none resize-none focus:outline-none focus:ring-0"
                      placeholder={t('types.richtext.source.placeholder')}
                      disabled={isDisabled || isReadonly}
                      spellCheck={false}
                    />
                  ) : (
                    <EditorContent
                      key="editor-content"
                      editor={editor}
                      className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[300px] text-gray-900 dark:text-gray-100 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:border-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror]:min-h-[270px] [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100"
                    />
                  )}
                </>
              )}
            </div>
          </div>
  )
}

export function FullscreenEditorSurface({
  editor,
  isSourceView,
  sourceCode,
  onSourceChange,
  isDisabled,
  isReadonly,
}: EditorSurfaceProps) {
  const { t } = useT('fields')

  return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 tiptap-editor-container relative">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                  /*
                   * The Placeholder extension only sets data-placeholder and the
                   * is-editor-empty class on the first node; rendering it is ours to do.
                   */
                  .tiptap-editor-container .ProseMirror .is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                    color: #9ca3af;
                  }
                  .dark .tiptap-editor-container .ProseMirror .is-editor-empty:first-child::before {
                    color: #6b7280;
                  }
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
                    min-height: 100vh !important;
                  }
                  .tiptap-editor-container {
                    min-height: 100vh !important;
                  }
                  .tiptap-editor-container .ProseMirror:focus {
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
                  }
                `,
                }}
              />
              {isSourceView ? (
                <textarea
                  value={sourceCode}
                  onChange={e => onSourceChange(e.target.value)}
                  className="absolute inset-0 w-full h-full p-8 font-mono text-sm bg-gray-900 text-gray-100 border-none resize-none focus:outline-none focus:ring-0 overflow-y-auto"
                  placeholder={t('types.richtext.source.placeholder')}
                  disabled={isDisabled || isReadonly}
                  spellCheck={false}
                />
              ) : (
                <EditorContent
                  key="editor-content"
                  editor={editor}
                  className="prose prose-sm dark:prose-invert max-w-none p-8 absolute inset-0 overflow-y-auto text-gray-900 dark:text-gray-100 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:border-none [&_.ProseMirror]:focus:ring-0 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100"
                />
              )}
            </div>
          </div>
  )
}
