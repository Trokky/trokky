import { XMarkIcon } from '@heroicons/react/24/outline'
import { useT } from '@trokky/trokky/i18n'

interface SanitizationWarningProps {
  warning: string
  onDismiss: () => void
}

/**
 * The strip that tells the editor what the paste sanitiser removed.
 */
export function SanitizationWarning({ warning, onDismiss }: SanitizationWarningProps) {
  const { t } = useT('fields')

  return (
            <div className="border-l border-r border-yellow-200 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-yellow-600 dark:text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 15.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    {warning}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                  title={t('types.richtext.sanitization.dismissWarning')}
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
  )
}
