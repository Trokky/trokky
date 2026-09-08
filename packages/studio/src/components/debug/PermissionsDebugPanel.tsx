/**
 * Permissions Debug Panel
 * Shows current user permissions and field states for debugging
 */

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@trokky/trokky/i18n'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

interface FieldPermissionInfo {
  fieldName: string
  isDisabled: boolean
  isReadonly: boolean
  isRequired: boolean
  hasError: boolean
  value: any
  permissions?: {
    canRead: boolean
    canWrite: boolean
    canDelete: boolean
  }
}

interface PermissionsDebugPanelProps {
  documentType: string
  documentId?: string
  fields?: FieldPermissionInfo[]
  isNew?: boolean
  canCreate?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}

export function PermissionsDebugPanel({
  documentType,
  documentId,
  fields = [],
  isNew = false,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}: PermissionsDebugPanelProps) {
  const { t } = useT('studio')
  const { user } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFieldDetails, setShowFieldDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  // Initialize debug mode with localStorage check
  const [isDebugMode] = useState(() => {
    const debugEnabled =
      import.meta.env.DEV === true ||
      (typeof window !== 'undefined' &&
        window.localStorage.getItem('trokky_debug_permissions') === 'true')

    return debugEnabled
  })

  // Show panel if debug mode is enabled
  if (!isDebugMode) {
    return null
  }

  const userPermissions = {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    isAdmin: user?.role === 'admin',
  }

  // Copy all debug info to clipboard
  const copyDebugInfo = () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      user: {
        username: user?.username,
        email: user?.email,
        role: user?.role,
        isAdmin: userPermissions.isAdmin,
      },
      document: {
        type: documentType,
        id: documentId,
        isNew,
      },
      permissions: {
        canCreate,
        canUpdate,
        canDelete,
        canRead: userPermissions.canRead,
      },
      fields: fields.map(field => ({
        name: field.fieldName,
        isDisabled: field.isDisabled,
        isReadonly: field.isReadonly,
        isRequired: field.isRequired,
        hasError: field.hasError,
        value:
          field.value === undefined
            ? 'undefined'
            : field.value === null
              ? 'null'
              : typeof field.value === 'object'
                ? JSON.stringify(field.value)
                : String(field.value),
      })),
    }

    const text = JSON.stringify(debugInfo, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-debug max-w-md"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-blue-500">
        {/* Header */}
        <div className="flex items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                {t('permissionsDebug.title')}
              </span>
              {user?.role && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {user.role}
                </span>
              )}
            </div>
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={copyDebugInfo}
            className="px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l border-gray-200 dark:border-gray-600"
            title={t('permissionsDebug.copyToClipboard')}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* User Info */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {t('permissionsDebug.currentUser')}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('permissionsDebug.username')}
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {user?.username || t('permissionsDebug.notLoggedIn')}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('permissionsDebug.email')}
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {user?.email || t('permissionsDebug.notAvailable')}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('permissionsDebug.role')}
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {user?.role || t('permissionsDebug.guest')}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('permissionsDebug.admin')}
                  </span>
                  <span className="font-mono">
                    {userPermissions.isAdmin ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ {t('permissionsDebug.yes')}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        ✗ {t('permissionsDebug.no')}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Permissions */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {t('permissionsDebug.documentPermissions')}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('permissionsDebug.type')}
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {documentType}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{t('permissionsDebug.id')}</span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {documentId || (isNew ? t('permissionsDebug.newDocument') : t('permissionsDebug.notAvailable'))}
                  </span>
                </div>
                <div className="pt-2 space-y-1 border-t border-gray-200 dark:border-gray-700">
                  <PermissionRow label={t('permissionsDebug.canCreate')} value={canCreate} t={t} />
                  <PermissionRow label={t('permissionsDebug.canUpdate')} value={canUpdate} t={t} />
                  <PermissionRow label={t('permissionsDebug.canDelete')} value={canDelete} t={t} />
                  <PermissionRow
                    label={t('permissionsDebug.canRead')}
                    value={userPermissions.canRead}
                    t={t}
                  />
                </div>
              </div>
            </div>

            {/* Field States */}
            {fields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    {t('permissionsDebug.fieldStates', { count: fields.length })}
                  </h3>
                  <button
                    onClick={() => setShowFieldDetails(!showFieldDetails)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showFieldDetails ? t('permissionsDebug.hideDetails') : t('permissionsDebug.showDetails')}
                  </button>
                </div>

                {showFieldDetails && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 space-y-2 max-h-48 overflow-y-auto">
                    {fields.map((field, index) => (
                      <div
                        key={index}
                        className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0"
                      >
                        <div className="font-mono text-xs text-gray-900 dark:text-white mb-1">
                          {field.fieldName}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                          <FieldState
                            label={t('permissionsDebug.disabled')}
                            value={field.isDisabled}
                          />
                          <FieldState
                            label={t('permissionsDebug.readonly')}
                            value={field.isReadonly}
                          />
                          <FieldState
                            label={t('permissionsDebug.required')}
                            value={field.isRequired}
                          />
                          <FieldState
                            label={t('permissionsDebug.hasError')}
                            value={field.hasError}
                          />
                          <div className="col-span-2 mt-1">
                            <span className="text-gray-600 dark:text-gray-400">
                              {t('permissionsDebug.value')}{' '}
                            </span>
                            <span className="font-mono text-gray-700 dark:text-gray-300">
                              {field.value === undefined
                                ? 'undefined'
                                : field.value === null
                                  ? 'null'
                                  : typeof field.value === 'object'
                                    ? JSON.stringify(field.value).slice(0, 30) +
                                      '...'
                                    : String(field.value).slice(0, 30)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Debug Actions */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <InformationCircleIcon className="w-4 h-4" />
                <span>
                  {import.meta.env.DEV
                    ? t('permissionsDebug.debugModeDev')
                    : t('permissionsDebug.debugModeManual')}
                </span>
              </div>
              <button
                onClick={() => {
                  const currentState =
                    localStorage.getItem('trokky_debug_permissions') === 'true'
                  localStorage.setItem(
                    'trokky_debug_permissions',
                    (!currentState).toString()
                  )
                  window.location.reload()
                }}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {localStorage.getItem('trokky_debug_permissions') === 'true'
                  ? t('permissionsDebug.disableInProduction')
                  : t('permissionsDebug.enableInProduction')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PermissionRow({ label, value, t }: { label: string; value: boolean; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600 dark:text-gray-400">{label}:</span>
      <div className="flex items-center gap-1">
        {value ? (
          <>
            <ShieldCheckIcon className="w-3 h-3 text-green-500" />
            <span className="text-green-600 dark:text-green-400 font-medium">
              {t('permissionsDebug.allowed')}
            </span>
          </>
        ) : (
          <>
            <ShieldExclamationIcon className="w-3 h-3 text-red-500" />
            <span className="text-red-600 dark:text-red-400 font-medium">
              {t('permissionsDebug.denied')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function FieldState({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-600 dark:text-gray-400">{label}:</span>
      <span
        className={
          value
            ? 'text-orange-600 dark:text-orange-400 font-medium'
            : 'text-gray-500 dark:text-gray-500'
        }
      >
        {value ? '✓' : '–'}
      </span>
    </div>
  )
}
