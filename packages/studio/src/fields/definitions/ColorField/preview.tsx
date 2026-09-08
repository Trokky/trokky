/**
 * Color Field Preview Component
 * Displays color value in list/grid views
 */

import type { FieldComponentProps } from '../../base/index.js'

export function ColorFieldPreview({ value }: FieldComponentProps) {
  if (!value) {
    return <span className="text-gray-400 dark:text-gray-500">No color</span>
  }

  return (
    <div className="flex items-center gap-2">
      {/* Color swatch */}
      <div
        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
        style={{ backgroundColor: value }}
        aria-label={value}
      />

      {/* Color code */}
      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
        {value}
      </span>
    </div>
  )
}
