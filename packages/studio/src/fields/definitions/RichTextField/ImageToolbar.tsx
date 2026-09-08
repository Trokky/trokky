import { PhotoIcon } from '@heroicons/react/24/outline'
import { useT } from '@trokky/trokky/i18n'
import { TrashIcon } from './icons'

interface ImageToolbarProps {
  className: string
  currentVariant: string
  availableVariants: Record<string, any>
  isDisabled?: boolean
  onVariantChange: (variantName: string) => void
  onDeleteImage: () => void
}

/**
 * The contextual strip shown while an image node is selected: pick a variant,
 * or drop the image. The inline and fullscreen editors frame it differently,
 * so the wrapper class comes in as a prop.
 */
export function ImageToolbar({
  className,
  currentVariant,
  availableVariants,
  isDisabled,
  onVariantChange,
  onDeleteImage,
}: ImageToolbarProps) {
  const { t } = useT('fields')

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhotoIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('types.richtext.imageToolbar.title')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Variant Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">
              {t('types.richtext.imageToolbar.variant')}
            </label>
            <select
              value={currentVariant}
              onChange={e => onVariantChange(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isDisabled}
            >
              <option value="original">{t('types.richtext.imageToolbar.original')}</option>
              {Object.entries(availableVariants).map(
                ([variantName, variantData]: [string, any]) => (
                  <option key={variantName} value={variantName}>
                    {variantName.charAt(0).toUpperCase() +
                      variantName.slice(1)}{' '}
                    ({variantData.width}×{variantData.height})
                  </option>
                )
              )}
            </select>
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={onDeleteImage}
            disabled={isDisabled}
            className="px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
            title={t('types.richtext.imageToolbar.deleteTitle')}
          >
            <TrashIcon className="w-4 h-4" />
            {t('types.richtext.imageToolbar.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
