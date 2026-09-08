import React from 'react'

// Toolbar button component
export function ToolbarButton({
  onClick,
  isActive = false,
  isDisabled = false,
  icon: Icon,
  title,
}: {
  onClick: () => void
  isActive?: boolean
  isDisabled?: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className={`
        p-2 rounded transition-colors
        ${
          isActive
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-900 dark:hover:text-white'}
      `}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

// Toolbar separator
export function ToolbarSeparator() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
}
