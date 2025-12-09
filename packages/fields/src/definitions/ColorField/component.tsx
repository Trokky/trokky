/**
 * Color Field Component
 * React component for color selection with picker
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useT } from '@trokky/i18n'
import type { FieldComponentProps } from '../../base/index.js'
import type { ColorFieldDefinition } from './definition.js'
import { COLOR_FIELD_DEFAULTS } from './definition.js'

// Color utility functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

export function ColorFieldComponent({
  definition,
  value,
  onChange,
  error,
  isDisabled,
  isReadonly,
}: FieldComponentProps) {
  const { t } = useT('fields')

  // Defensive coding - ensure definition exists
  if (!definition) {
    console.error('ColorFieldComponent: definition is undefined')
    return (
      <div className="text-red-500">{t('errors.definitionMissing')}</div>
    )
  }

  const colorDef = definition as ColorFieldDefinition
  const options = { ...COLOR_FIELD_DEFAULTS, ...(colorDef.options || {}) }
  const validation = colorDef.validation || {}

  // State
  const [showPicker, setShowPicker] = useState(false)
  const [currentColor, setCurrentColor] = useState<string>(
    value || options.defaultValue || '#000000'
  )
  const [inputValue, setInputValue] = useState(currentColor)
  const pickerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle color change
  const handleColorChange = useCallback(
    (newColor: string) => {
      // Validate color
      if (
        validation.allowedColors &&
        !validation.allowedColors.includes(newColor)
      ) {
        return
      }
      if (
        validation.forbiddenColors &&
        validation.forbiddenColors.includes(newColor)
      ) {
        return
      }

      setCurrentColor(newColor)
      setInputValue(newColor)
      onChange(newColor)
    },
    [onChange, validation]
  )

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Validate hex format
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      handleColorChange(newValue)
    }
  }

  // Handle swatch click
  const handleSwatchClick = (color: string) => {
    handleColorChange(color)
    setShowPicker(false)
  }

  // Handle eyedropper (if supported)
  const handleEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-ignore - EyeDropper API is not in TypeScript types yet
        const eyeDropper = new window.EyeDropper()
        const result = await eyeDropper.open()
        handleColorChange(result.sRGBHex)
      } catch (e) {
        // User cancelled or error occurred
      }
    }
  }

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  // Update input when value changes externally
  useEffect(() => {
    if (value) {
      setCurrentColor(value)
      setInputValue(value)
    }
  }, [value])

  const isInteractive = !isDisabled && !isReadonly

  return (
    <div className="space-y-2">
      {/* Color preview and controls */}
      <div className="flex items-center gap-2">
        {/* Color preview button */}
        <button
          type="button"
          onClick={() => isInteractive && setShowPicker(!showPicker)}
          disabled={!isInteractive}
          className={`
            relative w-10 h-10 rounded-md border-2 border-gray-300 dark:border-gray-600
            ${isInteractive ? 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500' : 'cursor-not-allowed opacity-50'}
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
          `}
          style={{ backgroundColor: currentColor }}
          aria-label={t('types.color.openPicker')}
        >
          {/* Checkerboard for transparency */}
          {options.enableAlpha && (
            <div
              className="absolute inset-0 rounded-md opacity-25 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%),
                  linear-gradient(-45deg, #ccc 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #ccc 75%),
                  linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              }}
            />
          )}
        </button>

        {/* Color input */}
        {options.showInput && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            disabled={!isInteractive}
            placeholder="#000000"
            className={`
              flex-1 px-3 py-2 border rounded-md
              ${
                isInteractive
                  ? 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
              }
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition-colors font-mono text-sm
            `}
          />
        )}

        {/* Eyedropper button */}
        {options.enableEyedropper &&
          'EyeDropper' in window &&
          isInteractive && (
            <button
              type="button"
              onClick={handleEyedropper}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-md
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('types.color.pickFromScreen')}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                />
              </svg>
            </button>
          )}
      </div>

      {/* Color picker dropdown */}
      {showPicker && isInteractive && (
        <div ref={pickerRef} className="relative">
          <div
            className="absolute top-2 left-0 z-50 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl
            border border-gray-200 dark:border-gray-700"
          >
            {/* Native color picker */}
            <div className="mb-4">
              <input
                type="color"
                value={currentColor}
                onChange={e => handleColorChange(e.target.value)}
                className="w-full h-32 cursor-pointer rounded"
              />
            </div>

            {/* Swatches */}
            {options.swatches && options.swatches.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('types.color.quickColors')}
                </div>
                <div className="flex flex-wrap gap-2 max-w-sm">
                  {options.swatches.map((color: string) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleSwatchClick(color)}
                      className={`
                        w-6 h-6 rounded border-2 transition-all flex-shrink-0
                        ${
                          currentColor === color
                            ? 'border-blue-500 scale-110'
                            : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                        }
                      `}
                      style={{ backgroundColor: color }}
                      aria-label={t('types.color.selectColor', { color })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Format display */}
            {options.showFormatSwitcher && (
              <div className="mt-4 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono">
                <div>HEX: {currentColor}</div>
                {(() => {
                  const rgb = hexToRgb(currentColor)
                  if (rgb) {
                    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
                    return (
                      <>
                        <div>
                          RGB: rgb({rgb.r}, {rgb.g}, {rgb.b})
                        </div>
                        <div>
                          HSL: hsl({hsl.h}, {hsl.s}%, {hsl.l}%)
                        </div>
                      </>
                    )
                  }
                  return null
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}
