import type { Editor } from '@tiptap/react'
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  LinkIcon,
  ListBulletIcon,
  NumberedListIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChatBubbleBottomCenterTextIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
import { useT } from '@trokky/trokky/i18n'
import { ToolbarButton, ToolbarSeparator } from './ToolbarButton'
import { H1Icon, H2Icon, H3Icon, TableIcon, CodeIcon } from './icons'

interface RichTextFormatButtonsProps {
  editor: Editor
  isDisabled?: boolean
  canUndo: boolean
  canRedo: boolean
  onOpenLinkDialog: () => void
  onInsertImage: () => void
}

/**
 * The formatting half of the toolbar. The same buttons serve the inline
 * editor and the fullscreen one, which differ only in what sits to their right.
 */
export function RichTextFormatButtons({
  editor,
  isDisabled,
  canUndo,
  canRedo,
  onOpenLinkDialog,
  onInsertImage,
}: RichTextFormatButtonsProps) {
  const { t } = useT('fields')

  return (
    <>
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        isDisabled={isDisabled}
        icon={BoldIcon}
        title={t('types.richtext.toolbar.bold')}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        isDisabled={isDisabled}
        icon={ItalicIcon}
        title={t('types.richtext.toolbar.italic')}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleUnderline().run()
        }
        isActive={editor.isActive('underline')}
        isDisabled={isDisabled}
        icon={UnderlineIcon}
        title={t('types.richtext.toolbar.underline')}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        isDisabled={isDisabled}
        icon={StrikethroughIcon}
        title={t('types.richtext.toolbar.strikethrough')}
      />

      <ToolbarSeparator />

      {/* Headings */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        isActive={editor.isActive('heading', { level: 1 })}
        isDisabled={isDisabled}
        icon={H1Icon}
        title={t('types.richtext.toolbar.heading1')}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        isActive={editor.isActive('heading', { level: 2 })}
        isDisabled={isDisabled}
        icon={H2Icon}
        title={t('types.richtext.toolbar.heading2')}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        isActive={editor.isActive('heading', { level: 3 })}
        isDisabled={isDisabled}
        icon={H3Icon}
        title={t('types.richtext.toolbar.heading3')}
      />

      <ToolbarSeparator />

      {/* Quote */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleBlockquote().run()
        }
        isActive={editor.isActive('blockquote')}
        isDisabled={isDisabled}
        icon={ChatBubbleBottomCenterTextIcon}
        title={t('types.richtext.toolbar.quote')}
      />

      <ToolbarSeparator />

      {/* Links */}
      <ToolbarButton
        onClick={onOpenLinkDialog}
        isActive={editor.isActive('link')}
        isDisabled={isDisabled}
        icon={LinkIcon}
        title={t('types.richtext.toolbar.addLink')}
      />

      {/* Images */}
      <ToolbarButton
        onClick={onInsertImage}
        isActive={false}
        isDisabled={isDisabled}
        icon={PhotoIcon}
        title={t('types.richtext.toolbar.insertImage')}
      />

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleBulletList().run()
        }
        isActive={editor.isActive('bulletList')}
        isDisabled={isDisabled}
        icon={ListBulletIcon}
        title={t('types.richtext.toolbar.bulletList')}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleOrderedList().run()
        }
        isActive={editor.isActive('orderedList')}
        isDisabled={isDisabled}
        icon={NumberedListIcon}
        title={t('types.richtext.toolbar.numberedList')}
      />

      <ToolbarSeparator />

      {/* Table */}
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        isDisabled={isDisabled}
        icon={TableIcon}
        title={t('types.richtext.toolbar.insertTable')}
      />

      {/* Code Block */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleCodeBlock().run()
        }
        isActive={editor.isActive('codeBlock')}
        isDisabled={isDisabled}
        icon={CodeIcon}
        title={t('types.richtext.toolbar.codeBlock')}
      />

      <ToolbarSeparator />

      {/* History */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        isDisabled={isDisabled || !canUndo}
        icon={ArrowUturnLeftIcon}
        title={t('types.richtext.toolbar.undo')}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        isDisabled={isDisabled || !canRedo}
        icon={ArrowUturnRightIcon}
        title={t('types.richtext.toolbar.redo')}
      />
    </>
  )
}
