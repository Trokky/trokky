import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeaderCell from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Gapcursor from '@tiptap/extension-gapcursor'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import type { RichTextFieldDefinition } from './definition'

const lowlight = createLowlight(common)

type RichTextOptions = NonNullable<RichTextFieldDefinition['options']>

/**
 * The Tiptap extension set the rich text editor runs on: the starter kit with
 * the pieces we configure ourselves disabled, plus links, images carrying the
 * Trokky asset attributes, tables and highlighted code blocks.
 */
export function createRichTextExtensions(
  options: RichTextOptions,
  characterLimit: number | undefined
) {
  return [
      StarterKit.configure({
        heading: {
          levels: (options.headingLevels || [1, 2, 3]) as any,
        },
        // Disable gapcursor and codeBlock from StarterKit since we add them manually
        gapcursor: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            'text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
        allowBase64: true,
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-trokky-id': {
              default: null,
              parseHTML: element => element.getAttribute('data-trokky-id'),
              renderHTML: attributes => {
                if (!attributes['data-trokky-id']) {
                  return {}
                }
                return { 'data-trokky-id': attributes['data-trokky-id'] }
              },
            },
            'data-trokky-variant': {
              default: null,
              parseHTML: element => element.getAttribute('data-trokky-variant'),
              renderHTML: attributes => {
                if (!attributes['data-trokky-variant']) {
                  return {}
                }
                return {
                  'data-trokky-variant': attributes['data-trokky-variant'],
                }
              },
            },
          }
        },
      }),
      Placeholder.configure({
        placeholder: options.placeholder || 'Start typing...',
      }),
      Gapcursor,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeaderCell,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'hljs',
        },
      }),
      ...(characterLimit
        ? [CharacterCount.configure({ limit: characterLimit })]
        : []),
  ]
}
