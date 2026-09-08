import type { Editor } from '@tiptap/react'
import { sanitizePastedContent, SECURITY_PRESETS } from './sanitizer'
import { createStudioLogger } from '../../../utils/logger'
import type { RichTextFieldDefinition } from './definition'

const logger = createStudioLogger('RichTextField')

/**
 * The paste path: clipboard HTML goes through the sanitiser before Tiptap ever
 * sees it, and the editor is told what was stripped.
 */
export function createPasteHandler(
  richtextDefinition: RichTextFieldDefinition,
  getEditor: () => Editor | null,
  setSanitizationWarning: (warning: string | null) => void
) {
  return (_view: unknown, event: ClipboardEvent): boolean => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        const html = clipboardData.getData('text/html')

        // If there's HTML content, sanitize it
        if (html && html.trim()) {
          event.preventDefault()

          // Get paste security config from field options or use safe default
          const pasteConfig =
            richtextDefinition.options?.pasteSecurity || SECURITY_PRESETS.safe

          // Sanitize the pasted content
          const result = sanitizePastedContent(html, pasteConfig)

          logger.debug('Paste sanitization result', {
            originalLength: result.originalContent.length,
            sanitizedLength: result.sanitizedContent.length,
            wasModified: result.wasModified,
            warningCount: result.warnings.length,
          })

          // Show warning if content was modified and warnings are enabled
          if (
            result.wasModified &&
            pasteConfig.showSanitizationWarning &&
            result.warnings.length > 0
          ) {
            const warningMessage = `Content was sanitized for security: ${result.warnings.slice(0, 3).join(', ')}${result.warnings.length > 3 ? '...' : ''}`
            setSanitizationWarning(warningMessage)

            // Auto-hide warning after 5 seconds
            setTimeout(() => setSanitizationWarning(null), 5000)
          }

          // Use setTimeout to ensure the editor is ready and insert content properly
          setTimeout(() => {
            // Access the editor from the Tiptap instance
            const currentEditor = getEditor()
            if (currentEditor && result.sanitizedContent) {
              // Use Tiptap's insertContent command which properly handles HTML
              currentEditor.commands.insertContent(result.sanitizedContent)
            } else if (currentEditor) {
              // Fallback to plain text if sanitization removed everything
              const plainText = clipboardData.getData('text/plain')
              if (plainText) {
                currentEditor.commands.insertContent(plainText)
              }
            }
          }, 0)

          return true // Prevent default paste
        }

        // For plain text or when HTML sanitization isn't needed, allow default behavior
        return false
  }
}
