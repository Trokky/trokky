import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { Dialog } from '@/components/ui/Dialog.js'
import { bodyScrollLock, isEscapeOwnedByDialog } from '@/components/ui/dialogInternals.js'
import {
  ArrowsPointingOutIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { FieldComponentProps } from '../../base/FieldPlugin'
import type { RichTextFieldDefinition } from './definition'
import { createStudioLogger } from '../../../utils/logger'
import { useT } from '@trokky/trokky/i18n'
import { sanitizePastedContent, SECURITY_PRESETS } from './sanitizer'
import {
  editorToStorageFormat,
  storageToEditorFormat,
} from './format-converter'
import type { RichTextOutputFormat, ProseMirrorDocument } from './definition'
import { ToolbarButton } from './ToolbarButton'
import { SourceCodeIcon } from './icons'
import { createRichTextExtensions } from './extensions'
import { createPasteHandler } from './pasteHandler'
import { RichTextFormatButtons } from './RichTextFormatButtons'
import { ImageToolbar } from './ImageToolbar'
import { TableToolbar } from './TableToolbar'
import { SanitizationWarning } from './SanitizationWarning'
import { InlineEditorSurface, FullscreenEditorSurface } from './EditorSurface'
import { useRichTextImages } from './useRichTextImages'

const logger = createStudioLogger('RichTextField')

type RichTextFieldComponentProps = FieldComponentProps

export function RichTextFieldComponent(props: RichTextFieldComponentProps) {
  const {
    definition,
    value,
    onChange,
    hasError,
    fieldId,
    isDisabled,
    isReadonly,
    studioContext,
    mode,
  } = props

  const { t } = useT('fields')

  if (definition.type !== 'richtext') {
    return (
      <div className="text-red-500 text-sm">
        {t('types.richtext.invalidConfig')}
      </div>
    )
  }

  const richtextDefinition = definition as RichTextFieldDefinition
  const options = richtextDefinition.options || {}
  const validation = richtextDefinition.validation || {}

  // Check if we're in read-only mode
  const isViewMode = mode === 'preview' || isReadonly || isDisabled

  // Character limit from validation
  const characterLimit = validation.maxLength

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Image browser state

  // Image toolbar state
  const [selectedImageNode, setSelectedImageNode] = useState<any>(null)
  const [showImageToolbar, setShowImageToolbar] = useState(false)
  const [availableVariants, setAvailableVariants] = useState<
    Record<string, any>
  >({})

  // Table toolbar state
  const [showTableToolbar, setShowTableToolbar] = useState(false)

  // Source view state
  const [isSourceView, setIsSourceView] = useState(false)
  const [sourceCode, setSourceCode] = useState('')

  // Store content when entering fullscreen to ensure persistence
  const [contentBackup, setContentBackup] = useState<string>('')

  // Sanitization notification state
  const [sanitizationWarning, setSanitizationWarning] = useState<string | null>(
    null
  )

  // Editor container references for positioning
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Tiptap binds onUpdate once at editor creation, so keep the values it needs
  // in refs that are refreshed on every render
  const onChangeRef = useRef(onChange)
  const isViewModeRef = useRef(isViewMode)
  const outputFormatRef = useRef<RichTextOutputFormat>(
    options.outputFormat || 'html'
  )
  onChangeRef.current = onChange
  isViewModeRef.current = isViewMode
  outputFormatRef.current = options.outputFormat || 'html'

  // Check if we're in dark mode
  const isDarkMode = document.documentElement.classList.contains('dark')

  // Safe HTML renderer for read-only mode
  const renderSafeHTML = (htmlContent: string) => {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return (
        <span className="text-gray-500 dark:text-gray-400 italic text-sm">
          {t('types.richtext.noContent')}
        </span>
      )
    }

    // Use the same sanitizer that's used for paste operations
    const cleanHTML = sanitizePastedContent(
      htmlContent,
      richtextDefinition.options?.pasteSecurity || SECURITY_PRESETS.safe
    )

    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100"
        dangerouslySetInnerHTML={{ __html: cleanHTML.sanitizedContent }}
        style={{
          // Apply the same styles as the editor for consistency
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
        }}
      />
    )
  }

  // Render read-only view
  if (isViewMode) {
    const stats = useMemo(() => {
      if (!value) return { words: 0, characters: 0, readTime: 0 }

      // Extract text content from HTML for stats
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = value
      const text = tempDiv.textContent || tempDiv.innerText || ''

      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      const characters = text.length
      const readTime = Math.ceil(words / 200)

      return { words, characters, readTime }
    }, [value])

    return (
      <div className="py-2">
        {value ? (
          <div className="space-y-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              {renderSafeHTML(value)}
            </div>

            {/* Stats display in read-only mode */}
            {options.showStats && (
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{stats.words} {t('types.richtext.stats.words')}</span>
                <span>
                  {stats.characters}
                  {characterLimit ? ` / ${characterLimit}` : ''} {t('types.richtext.stats.characters')}
                </span>
                <span>{stats.readTime} {t('types.richtext.stats.minRead')}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-400 italic text-sm">
            {t('types.richtext.noContent')}
          </span>
        )}
      </div>
    )
  }

  // Initialize Tiptap editor
  // Initialize Tiptap editor
  const editor: Editor | null = useEditor({
    extensions: createRichTextExtensions(options, characterLimit),
    content: (() => {
      // Get output format from options (default to 'html' for backwards compatibility)
      const outputFormat: RichTextOutputFormat = options.outputFormat || 'html'

      // Convert stored content to editor format (HTML or ProseMirror JSON)
      const editorContent = storageToEditorFormat(
        value as string | ProseMirrorDocument | undefined,
        outputFormat,
        studioContext?.mediaUrlGenerator || undefined
      )

      return editorContent || ''
    })(),
    editable: !isDisabled && !isReadonly,
    editorProps: {
      handlePaste: createPasteHandler(
        richtextDefinition,
        () => editor,
        setSanitizationWarning
      ),
    },
    onUpdate: ({ editor }) => {
      if (isViewModeRef.current || !onChangeRef.current) return

      // Get output format from options (default to 'html' for backwards compatibility)
      const outputFormat: RichTextOutputFormat = outputFormatRef.current

      // 🎯 CRITICAL: Transform content to specified format for storage
      const contentToSave = editorToStorageFormat(editor, outputFormat)

      logger.debug('Content updated and transformed for storage', {
        fieldId,
        outputFormat,
        contentType: typeof contentToSave,
        contentLength: typeof contentToSave === 'string' ? contentToSave.length : JSON.stringify(contentToSave).length,
      })

      onChangeRef.current(contentToSave)
    },
    onSelectionUpdate: ({ editor }) => {
      handleSelectionUpdate(editor)
    },
  })
  // Ensure editor content is synced when toggling fullscreen
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentContent = editor.getHTML()

      // Get output format from options (default to 'html' for backwards compatibility)
      const outputFormat: RichTextOutputFormat = options.outputFormat || 'html'

      // Transform stored content to editor format
      const editorContent = storageToEditorFormat(
        value as string | ProseMirrorDocument | undefined,
        outputFormat,
        studioContext?.mediaUrlGenerator || undefined
      )

      // Compare as strings (convert ProseMirror JSON to string if needed)
      const editorContentStr = typeof editorContent === 'string' ? editorContent : ''

      if (currentContent !== editorContentStr && editorContentStr) {
        editor.commands.setContent(editorContent, false) // false = don't emit update event
        logger.debug('Editor content synced with format conversion', {
          outputFormat,
          valueType: typeof value,
          editorContentType: typeof editorContent,
        })
      }
    }
  }, [editor, value, isFullscreen, studioContext?.mediaUrlGenerator, logger, options.outputFormat])

  // Update editor editable state when read-only props change
  useEffect(() => {
    if (editor) {
      const shouldBeEditable = !isDisabled && !isReadonly
      if (editor.isEditable !== shouldBeEditable) {
        editor.setEditable(shouldBeEditable)
      }
    }
  }, [editor, isDisabled, isReadonly])

  // Format operations
  const canUndo = editor?.can().undo() ?? false
  const canRedo = editor?.can().redo() ?? false

  // Handle selection updates to detect image selection and table context
  const handleSelectionUpdate = useCallback(
    (editor: any) => {
      const { selection } = editor.state

      // First, clear any existing manual selection attributes
      const allImages = editor.view.dom.querySelectorAll('img')
      allImages.forEach((img: HTMLImageElement) => {
        img.removeAttribute('data-selected')
      })

      // Check if an image node is selected
      if (
        selection instanceof NodeSelection &&
        selection.node.type.name === 'image'
      ) {
        const imageNode = selection.node
        const imageSrc = imageNode.attrs.src

        // Add manual selection attribute as fallback
        const selectedImg = editor.view.dom.querySelector(
          `img[src="${imageSrc}"]`
        )
        if (selectedImg) {
          selectedImg.setAttribute('data-selected', 'true')
          logger.debug('Image selected', { imageSrc })
        }

        setSelectedImageNode(imageNode)

        // Extract asset ID from the URL to load variants
        const assetIdMatch = imageSrc.match(/\/media\/([^\/]+)/)
        if (assetIdMatch && studioContext?.apiClient) {
          const assetId = assetIdMatch[1]

          // Load media metadata to get available variants
          studioContext.apiClient
            .getMediaById(assetId)
            .then(response => {
              if (
                response.success &&
                response.data?.file?.metadata?.imageVariants
              ) {
                setAvailableVariants(response.data.file.metadata.imageVariants)
              }
            })
            .catch(error => {
              logger.error('Failed to load image variants', error)
            })
        }

        // Show contextual toolbar (no positioning needed)
        setShowImageToolbar(true)
        setShowTableToolbar(false) // Hide table toolbar when image is selected
      } else {
        // No image selected, hide image toolbar
        setShowImageToolbar(false)
        setSelectedImageNode(null)
        setAvailableVariants({})

        // Check if cursor is inside a table
        const isInTable = editor.isActive('table')
        setShowTableToolbar(isInTable)

        if (isInTable) {
          logger.debug('Cursor is inside table, showing table toolbar')
        }
      }
    },
    [studioContext?.apiClient, logger]
  )

  // Toggle source view
  const toggleSourceView = useCallback(() => {
    if (!editor) return

    if (!isSourceView) {
      // Entering source view - get current HTML
      const html = editor.getHTML()
      setSourceCode(html)
      logger.debug('Entering source view', { htmlLength: html.length })
    } else {
      // Exiting source view - update editor with modified HTML
      try {
        editor.commands.setContent(sourceCode, false)
        onChange(sourceCode)
        logger.debug('Exiting source view, content updated', {
          htmlLength: sourceCode.length,
        })
      } catch (error) {
        logger.error('Failed to parse source HTML', error)
        // Keep the source view open if HTML is invalid
        return
      }
    }

    setIsSourceView(!isSourceView)
  }, [editor, isSourceView, sourceCode, onChange, logger])

  // Handle source code changes
  const handleSourceChange = useCallback((newSource: string) => {
    setSourceCode(newSource)
  }, [])

  // Fullscreen toggle with content backup
  const toggleFullscreen = useCallback(() => {
    if (!editor) return

    if (!isFullscreen) {
      // Entering fullscreen - backup current content
      const currentContent = editor.getHTML()
      setContentBackup(currentContent)
      logger.debug('Entering fullscreen, backed up content', {
        length: currentContent.length,
      })
    } else {
      // Exiting fullscreen - ensure content is preserved
      const currentContent = editor.getHTML()
      logger.debug('Exiting fullscreen, current content', {
        length: currentContent.length,
      })
      if (currentContent && currentContent !== contentBackup) {
        // Content changed in fullscreen, make sure it's saved
        onChange(currentContent)
      }
    }

    setIsFullscreen(!isFullscreen)
  }, [editor, isFullscreen, contentBackup, onChange])

  // Kept in a ref so the fullscreen effect below subscribes once instead of on
  // every render: re-subscribing moves the listener behind the dialog one and
  // churns the scroll lock.
  const toggleFullscreenRef = useRef(toggleFullscreen)
  toggleFullscreenRef.current = toggleFullscreen

  // Escape key handler for fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // A dialog opened from inside fullscreen (the link dialog) owns Escape:
      // stopPropagation cannot reach a listener already bound to document.
      if (isEscapeOwnedByDialog(event)) return
      toggleFullscreenRef.current()
    }

    document.addEventListener('keydown', handleEscape)
    // Share the ref-counted lock rather than writing document.body directly,
    // so a dialog underneath keeps its own lock.
    const releaseScroll = bodyScrollLock.lock()

    return () => {
      document.removeEventListener('keydown', handleEscape)
      releaseScroll()
    }
  }, [isFullscreen])

  // Add link functionality
  const openLinkDialog = useCallback(() => {
    if (!editor) return

    const selection = editor.state.selection
    const selectedText = editor.state.doc.textBetween(
      selection.from,
      selection.to
    )
    const existingLink = editor.getAttributes('link').href

    setLinkText(selectedText || '')
    setLinkUrl(existingLink || '')
    setShowLinkDialog(true)
  }, [editor])

  const handleLinkSubmit = useCallback(() => {
    if (!editor) return

    if (!linkUrl.trim()) {
      // Remove link if URL is empty
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      // Add or update link
      const selection = editor.state.selection
      const selectedText = editor.state.doc.textBetween(
        selection.from,
        selection.to
      )

      if (selectedText || linkText.trim()) {
        // If there's selected text or link text provided
        if (linkText.trim() && linkText !== selectedText) {
          // Replace selection with link text
          editor
            .chain()
            .focus()
            .deleteSelection()
            .insertContent(linkText)
            .setLink({ href: linkUrl })
            .run()
        } else {
          // Just add link to existing selection
          editor.chain().focus().setLink({ href: linkUrl }).run()
        }
      } else {
        // No selection, insert link text with URL
        const text = linkText.trim() || linkUrl
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${linkUrl}">${text}</a>`)
          .run()
      }
    }

    setShowLinkDialog(false)
    setLinkUrl('')
    setLinkText('')
  }, [editor, linkUrl, linkText])

  const {
    handleImageSelected,
    handleVariantChange,
    getCurrentVariant,
    handleDeleteImage,
  } = useRichTextImages({
    editor,
    studioContext,
    selectedImageNode,
    setSelectedImageNode,
    availableVariants,
    setAvailableVariants,
    setShowImageToolbar,
  })

  // Content statistics
  const stats = useMemo(() => {
    if (!editor) return { words: 0, characters: 0, readTime: 0 }

    const text = editor.state.doc.textContent
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const characters =
      editor.storage.characterCount?.characters() ?? text.length
    const readTime = Math.ceil(words / 200)

    return { words, characters, readTime }
  }, [editor?.state.doc, editor?.storage.characterCount])

  if (!editor) {
    return <div>{t('types.richtext.loadingEditor')}</div>
  }

  return (
    <>
      {/* Normal Mode */}
      {!isFullscreen && (
        <div
          className={`rich-text-field ${hasError ? 'border-l-4 border-red-400 dark:border-red-500 pl-4' : ''}`}
        >
          {/* Toolbar */}
          {!isReadonly && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-t-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 flex-wrap">
                  <RichTextFormatButtons
                    editor={editor}
                    isDisabled={isDisabled}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onOpenLinkDialog={openLinkDialog}
                    onInsertImage={() => {
                      if (studioContext?.utils?.showMediaBrowser) {
                        studioContext.utils.showMediaBrowser({
                          onSelect: handleImageSelected,
                          mediaTypeFilter: 'image',
                          showVariantSelector: true,
                          context: 'richtext-image',
                        })
                      }
                    }}
                  />
                </div>

                {/* Source view and Fullscreen toggles - separated on the right */}
                <div className="flex items-center gap-1">
                  {/* Source View Toggle */}
                  <ToolbarButton
                    onClick={toggleSourceView}
                    isActive={isSourceView}
                    isDisabled={isDisabled}
                    icon={SourceCodeIcon}
                    title={t('types.richtext.toolbar.viewEditSource')}
                  />

                  {/* Fullscreen toggle (if enabled) */}
                  {options.enableFullscreen && (
                    <ToolbarButton
                      onClick={toggleFullscreen}
                      isActive={isFullscreen}
                      isDisabled={isDisabled}
                      icon={ArrowsPointingOutIcon}
                      title={t('types.richtext.toolbar.fullscreen')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contextual Image Toolbar */}
          {!isReadonly && showImageToolbar && selectedImageNode && (
            <ImageToolbar
              className="border-l border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2"
              currentVariant={getCurrentVariant(selectedImageNode)}
              availableVariants={availableVariants}
              isDisabled={isDisabled}
              onVariantChange={handleVariantChange}
              onDeleteImage={handleDeleteImage}
            />
          )}

          {/* Contextual Table Toolbar */}
          {!isReadonly && showTableToolbar && editor && (
            <TableToolbar editor={editor} isDisabled={isDisabled} />
          )}

          {/* Sanitization Warning */}
          {sanitizationWarning && (
            <SanitizationWarning
              warning={sanitizationWarning}
              onDismiss={() => setSanitizationWarning(null)}
            />
          )}

          {/* Editor */}
          <InlineEditorSurface
            editor={editor}
            isSourceView={isSourceView}
            sourceCode={sourceCode}
            onSourceChange={handleSourceChange}
            isDisabled={isDisabled}
            isReadonly={isReadonly}
            isFullscreen={isFullscreen}
            editorContainerRef={editorContainerRef}
          />

          {/* Footer with stats */}
          {options.showStats && (
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>{stats.words} {t('types.richtext.stats.words')}</span>
                <span>
                  {stats.characters}
                  {characterLimit ? ` / ${characterLimit}` : ''} {t('types.richtext.stats.characters')}
                </span>
                <span>{stats.readTime} {t('types.richtext.stats.minRead')}</span>
              </div>
              {characterLimit && stats.characters > characterLimit && (
                <div className="text-red-500 dark:text-red-400">
                  {t('types.richtext.stats.exceedsLimit')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Link Dialog Modal */}
      {showLinkDialog && (
        <Dialog
          open={showLinkDialog}
          onClose={() => {
            setShowLinkDialog(false)
            setLinkUrl('')
            setLinkText('')
          }}
          variant="center"
          size="sm"
          title={t('types.richtext.linkDialog.title')}
        >
          <Dialog.Body>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('types.richtext.linkDialog.linkText')}
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  placeholder={t('types.richtext.linkDialog.linkTextPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 bg-white dark:bg-gray-700"
                  style={{
                    WebkitBoxShadow: isDarkMode
                      ? '0 0 0 1000px #374151 inset'
                      : '0 0 0 1000px white inset',
                    WebkitTextFillColor: isDarkMode ? '#ffffff' : '#111827',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('types.richtext.linkDialog.url')}
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder={t('types.richtext.linkDialog.urlPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 bg-white dark:bg-gray-700"
                  style={{
                    WebkitBoxShadow: isDarkMode
                      ? '0 0 0 1000px #374151 inset'
                      : '0 0 0 1000px white inset',
                    WebkitTextFillColor: isDarkMode ? '#ffffff' : '#111827',
                  }}
                />
              </div>
            </div>

          </Dialog.Body>
          <Dialog.Footer>
            <button
              type="button"
              onClick={() => {
                setShowLinkDialog(false)
                setLinkUrl('')
                setLinkText('')
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              {t('types.richtext.linkDialog.cancel')}
            </button>
            <button
              type="button"
              onClick={handleLinkSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              {linkUrl.trim() ? t('types.richtext.linkDialog.addLink') : t('types.richtext.linkDialog.removeLink')}
            </button>
          </Dialog.Footer>
        </Dialog>
      )}

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-overlay flex flex-col">
          {/* Fullscreen Toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                <RichTextFormatButtons
                  editor={editor}
                  isDisabled={isDisabled}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onOpenLinkDialog={openLinkDialog}
                  onInsertImage={() => {
                    if (studioContext?.utils?.showMediaBrowser) {
                      studioContext.utils.showMediaBrowser({
                        onSelect: handleImageSelected,
                        mediaTypeFilter: 'image',
                        showVariantSelector: true,
                        context: 'richtext-image',
                      })
                    }
                  }}
                />
              </div>

              {/* Close button */}
              <ToolbarButton
                onClick={toggleFullscreen}
                isActive={false}
                isDisabled={false}
                icon={XMarkIcon}
                title={t('types.richtext.toolbar.exitFullscreen')}
              />
            </div>
          </div>

          {/* Contextual Image Toolbar - Fullscreen */}
          {showImageToolbar && selectedImageNode && (
            <ImageToolbar
              className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2"
              currentVariant={getCurrentVariant(selectedImageNode)}
              availableVariants={availableVariants}
              isDisabled={isDisabled}
              onVariantChange={handleVariantChange}
              onDeleteImage={handleDeleteImage}
            />
          )}

          {/* Fullscreen Editor Container */}
          <FullscreenEditorSurface
            editor={editor}
            isSourceView={isSourceView}
            sourceCode={sourceCode}
            onSourceChange={handleSourceChange}
            isDisabled={isDisabled}
            isReadonly={isReadonly}
          />

          {/* Fullscreen Footer with stats */}
          {options.showStats && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 flex-shrink-0">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-6">
                  <span>{stats.words} {t('types.richtext.stats.words')}</span>
                  <span>
                    {stats.characters}
                    {characterLimit ? ` / ${characterLimit}` : ''} {t('types.richtext.stats.characters')}
                  </span>
                  <span>{stats.readTime} {t('types.richtext.stats.minRead')}</span>
                </div>
                {characterLimit && stats.characters > characterLimit && (
                  <div className="text-red-500 dark:text-red-400">
                    {t('types.richtext.stats.exceedsLimit')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Browser Modal - Now handled by Studio */}
    </>
  )
}
