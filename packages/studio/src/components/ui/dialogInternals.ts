/**
 * Internals shared by the Dialog primitive.
 *
 * Kept free of React so the stacking and scroll-lock rules can be tested as
 * pure logic.
 */

/** Stacking tokens. Keep in sync with theme.extend.zIndex in tailwind.config.js. */
export const Z_STICKY = 40
export const Z_OVERLAY = 50
export const Z_TOAST = 60
export const Z_DEBUG = 100

/** Id of the container appended to document.body that every dialog portals into. */
export const OVERLAY_ROOT_ID = 'studio-overlays'

export interface DialogStack {
  /** Register a dialog as the new topmost entry. */
  push(id: string): void
  /** Remove a dialog from the stack. */
  remove(id: string): void
  /** Set (or clear with null) the Escape handler for a registered dialog. */
  setEscapeHandler(id: string, handler: (() => void) | null): void
  /** Invoke the topmost Escape handler. Returns whether one ran. */
  handleEscape(): boolean
  /** Position of the dialog in the stack, or -1 when it is not registered. */
  depthOf(id: string): number
  /** True when the dialog is the last registered one. */
  isTopmost(id: string): boolean
  /** Stacking value for the dialog: the overlay base plus its depth. */
  zIndexOf(id: string): number
  /** Number of open dialogs. */
  size(): number
  /** Registered ids, bottom first. */
  ids(): string[]
}

export function createDialogStack(): DialogStack {
  const stack: string[] = []
  const escapeHandlers = new Map<string, () => void>()

  const depthOf = (id: string) => stack.indexOf(id)

  return {
    push(id) {
      const existing = stack.indexOf(id)
      if (existing !== -1) {
        stack.splice(existing, 1)
      }
      stack.push(id)
    },
    remove(id) {
      const index = stack.indexOf(id)
      if (index !== -1) {
        stack.splice(index, 1)
      }
      escapeHandlers.delete(id)
    },
    setEscapeHandler(id, handler) {
      if (handler) {
        escapeHandlers.set(id, handler)
      } else {
        escapeHandlers.delete(id)
      }
    },
    handleEscape() {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const handler = escapeHandlers.get(stack[index])
        if (handler) {
          handler()
          return true
        }
      }
      return false
    },
    depthOf,
    isTopmost(id) {
      return stack.length > 0 && stack[stack.length - 1] === id
    },
    zIndexOf(id) {
      const depth = depthOf(id)
      return Z_OVERLAY + (depth < 0 ? 0 : depth)
    },
    size() {
      return stack.length
    },
    ids() {
      return [...stack]
    },
  }
}

/** Process-wide stack. Portalled dialogs are not React descendants of each other. */
export const dialogStack = createDialogStack()

export interface ScrollLock {
  /** Take a lock. Returns an idempotent release function. */
  lock(): () => void
  /** Number of locks currently held. */
  count(): number
}

/**
 * Ref-counted scroll lock. The first lock records the element's own inline
 * overflow value and the last release restores exactly that value, so two
 * dialogs opening and closing in any order cannot fight over it.
 */
export function createScrollLock(getTarget: () => HTMLElement | null | undefined): ScrollLock {
  let locks = 0
  let previousOverflow = ''

  return {
    lock() {
      const target = getTarget()
      if (locks === 0 && target) {
        previousOverflow = target.style.overflow
        target.style.overflow = 'hidden'
      }
      locks += 1

      let released = false
      return () => {
        if (released) return
        released = true
        locks -= 1
        if (locks === 0) {
          const current = getTarget()
          if (current) {
            current.style.overflow = previousOverflow
          }
        }
      }
    },
    count() {
      return locks
    },
  }
}

export const bodyScrollLock = createScrollLock(() =>
  typeof document === 'undefined' ? null : document.body
)

/**
 * A single document listener owns Escape for every open dialog.
 *
 * One listener per dialog would be fragile: discrete events are flushed
 * synchronously by React, so a dialog that closes mid-dispatch can promote the
 * one underneath before its own listener runs, and Escape would cascade.
 */
let escapeListeners = 0

function handleDocumentEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (dialogStack.handleEscape()) {
    event.stopPropagation()
  }
}

/** Installs the shared Escape listener while at least one dialog holds it. */
export function acquireEscapeListener(): () => void {
  if (escapeListeners === 0 && typeof document !== 'undefined') {
    document.addEventListener('keydown', handleDocumentEscape)
  }
  escapeListeners += 1

  let released = false
  return () => {
    if (released) return
    released = true
    escapeListeners -= 1
    if (escapeListeners === 0 && typeof document !== 'undefined') {
      document.removeEventListener('keydown', handleDocumentEscape)
    }
  }
}

/** Returns the `#studio-overlays` node, creating and appending it when absent. */
export function getOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  let root = document.getElementById(OVERLAY_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = OVERLAY_ROOT_ID
    document.body.appendChild(root)
  }
  return root
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Visible, tabbable descendants of `container`, in document order. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => element.offsetParent !== null || element === document.activeElement
  )
}
