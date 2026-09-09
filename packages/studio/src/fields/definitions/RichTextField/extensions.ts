import StarterKit from '@tiptap/starter-kit'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import Image from '@tiptap/extension-image'
import {
  Table,
  TableRow,
  TableHeader as TableHeaderCell,
  TableCell,
} from '@tiptap/extension-table'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import type { RichTextFieldDefinition } from './definition'

const lowlight = createLowlight(common)

type RichTextOptions = NonNullable<RichTextFieldDefinition['options']>

/**
 * The Tiptap extension set the rich text editor runs on: the starter kit with
 * the pieces we configure ourselves disabled or tuned in place, plus images
 * carrying the Trokky asset attributes, tables and highlighted code blocks.
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
        // CodeBlockLowlight replaces the plain code block below.
        codeBlock: false,
        // v3's StarterKit adds a trailing paragraph node that v2's did not.
        // Keeping it off leaves the serialised HTML identical to what stored
        // content already looks like.
        trailingNode: false,
        // Underline, Link, Gapcursor and ListKeymap ship inside StarterKit as of
        // v3, so they are configured here rather than added as separate
        // extensions — registering them twice throws a duplicate-name error.
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class:
              'text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300',
          },
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
