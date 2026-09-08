import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  Z_OVERLAY,
  Z_STICKY,
  Z_TOAST,
  Z_DEBUG,
  createDialogStack,
  createScrollLock,
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

  it('skips dialogs that opted out of Escape', () => {
    const stack = createDialogStack()
    const closed: string[] = []
    stack.push('drawer')
    stack.setEscapeHandler('drawer', () => closed.push('drawer'))
    stack.push('locked')
    stack.setEscapeHandler('locked', null)

    expect(stack.handleEscape()).toBe(true)
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
    const overlays = source.split('\n').filter(line => line.includes('fixed inset-0'))
    // The editor fullscreen modes are in-place layout switches, not dialogs.
    const dialogOverlays = overlays.filter(line => !line.includes('flex flex-col'))
    expect(dialogOverlays).toEqual([])
  })
})
