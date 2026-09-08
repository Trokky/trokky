import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BREAKPOINTS,
  INERT_MARKER,
  OVERLAY_ROOT_ID,
  Z_OVERLAY,
  Z_OVERLAY_MAX,
  Z_STICKY,
  Z_TOAST,
  Z_DEBUG,
  acquireBackgroundInert,
  backgroundInertCount,
  createDialogStack,
  createScrollLock,
  dialogStack,
  hasOpenDialogs,
  isEscapeOwnedByDialog,
  minWidthQuery,
  setBackgroundInert,
  shouldRestoreFocus,
  watchBreakpoint,
  INERT_EXEMPT_ATTR,
} from '../components/ui/dialogInternals.js'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('dialog stack', () => {
  it('reports the last registered dialog as topmost', () => {
    const stack = createDialogStack()
    stack.push('a')
    expect(stack.isTopmost('a')).toBe(true)

    stack.push('b')
    expect(stack.isTopmost('a')).toBe(false)
    expect(stack.isTopmost('b')).toBe(true)
  })

  it('gives Escape back to the dialog underneath when the top one closes', () => {
    const stack = createDialogStack()
    stack.push('drawer')
    stack.push('picker')
    expect(stack.isTopmost('drawer')).toBe(false)

    stack.remove('picker')
    expect(stack.isTopmost('drawer')).toBe(true)
  })

  it('stacks nested dialogs at the overlay base plus their depth', () => {
    const stack = createDialogStack()
    stack.push('first')
    stack.push('second')
    stack.push('third')

    expect(stack.zIndexOf('first')).toBe(Z_OVERLAY)
    expect(stack.zIndexOf('second')).toBe(Z_OVERLAY + 1)
    expect(stack.zIndexOf('third')).toBe(Z_OVERLAY + 2)
  })

  it('never registers the same dialog twice', () => {
    const stack = createDialogStack()
    stack.push('a')
    stack.push('b')
    stack.push('a')

    expect(stack.ids()).toEqual(['b', 'a'])
    expect(stack.size()).toBe(2)
    expect(stack.isTopmost('a')).toBe(true)
  })

  it('reports no dialog as topmost when the stack is empty', () => {
    const stack = createDialogStack()
    expect(stack.isTopmost('a')).toBe(false)
    expect(stack.depthOf('a')).toBe(-1)
    expect(stack.zIndexOf('a')).toBe(Z_OVERLAY)
  })

  it('orders the layering tokens sticky < overlay < toast < debug', () => {
    expect(Z_STICKY).toBeLessThan(Z_OVERLAY)
    expect(Z_OVERLAY).toBeLessThan(Z_TOAST)
    expect(Z_TOAST).toBeLessThan(Z_DEBUG)
  })
})

describe('escape routing', () => {
  it('runs only the topmost dialog handler', () => {
    const stack = createDialogStack()
    const closed: string[] = []
    stack.push('drawer')
    stack.setEscapeHandler('drawer', () => closed.push('drawer'))
    stack.push('picker')
    stack.setEscapeHandler('picker', () => closed.push('picker'))

    expect(stack.handleEscape()).toBe(true)
    expect(closed).toEqual(['picker'])
  })

  it('falls through to the dialog underneath once the top one is gone', () => {
    const stack = createDialogStack()
    const closed: string[] = []
    stack.push('drawer')
    stack.setEscapeHandler('drawer', () => closed.push('drawer'))
    stack.push('picker')
    stack.setEscapeHandler('picker', () => closed.push('picker'))

    stack.handleEscape()
    stack.remove('picker')
    stack.handleEscape()

    expect(closed).toEqual(['picker', 'drawer'])
  })

  it('consumes Escape at a top dialog that opted out, without closing anything', () => {
    const stack = createDialogStack()
    const closed: string[] = []
    stack.push('drawer')
    stack.setEscapeHandler('drawer', () => closed.push('drawer'))
    stack.push('locked')
    stack.setEscapeHandler('locked', null)

    // The top dialog owns Escape even when it declines to close on it, so the
    // key must not fall through to the dialog underneath.
    expect(stack.handleEscape()).toBe(true)
    expect(closed).toEqual([])
  })

  it('gives Escape back to the dialog underneath once the locked one closes', () => {
    const stack = createDialogStack()
    const closed: string[] = []
    stack.push('drawer')
    stack.setEscapeHandler('drawer', () => closed.push('drawer'))
    stack.push('locked')
    stack.setEscapeHandler('locked', null)

    stack.handleEscape()
    stack.remove('locked')
    stack.handleEscape()

    expect(closed).toEqual(['drawer'])
  })

  it('reports nothing handled when no dialog is open', () => {
    expect(createDialogStack().handleEscape()).toBe(false)
  })

  it('drops the handler when the dialog is removed', () => {
    const stack = createDialogStack()
    stack.push('a')
    stack.setEscapeHandler('a', () => {
      throw new Error('should not run')
    })
    stack.remove('a')

    expect(stack.handleEscape()).toBe(false)
  })
})

describe('stack subscriptions', () => {
  it('notifies subscribers on push and remove', () => {
    const stack = createDialogStack()
    const listener = vi.fn()
    const unsubscribe = stack.subscribe(listener)

    stack.push('a')
    expect(listener).toHaveBeenCalledTimes(1)

    stack.remove('a')
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    stack.push('b')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not notify when removing a dialog that is not registered', () => {
    const stack = createDialogStack()
    const listener = vi.fn()
    stack.subscribe(listener)

    stack.remove('ghost')
    expect(listener).not.toHaveBeenCalled()
  })

  it('re-reads the z-index of the survivors when dialogs below them close', () => {
    const stack = createDialogStack()
    stack.push('a')
    stack.push('b')
    stack.push('c')
    expect(stack.zIndexOf('c')).toBe(Z_OVERLAY + 2)

    stack.remove('a')
    stack.remove('b')
    stack.push('d')

    // c must fall back to the base as the entries under it go, otherwise the
    // newly opened d would paint under a dialog the stack thinks it is above.
    expect(stack.zIndexOf('c')).toBe(Z_OVERLAY)
    expect(stack.zIndexOf('d')).toBe(Z_OVERLAY + 1)
    expect(stack.isTopmost('d')).toBe(true)
  })

  it('keeps every dialog under the toast layer no matter how deep the stack', () => {
    const stack = createDialogStack()
    const ids = Array.from({ length: 25 }, (_, index) => `dialog-${index}`)
    ids.forEach(id => stack.push(id))

    const highest = Math.max(...ids.map(id => stack.zIndexOf(id)))
    expect(highest).toBeLessThanOrEqual(Z_OVERLAY_MAX)
    expect(highest).toBeLessThan(Z_TOAST)
    // The band is wide enough that a realistic stack never has to clamp, so
    // two dialogs cannot end up sharing a z-index and painting out of order.
    expect(highest).toBe(Z_OVERLAY + ids.length - 1)
  })
})

describe('escape ownership', () => {
  afterEach(() => {
    dialogStack.ids().forEach(id => dialogStack.remove(id))
  })

  it('reports no owner while the process-wide stack is empty', () => {
    expect(hasOpenDialogs()).toBe(false)
    expect(isEscapeOwnedByDialog()).toBe(false)
  })

  it('claims Escape for the whole time a dialog is registered', () => {
    dialogStack.push('viewer')
    expect(hasOpenDialogs()).toBe(true)

    dialogStack.push('link')
    dialogStack.remove('link')
    // The viewer is still open, so the fullscreen editor underneath must not
    // treat this Escape as its own.
    expect(hasOpenDialogs()).toBe(true)

    dialogStack.remove('viewer')
    expect(hasOpenDialogs()).toBe(false)
  })
})

describe('focus restoration', () => {
  let trigger: HTMLButtonElement

  beforeEach(() => {
    trigger = document.createElement('button')
    document.body.appendChild(trigger)
  })

  afterEach(() => {
    trigger.remove()
  })

  it('restores focus when the closing dialog was the only one', () => {
    expect(shouldRestoreFocus(trigger, 0, 0)).toBe(true)
  })

  it('restores focus to the drawer when a picker opened from it closes', () => {
    // picker sat at depth 1, the drawer at depth 0 survives.
    expect(shouldRestoreFocus(trigger, 1, 1)).toBe(true)
  })

  it('leaves focus alone when a dialog above the closing one survives', () => {
    // the drawer sat at depth 0 and the picker above it is still open.
    expect(shouldRestoreFocus(trigger, 0, 1)).toBe(false)
  })

  it('skips an element that has left the document', () => {
    trigger.remove()
    expect(shouldRestoreFocus(trigger, 0, 0)).toBe(false)
  })

  it('skips when nothing was focused before the dialog opened', () => {
    expect(shouldRestoreFocus(null, 0, 0)).toBe(false)
  })
})

describe('breakpoint watching', () => {
  type QueryListener = (event: MediaQueryListEvent) => void

  const createList = (matches: boolean) => {
    const listeners = new Set<QueryListener>()
    let removeCalls = 0
    const list = {
      matches,
      addEventListener(_type: string, listener: QueryListener) {
        listeners.add(listener)
      },
      removeEventListener(_type: string, listener: QueryListener) {
        listeners.delete(listener)
        removeCalls += 1
      },
      removeCalls: () => removeCalls,
      fire(next: boolean) {
        list.matches = next
        listeners.forEach(listener => listener({ matches: next } as MediaQueryListEvent))
      },
    }
    return list
  }

  it('builds a min-width query for the drawer breakpoints', () => {
    expect(minWidthQuery(BREAKPOINTS.lg)).toBe('(min-width: 1024px)')
    expect(minWidthQuery(BREAKPOINTS.md)).toBe('(min-width: 768px)')
  })

  it('closes the drawer as soon as the viewport crosses the breakpoint', () => {
    const list = createList(false)
    const onMatch = vi.fn()
    watchBreakpoint('(min-width: 1024px)', onMatch, () => list as unknown as MediaQueryList)

    expect(onMatch).not.toHaveBeenCalled()

    list.fire(true)
    expect(onMatch).toHaveBeenCalledTimes(1)
  })

  it('closes immediately when the viewport is already past the breakpoint', () => {
    const list = createList(true)
    const onMatch = vi.fn()
    watchBreakpoint('(min-width: 1024px)', onMatch, () => list as unknown as MediaQueryList)

    expect(onMatch).toHaveBeenCalledTimes(1)
  })

  it('ignores crossings back below the breakpoint', () => {
    const list = createList(false)
    const onMatch = vi.fn()
    watchBreakpoint('(min-width: 1024px)', onMatch, () => list as unknown as MediaQueryList)

    list.fire(false)
    expect(onMatch).not.toHaveBeenCalled()
  })

  it('unsubscribes on release', () => {
    const list = createList(false)
    const stop = watchBreakpoint('(min-width: 1024px)', vi.fn(), () => list as unknown as MediaQueryList)

    stop()
    expect(list.removeCalls()).toBe(1)
  })

  it('is a no-op where matchMedia is unavailable', () => {
    const onMatch = vi.fn()
    expect(() => watchBreakpoint('(min-width: 1024px)', onMatch, () => null)()).not.toThrow()
    expect(onMatch).not.toHaveBeenCalled()
  })
})

describe('background inert', () => {
  let app: HTMLElement
  let overlays: HTMLElement

  beforeEach(() => {
    app = document.createElement('div')
    overlays = document.createElement('div')
    overlays.id = OVERLAY_ROOT_ID
    document.body.append(app, overlays)
  })

  afterEach(() => {
    setBackgroundInert(false)
    app.remove()
    overlays.remove()
  })

  it('hides the page behind the dialog from assistive technology', () => {
    setBackgroundInert(true)

    expect(app.hasAttribute('inert')).toBe(true)
    expect(app.getAttribute('aria-hidden')).toBe('true')
    expect(overlays.hasAttribute('inert')).toBe(false)
    expect(overlays.getAttribute('aria-hidden')).toBeNull()
  })

  it('releases exactly what it took', () => {
    setBackgroundInert(true)
    setBackgroundInert(false)

    expect(app.hasAttribute('inert')).toBe(false)
    expect(app.getAttribute('aria-hidden')).toBeNull()
    expect(app.hasAttribute(INERT_MARKER)).toBe(false)
  })

  it('leaves an element that was already inert for other reasons alone', () => {
    app.setAttribute('aria-hidden', 'true')
    setBackgroundInert(true)
    setBackgroundInert(false)

    expect(app.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the background inert until the last dialog closes', () => {
    const releaseOuter = acquireBackgroundInert()
    const releaseInner = acquireBackgroundInert()
    expect(backgroundInertCount()).toBe(2)

    releaseInner()
    expect(app.hasAttribute('inert')).toBe(true)

    releaseOuter()
    expect(app.hasAttribute('inert')).toBe(false)
    expect(backgroundInertCount()).toBe(0)
  })
})

describe('ref-counted scroll lock', () => {
  let target: HTMLElement

  beforeEach(() => {
    target = document.createElement('div')
  })

  it('locks on the first hold and restores on the last release', () => {
    const lock = createScrollLock(() => target)

    const release = lock.lock()
    expect(target.style.overflow).toBe('hidden')

    release()
    expect(target.style.overflow).toBe('')
    expect(lock.count()).toBe(0)
  })

  it('keeps the lock while a second dialog is still open', () => {
    const lock = createScrollLock(() => target)

    const releaseOuter = lock.lock()
    const releaseInner = lock.lock()
    expect(lock.count()).toBe(2)

    releaseInner()
    expect(target.style.overflow).toBe('hidden')

    releaseOuter()
    expect(target.style.overflow).toBe('')
  })

  it('restores the value the element had before the first lock', () => {
    target.style.overflow = 'scroll'
    const lock = createScrollLock(() => target)

    const releaseOuter = lock.lock()
    const releaseInner = lock.lock()
    releaseOuter()
    releaseInner()

    expect(target.style.overflow).toBe('scroll')
  })

  it('ignores a release that is called twice', () => {
    const lock = createScrollLock(() => target)

    const releaseOuter = lock.lock()
    const releaseInner = lock.lock()
    releaseInner()
    releaseInner()

    expect(lock.count()).toBe(1)
    expect(target.style.overflow).toBe('hidden')

    releaseOuter()
    expect(target.style.overflow).toBe('')
  })
})

/**
 * Every migrated call site must present through the Dialog primitive rather
 * than hand-rolling another full-screen overlay.
 */
const MIGRATED_CALL_SITES = [
  'components/ui/Modal.tsx',
  'components/ui/ConfirmDialog.tsx',
  'components/MediaBrowser.tsx',
  'components/SimpleSearchModal.tsx',
  'components/auth/ChangePasswordModal.tsx',
  'components/content/ChangeStatusModal.tsx',
  'components/document/DocumentSidebar.tsx',
  'components/layout/StudioLayout.tsx',
  'components/settings/MFASettings.tsx',
  'pages/MediaPage.tsx',
  'fields/components/FieldDrawer.tsx',
  'fields/definitions/IconField/component.tsx',
  'fields/definitions/MediaField/component.tsx',
  'fields/definitions/RichTextField/component.tsx',
  'fields/definitions/PortableTextField/component.tsx',
]

/**
 * The two editor fullscreen modes are in-place layout switches rather than
 * dialogs. They are exempt line by line so any other hand-rolled overlay,
 * however it is styled, still fails the check below.
 */
const EDITOR_FULLSCREEN_OVERLAYS: Record<string, string[]> = {
  'fields/definitions/RichTextField/component.tsx': [
    '<div className="fixed inset-0 bg-white dark:bg-gray-900 z-overlay flex flex-col">',
  ],
  'fields/definitions/PortableTextField/component.tsx': [
    "<div className={`portable-text-field ${isFullscreen ? 'fixed inset-0 z-overlay bg-white dark:bg-gray-900 flex flex-col p-4' : 'overflow-visible'}`}>",
  ],
}

const FIELD_DRAWER_CALL_SITES = [
  'fields/definitions/ObjectField/component.tsx',
  'fields/definitions/ArrayField/component.tsx',
]

describe('dialog registry', () => {
  it.each(MIGRATED_CALL_SITES)('%s imports the Dialog primitive', file => {
    const source = readFileSync(join(srcDir, file), 'utf8')
    expect(source).toMatch(/import \{ Dialog \} from/)
  })

  it.each(FIELD_DRAWER_CALL_SITES)('%s uses the shared FieldDrawer', file => {
    const source = readFileSync(join(srcDir, file), 'utf8')
    expect(source).toMatch(/import \{ FieldDrawer \} from/)
    expect(source).not.toContain('fixed inset-0')
  })

  it.each(MIGRATED_CALL_SITES)('%s defines no overlay of its own', file => {
    const source = readFileSync(join(srcDir, file), 'utf8')
    const allowed = EDITOR_FULLSCREEN_OVERLAYS[file] ?? []
    const overlays = source
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('fixed inset-0'))
      .filter(line => !allowed.includes(line))
    expect(overlays).toEqual([])
  })

  it('allows the editor fullscreen containers only where they still exist', () => {
    // Guards the exemption list itself: a stale entry would silently widen the
    // hole the "no overlay of its own" check is meant to close.
    Object.entries(EDITOR_FULLSCREEN_OVERLAYS).forEach(([file, lines]) => {
      const source = readFileSync(join(srcDir, file), 'utf8')
      lines.forEach(line => expect(source).toContain(line))
    })
  })
})

describe('escape and scroll ownership at the call sites', () => {
  it('the RichText fullscreen mode defers Escape to an open dialog', () => {
    const source = readFileSync(
      join(srcDir, 'fields/definitions/RichTextField/component.tsx'),
      'utf8'
    )
    expect(source).toContain('isEscapeOwnedByDialog(event)')
    expect(source).not.toContain('document.body.style.overflow')
    expect(source).toContain('bodyScrollLock.lock()')
  })

  it('the media viewer defers Escape to the dialog stack', () => {
    const source = readFileSync(join(srcDir, 'pages/MediaPage.tsx'), 'utf8')
    expect(source).toContain('isEscapeOwnedByDialog(e)')
  })

  it('no component writes the body overflow behind the ref-counted lock', () => {
    MIGRATED_CALL_SITES.forEach(file => {
      const source = readFileSync(join(srcDir, file), 'utf8')
      expect(source).not.toContain('body.style.overflow')
    })
  })
})

describe('responsive drawers', () => {
  it.each([
    ['components/layout/StudioLayout.tsx', 'BREAKPOINTS.lg'],
    ['components/document/DocumentSidebar.tsx', 'BREAKPOINTS.md'],
  ])('%s closes its drawer at %s', (file, breakpoint) => {
    const source = readFileSync(join(srcDir, file), 'utf8')
    expect(source).toContain(`watchBreakpoint(minWidthQuery(${breakpoint})`)
  })
})


describe('z band headroom', () => {
  it('gives the dialog stack far more depth than any UI reaches, still below toasts', () => {
    const stack = createDialogStack()
    for (let i = 0; i < 150; i++) stack.push(`d${i}`)
    expect(stack.zIndexOf('d149')).toBeLessThan(Z_TOAST)
    // distinct z for every realistic depth: no two dialogs tie
    expect(stack.zIndexOf('d10')).toBeGreaterThan(stack.zIndexOf('d9'))
    expect(stack.zIndexOf('d99')).toBeGreaterThan(stack.zIndexOf('d98'))
  })
})

describe('background inert ownership', () => {
  let host: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    setBackgroundInert(false)
    document.body.innerHTML = ''
  })

  it('exempts the notification layer so toasts stay usable', () => {
    const toasts = document.createElement('div')
    toasts.setAttribute(INERT_EXEMPT_ATTR, '')
    document.body.appendChild(toasts)

    setBackgroundInert(true)

    expect(host.hasAttribute('inert')).toBe(true)
    expect(toasts.hasAttribute('inert')).toBe(false)
    expect(toasts.getAttribute('aria-hidden')).toBeNull()
  })

  it('restores the previous aria-hidden instead of removing it', () => {
    host.setAttribute('aria-hidden', 'false')
    setBackgroundInert(true)
    expect(host.getAttribute('aria-hidden')).toBe('true')

    setBackgroundInert(false)
    expect(host.getAttribute('aria-hidden')).toBe('false')
  })

  it('leaves an inert attribute it did not set', () => {
    host.setAttribute('inert', '')
    setBackgroundInert(true)
    setBackgroundInert(false)
    expect(host.hasAttribute('inert')).toBe(true)
  })

  it('still makes an element inert when it was already aria-hidden', () => {
    host.setAttribute('aria-hidden', 'true')
    setBackgroundInert(true)
    expect(host.hasAttribute('inert')).toBe(true)
  })

  it('covers a body child added while a dialog is open', async () => {
    setBackgroundInert(true)
    const late = document.createElement('div')
    document.body.appendChild(late)

    // MutationObserver callbacks are microtasks
    await Promise.resolve()
    expect(late.hasAttribute('inert')).toBe(true)

    setBackgroundInert(false)
    expect(late.hasAttribute('inert')).toBe(false)
  })

  it('restores a child that was detached while inert', () => {
    setBackgroundInert(true)
    host.remove()
    setBackgroundInert(false)
    expect(host.hasAttribute('inert')).toBe(false)
    expect(host.hasAttribute('aria-hidden')).toBe(false)
  })
})
