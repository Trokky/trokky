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

/**
 * Highest stacking value a dialog may take. The overlay band is 50-59 so a
 * deeply nested stack can never reach the toast layer.
 */
export const Z_OVERLAY_MAX = Z_TOAST - 1

/** Id of the container appended to document.body that every dialog portals into. */
export const OVERLAY_ROOT_ID = 'studio-overlays'

export interface DialogStack {
  /** Register a dialog as the new topmost entry. */
  push(id: string): void
  /** Remove a dialog from the stack. */
  remove(id: string): void
  /** Set (or clear with null) the Escape handler for a registered dialog. */
  setEscapeHandler(id: string, handler: (() => void) | null): void
  /**
   * Give Escape to the topmost dialog. Returns whether the event was consumed:
   * the top dialog owns Escape even when it opted out of closing on it, so the
   * key never falls through to the dialog underneath.
   */
  handleEscape(): boolean
  /** Position of the dialog in the stack, or -1 when it is not registered. */
  depthOf(id: string): number
  /** True when the dialog is the last registered one. */
  isTopmost(id: string): boolean
  /** Stacking value for the dialog: the overlay base plus its depth, clamped. */
  zIndexOf(id: string): number
  /** Number of open dialogs. */
  size(): number
  /** Registered ids, bottom first. */
  ids(): string[]
  /** Bumped on every push and remove so subscribers can re-read their depth. */
  version(): number
  /** Run `listener` whenever the stack changes. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void
}

export function createDialogStack(): DialogStack {
  const stack: string[] = []
  const escapeHandlers = new Map<string, () => void>()
  const listeners = new Set<() => void>()
  let version = 0

  const depthOf = (id: string) => stack.indexOf(id)

  const notify = () => {
    version += 1
    listeners.forEach(listener => listener())
  }

  return {
    push(id) {
      const existing = stack.indexOf(id)
      if (existing !== -1) {
        stack.splice(existing, 1)
      }
      stack.push(id)
      notify()
    },
    remove(id) {
      const index = stack.indexOf(id)
      if (index !== -1) {
        stack.splice(index, 1)
      }
      escapeHandlers.delete(id)
      if (index !== -1) {
        notify()
      }
    },
    setEscapeHandler(id, handler) {
      if (handler) {
        escapeHandlers.set(id, handler)
      } else {
        escapeHandlers.delete(id)
      }
    },
    handleEscape() {
      if (stack.length === 0) return false
      const handler = escapeHandlers.get(stack[stack.length - 1])
      if (handler) {
        handler()
      }
      return true
    },
    depthOf,
    isTopmost(id) {
      return stack.length > 0 && stack[stack.length - 1] === id
    },
    zIndexOf(id) {
      const depth = depthOf(id)
      return Math.min(Z_OVERLAY + (depth < 0 ? 0 : depth), Z_OVERLAY_MAX)
    },
    size() {
      return stack.length
    },
    ids() {
      return [...stack]
    },
    version() {
      return version
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Process-wide stack. Portalled dialogs are not React descendants of each other. */
export const dialogStack = createDialogStack()

/**
 * True while any dialog is open.
 *
 * Document-level Escape handlers that are not dialogs (the RichText fullscreen
 * mode, the media viewer's arrow-key navigation) must bail out when this is
 * true: `stopPropagation` cannot stop listeners already bound to `document`,
 * so ownership has to be checked rather than enforced.
 */
export function hasOpenDialogs(): boolean {
  return dialogStack.size() > 0
}

/** Escape events the dialog stack has already acted on. */
const consumedEscapes = new WeakSet<KeyboardEvent>()

/**
 * Whether this Escape belongs to a dialog and the caller must leave it alone.
 *
 * Checking the stack alone is not enough. Sibling listeners on `document` run
 * in registration order, and a handler that re-subscribes on every render (the
 * RichText fullscreen one used to) ends up running after the dialog listener.
 * By then React has flushed the close synchronously and the stack is already
 * empty, so the event itself has to carry the fact that a dialog consumed it.
 */
export function isEscapeOwnedByDialog(event?: KeyboardEvent): boolean {
  if (event && consumedEscapes.has(event)) return true
  return hasOpenDialogs()
}

/**
 * Whether a closing dialog may hand focus back to the element it stole it from.
 *
 * `closedDepth` is the depth the dialog held just before it left the stack and
 * `remainingCount` the stack size just after. A surviving entry at or above
 * that index was stacked on top of the closing dialog and must keep focus.
 */
export function shouldRestoreFocus(
  element: Element | null | undefined,
  closedDepth: number,
  remainingCount: number
): boolean {
  if (!element) return false
  if (!element.isConnected) return false
  if (closedDepth >= 0 && remainingCount > closedDepth) return false
  return true
}

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
    consumedEscapes.add(event)
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

/** Marks the nodes this module made inert so it never clears somebody else's. */
export const INERT_MARKER = 'data-dialog-inert'

/**
 * Opts a body child out of being made inert. The notification layer carries it:
 * toasts sit above dialogs and must stay dismissible and announceable.
 */
export const INERT_EXEMPT_ATTR = 'data-dialog-exempt'

/** What an element looked like before we made it inert, so we can put it back. */
interface InertRecord {
  hadInert: boolean
  previousAriaHidden: string | null
}

/**
 * Elements this module made inert, with their prior state. Keyed by the node
 * itself so a child detached while a dialog is open is still restored.
 */
const inertRecords = new Map<Element, InertRecord>()
let inertObserver: MutationObserver | null = null

function isExemptFromInert(child: Element): boolean {
  return child.id === OVERLAY_ROOT_ID || child.hasAttribute(INERT_EXEMPT_ATTR)
}

function makeInert(child: Element): void {
  if (isExemptFromInert(child) || inertRecords.has(child)) return
  inertRecords.set(child, {
    hadInert: child.hasAttribute('inert'),
    previousAriaHidden: child.getAttribute('aria-hidden'),
  })
  child.setAttribute(INERT_MARKER, '')
  child.setAttribute('inert', '')
  child.setAttribute('aria-hidden', 'true')
}

function restoreInert(child: Element, record: InertRecord): void {
  child.removeAttribute(INERT_MARKER)
  // Only clear `inert` if we are the ones who set it.
  if (!record.hadInert) child.removeAttribute('inert')
  if (record.previousAriaHidden === null) {
    child.removeAttribute('aria-hidden')
  } else {
    child.setAttribute('aria-hidden', record.previousAriaHidden)
  }
}

/**
 * Makes everything outside the overlay root inert while a dialog is open.
 *
 * `aria-modal` alone does not stop a screen reader's virtual cursor in every
 * browser, so the page behind gets `inert` (with an `aria-hidden` fallback for
 * engines that do not support it yet). Children added while a dialog is open
 * are covered too, because React portals mount into the body at any time.
 */
export function setBackgroundInert(inert: boolean, root?: HTMLElement | null): void {
  const container = root ?? (typeof document === 'undefined' ? null : document.body)
  if (!container) return

  if (inert) {
    Array.from(container.children).forEach(makeInert)

    if (!inertObserver && typeof MutationObserver !== 'undefined') {
      inertObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(node => {
            if (node instanceof Element) makeInert(node)
          })
        }
      })
      inertObserver.observe(container, { childList: true })
    }
    return
  }

  inertObserver?.disconnect()
  inertObserver = null
  // Map.forEach yields (value, key), so the record comes before the element.
  inertRecords.forEach((record, child) => restoreInert(child, record))
  inertRecords.clear()
}

let inertHolders = 0

/** Holds the background inert while at least one dialog is open. */
export function acquireBackgroundInert(): () => void {
  if (inertHolders === 0) {
    setBackgroundInert(true)
  }
  inertHolders += 1

  let released = false
  return () => {
    if (released) return
    released = true
    inertHolders -= 1
    if (inertHolders === 0) {
      setBackgroundInert(false)
    }
  }
}

/** Number of dialogs currently holding the background inert. */
export function backgroundInertCount(): number {
  return inertHolders
}

/** Tailwind breakpoints used by the responsive drawers, in pixels. */
export const BREAKPOINTS = {
  md: 768,
  lg: 1024,
} as const

/** Media query matching viewports at or above `px`. */
export function minWidthQuery(px: number): string {
  return `(min-width: ${px}px)`
}

export type MediaMatcher = (query: string) => MediaQueryList | null

const defaultMediaMatcher: MediaMatcher = query =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia(query)

/**
 * Calls `onMatch` while the viewport matches `query`, once on setup and again
 * on every crossing into the query.
 *
 * Drawers that CSS hides above a breakpoint must actually close there: left
 * open they would keep their stack registration, scroll lock and Tab trap while
 * invisible.
 */
export function watchBreakpoint(
  query: string,
  onMatch: () => void,
  matchMedia: MediaMatcher = defaultMediaMatcher
): () => void {
  const list = matchMedia(query)
  if (!list) return () => {}

  if (list.matches) {
    onMatch()
  }

  const listener = (event: MediaQueryListEvent) => {
    if (event.matches) {
      onMatch()
    }
  }

  list.addEventListener('change', listener)
  return () => list.removeEventListener('change', listener)
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
