/**
 * Dialog - the single overlay primitive for the Studio.
 *
 * Every modal, drawer and sheet renders through this component. It portals into
 * `#studio-overlays` on document.body so no ancestor stacking context (a sticky
 * header, a transformed panel) can trap it, keeps the scroll on the Body rather
 * than the panel so popovers inside a dialog are not clipped, and stacks nested
 * dialogs through a process-wide stack so Escape and backdrop clicks only reach
 * the topmost one.
 */

import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useT } from '@trokky/trokky/i18n'
import { cn } from '@/utils/cn'
import {
  Z_OVERLAY,
  acquireEscapeListener,
  bodyScrollLock,
  dialogStack,
  getFocusableElements,
  getOverlayRoot,
} from './dialogInternals.js'

export type DialogVariant = 'center' | 'sheet' | 'drawer-right' | 'drawer-left' | 'fullscreen'
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type DialogHeight = 'auto' | 'fill'

export interface DialogProps {
  /** Whether the dialog is rendered. */
  open: boolean
  /** Called when the dialog requests to close (Escape, backdrop, close button). */
  onClose: () => void
  /** Placement and shape of the panel. */
  variant?: DialogVariant
  /** Max width of the panel from the `sm` breakpoint up. Ignored by `fullscreen`. */
  size?: DialogSize
  /** `fill` makes the panel take all available height instead of hugging content. */
  height?: DialogHeight
  /** Renders a default header and labels the dialog. */
  title?: React.ReactNode
  /** Renders under the title and describes the dialog. */
  description?: React.ReactNode
  /** Whether close affordances are shown. */
  dismissible?: boolean
  /** Close when the backdrop is clicked. */
  closeOnBackdrop?: boolean
  /** Close when Escape is pressed and this dialog is topmost. */
  closeOnEscape?: boolean
  /** Element to focus when the dialog opens. */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** Accessible name when no `title` is given. */
  ariaLabel?: string
  /** Surface classes for the panel (background). */
  surface?: string
  /** Extra classes for the panel. */
  className?: string
  /** Extra classes for the full-screen wrapper (backdrop layer). */
  wrapperClassName?: string
  children?: React.ReactNode
}

interface DialogContextValue {
  onClose: () => void
  dismissible: boolean
  titleId: string
  descriptionId: string
}

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog.Header, Dialog.Body and Dialog.Footer must be used inside a Dialog')
  }
  return context
}

const wrapperVariants: Record<DialogVariant, string> = {
  center: 'items-end sm:items-center justify-center p-0 sm:p-4',
  sheet: 'items-end justify-center p-0',
  'drawer-right': 'items-stretch justify-end',
  'drawer-left': 'items-stretch justify-start',
  fullscreen: 'items-stretch justify-center',
}

const panelVariants: Record<DialogVariant, string> = {
  center: 'rounded-t-lg sm:rounded-lg max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)]',
  sheet: 'rounded-t-lg max-h-[90dvh]',
  'drawer-right': 'h-[100dvh] max-h-[100dvh] shadow-2xl',
  'drawer-left': 'h-[100dvh] max-h-[100dvh] shadow-2xl',
  fullscreen: 'h-[100dvh] max-h-[100dvh]',
}

const fillVariants: Record<DialogVariant, string> = {
  center: 'h-[100dvh] sm:h-[calc(100dvh-2rem)]',
  sheet: 'h-[90dvh]',
  'drawer-right': '',
  'drawer-left': '',
  fullscreen: '',
}

const animationVariants: Record<DialogVariant, string> = {
  center: 'animate-in fade-in slide-in-from-bottom',
  sheet: 'animate-in slide-in-from-bottom',
  'drawer-right': 'animate-in slide-in-from-right-full',
  'drawer-left': 'animate-in slide-in-from-left-full',
  fullscreen: 'animate-in fade-in',
}

// Centred dialogs are full-bleed sheets below the sm breakpoint; drawers are
// edge-anchored, so they keep their width at every viewport.
const sizeClasses: Record<DialogSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-7xl',
}

const drawerSizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
}

export function Dialog({
  open,
  onClose,
  variant = 'center',
  size = 'md',
  height = 'auto',
  title,
  description,
  dismissible = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocus,
  ariaLabel,
  surface = 'bg-white dark:bg-gray-800',
  className,
  wrapperClassName,
  children,
}: DialogProps) {
  const generatedId = useId()
  const idRef = useRef(generatedId)
  const panelRef = useRef<HTMLDivElement>(null)
  const [zIndex, setZIndex] = useState(Z_OVERLAY)
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setOverlayRoot(getOverlayRoot())
  }, [])

  // Stack registration: depth decides both z-index and who owns Escape.
  useEffect(() => {
    if (!open) return
    const id = idRef.current
    dialogStack.push(id)
    setZIndex(dialogStack.zIndexOf(id))
    dialogStack.setEscapeHandler(id, closeOnEscape ? () => onCloseRef.current() : null)
    const releaseEscape = acquireEscapeListener()
    return () => {
      releaseEscape()
      dialogStack.remove(id)
    }
  }, [open, closeOnEscape])

  // Ref-counted scroll lock so nested dialogs do not fight over document.body.
  useEffect(() => {
    if (!open) return
    return bodyScrollLock.lock()
  }, [open])

  // Focus trap with focus return to whatever was focused before opening.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current

    const initial =
      initialFocus?.current || (panel ? getFocusableElements(panel)[0] : null) || panel
    initial?.focus?.()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      if (!dialogStack.isTopmost(idRef.current)) return
      const current = panelRef.current
      if (!current) return
      const focusable = getFocusableElements(current)
      const active = document.activeElement as HTMLElement | null
      if (focusable.length === 0) {
        event.preventDefault()
        current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const outside = !current.contains(active)
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [open, initialFocus])

  if (!open || !overlayRoot) return null

  const titleId = `${generatedId}-title`
  const descriptionId = `${generatedId}-description`

  const contextValue: DialogContextValue = {
    onClose,
    dismissible,
    titleId,
    descriptionId,
  }

  return createPortal(
    <DialogContext.Provider value={contextValue}>
      <div
        className={cn('fixed inset-0 flex', wrapperVariants[variant], wrapperClassName)}
        style={{ zIndex }}
        data-dialog-wrapper=""
      >
        <div
          className="absolute inset-0 bg-black/50 animate-in fade-in"
          onClick={closeOnBackdrop ? onClose : undefined}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title ? undefined : ariaLabel}
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          data-dialog-panel=""
          className={cn(
            'relative flex flex-col w-full min-h-0 shadow-xl focus:outline-none',
            surface,
            panelVariants[variant],
            height === 'fill' && fillVariants[variant],
            variant !== 'fullscreen' &&
              (variant === 'drawer-left' || variant === 'drawer-right'
                ? drawerSizeClasses[size]
                : sizeClasses[size]),
            animationVariants[variant],
            className
          )}
        >
          {title !== undefined && title !== null && (
            <DialogHeader>
              <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </DialogHeader>
          )}
          {children}
        </div>
      </div>
    </DialogContext.Provider>,
    overlayRoot
  )
}

export interface DialogHeaderProps {
  children?: React.ReactNode
  className?: string
  /** Apply the default padding. */
  padded?: boolean
  /** Show the close button (only when the dialog is dismissible). */
  showClose?: boolean
}

function DialogHeader({ children, className, padded = true, showClose = true }: DialogHeaderProps) {
  const { onClose, dismissible } = useDialogContext()
  const { t } = useT('studio')

  return (
    <div
      className={cn(
        'shrink-0 flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-700',
        padded && 'px-6 py-4',
        className
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {showClose && dismissible && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

export interface DialogBodyProps {
  children?: React.ReactNode
  className?: string
  /** Whether the body is the scroll container. Turn off for panels with their own scrollers. */
  scroll?: boolean
  /** Apply the default padding. */
  padded?: boolean
}

function DialogBody({ children, className, scroll = true, padded = true }: DialogBodyProps) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0',
        scroll ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
        padded && 'px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}

const footerJustify = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const

export interface DialogFooterProps {
  children?: React.ReactNode
  className?: string
  /** Apply the default padding. */
  padded?: boolean
  /** Horizontal alignment of the footer contents. */
  justify?: keyof typeof footerJustify
}

function DialogFooter({ children, className, padded = true, justify = 'end' }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'shrink-0 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700',
        footerJustify[justify],
        padded && 'px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}

Dialog.Header = DialogHeader
Dialog.Body = DialogBody
Dialog.Footer = DialogFooter

export default Dialog
