import type { Editor } from '@tiptap/react'
import { useT } from '@trokky/trokky/i18n'
import {
  TableIcon,
  TrashIcon,
  PlusRowIcon,
  MinusRowIcon,
  PlusColumnIcon,
  MinusColumnIcon,
  HeaderIcon,
  MergeCellsIcon,
  SplitCellIcon,
} from './icons'

interface TableToolbarProps {
  editor: Editor
  isDisabled?: boolean
}

/**
 * The contextual strip shown while the caret sits inside a table.
 */
export function TableToolbar({ editor, isDisabled }: TableToolbarProps) {
  const { t } = useT('fields')

  return (
    <div className="border-l border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('types.richtext.tableToolbar.title')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Row */}
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={isDisabled || !editor.can().addRowAfter()}
            className="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.addRowAfter')}
          >
            <PlusRowIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.row')}
          </button>

          {/* Remove Row */}
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={isDisabled || !editor.can().deleteRow()}
            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.deleteRow')}
          >
            <MinusRowIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.row')}
          </button>

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

          {/* Add Column */}
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().addColumnAfter().run()
            }
            disabled={isDisabled || !editor.can().addColumnAfter()}
            className="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.addColumnAfter')}
          >
            <PlusColumnIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.col')}
          </button>

          {/* Remove Column */}
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={isDisabled || !editor.can().deleteColumn()}
            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.deleteColumn')}
          >
            <MinusColumnIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.col')}
          </button>

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

          {/* Toggle Header Row */}
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeaderRow().run()
            }
            disabled={isDisabled || !editor.can().toggleHeaderRow()}
            className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.toggleHeaderRow')}
          >
            <HeaderIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.header')}
          </button>

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

          {/* Merge Cells */}
          <button
            type="button"
            onClick={() => editor.chain().focus().mergeCells().run()}
            disabled={isDisabled || !editor.can().mergeCells()}
            className="px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.mergeSelectedCells')}
          >
            <MergeCellsIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.merge')}
          </button>

          {/* Split Cell */}
          <button
            type="button"
            onClick={() => editor.chain().focus().splitCell().run()}
            disabled={isDisabled || !editor.can().splitCell()}
            className="px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.splitCell')}
          >
            <SplitCellIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.split')}
          </button>

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

          {/* Delete Table */}
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            disabled={isDisabled || !editor.can().deleteTable()}
            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.tableToolbar.deleteTable')}
          >
            <TrashIcon className="w-3 h-3" />
            {t('types.richtext.tableToolbar.table')}
          </button>
        </div>
      </div>
    </div>
  )
}
