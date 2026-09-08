/**
 * Behavioural tests for the Dialog primitive.
 *
 * The stacking rules are covered as pure logic in dialog.test.ts; what is left
 * only shows up once a dialog is actually mounted: initial focus, the Tab trap,
 * focus return, live z-index and the inert background.
 */

import { useRef } from 'react'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { Dialog } from '../components/ui/Dialog.js'
import {
  OVERLAY_ROOT_ID,
  Z_OVERLAY,
  dialogStack,
  isEscapeOwnedByDialog,
} from '../components/ui/dialogInternals.js'

// jsdom performs no layout, so every element reports offsetParent === null and
// the focusable filter would drop the whole panel contents.
let originalOffsetParent: PropertyDescriptor | undefined

beforeAll(() => {
  originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? this.parentElement : null
    },
  })
})

afterAll(() => {
  if (originalOffsetParent) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent)
  }
})

afterEach(() => {
  cleanup()
  document.getElementById(OVERLAY_ROOT_ID)?.remove()
  document.body.innerHTML = ''
})

const panels = () => Array.from(document.querySelectorAll<HTMLElement>('[data-dialog-panel]'))
const wrappers = () => Array.from(document.querySelectorAll<HTMLElement>('[data-dialog-wrapper]'))

const pressKey = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  act(() => {
    document.dispatchEvent(event)
  })
  return event
}

describe('initial focus', () => {
  it('moves focus into the panel on the first render', () => {
    render(
      <Dialog open onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>
          <button type="button">Pick</button>
        </Dialog.Body>
      </Dialog>
    )

    // The overlay root only resolves after the first commit, so the panel does
    // not exist while the mount effects run: focus has to follow the panel.
    expect(document.activeElement).toBe(document.querySelector('[data-dialog-panel] button'))
  })

  it('falls back to the panel when nothing inside is focusable', () => {
    render(
      <Dialog open onClose={() => {}} ariaLabel="empty">
        <Dialog.Body>nothing here</Dialog.Body>
      </Dialog>
    )

    expect(document.activeElement).toBe(panels()[0])
  })

  it('honours an explicit initialFocus', () => {
    function WithInitialFocus() {
      const input = useRef<HTMLInputElement>(null)
      return (
        <Dialog open onClose={() => {}} ariaLabel="search" initialFocus={input}>
          <Dialog.Body>
            <button type="button">First</button>
            <input ref={input} aria-label="query" />
          </Dialog.Body>
        </Dialog>
      )
    }

    render(<WithInitialFocus />)
    expect(document.activeElement).toBe(document.querySelector('input'))
  })
})

describe('focus trap', () => {
  it('wraps Tab from the last focusable back to the first', () => {
    render(
      <Dialog open onClose={() => {}} ariaLabel="trap">
        <Dialog.Body>
          <button type="button">First</button>
          <button type="button">Last</button>
        </Dialog.Body>
      </Dialog>
    )

    const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-dialog-panel] button'))
    buttons[buttons.length - 1].focus()

    const event = pressKey('Tab')
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[0])
  })

  it('wraps Shift+Tab from the first focusable back to the last', () => {
    render(
      <Dialog open onClose={() => {}} ariaLabel="trap">
        <Dialog.Body>
          <button type="button">First</button>
          <button type="button">Last</button>
        </Dialog.Body>
      </Dialog>
    )

    const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-dialog-panel] button'))
    buttons[0].focus()

    pressKey('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
  })

  it('pulls focus back in when it escaped to the page behind', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)

    render(
      <Dialog open onClose={() => {}} ariaLabel="trap">
        <Dialog.Body>
          <button type="button">Inside</button>
        </Dialog.Body>
      </Dialog>
    )

    outside.focus()
    pressKey('Tab')
    expect(document.activeElement).toBe(document.querySelector('[data-dialog-panel] button'))
  })

  it('stops trapping Tab once the dialog closes', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)

    const view = render(
      <Dialog open onClose={() => {}} ariaLabel="trap">
        <Dialog.Body>
          <button type="button">Inside</button>
        </Dialog.Body>
      </Dialog>
    )

    view.rerender(
      <Dialog open={false} onClose={() => {}} ariaLabel="trap">
        <Dialog.Body>
          <button type="button">Inside</button>
        </Dialog.Body>
      </Dialog>
    )

    outside.focus()
    const event = pressKey('Tab')
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(outside)
  })
})

describe('escape', () => {
  it('closes the topmost dialog and leaves the one underneath open', () => {
    const closeDrawer = vi.fn()
    const closePicker = vi.fn()

    render(
      <>
        <Dialog open onClose={closeDrawer} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>drawer</Dialog.Body>
        </Dialog>
        <Dialog open onClose={closePicker} ariaLabel="picker">
          <Dialog.Body>picker</Dialog.Body>
        </Dialog>
      </>
    )

    pressKey('Escape')
    expect(closePicker).toHaveBeenCalledTimes(1)
    expect(closeDrawer).not.toHaveBeenCalled()
  })

  it('closes nothing when the top dialog opted out of Escape', () => {
    const closeDrawer = vi.fn()
    const closeLocked = vi.fn()

    render(
      <>
        <Dialog open onClose={closeDrawer} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>drawer</Dialog.Body>
        </Dialog>
        <Dialog open onClose={closeLocked} closeOnEscape={false} ariaLabel="locked">
          <Dialog.Body>locked</Dialog.Body>
        </Dialog>
      </>
    )

    pressKey('Escape')
    expect(closeLocked).not.toHaveBeenCalled()
    expect(closeDrawer).not.toHaveBeenCalled()
  })

  it('keeps Escape away from a fullscreen handler already bound to document', () => {
    // Mirrors the RichText fullscreen listener: stopPropagation cannot stop a
    // listener that is already on document, so it checks ownership instead.
    const exitFullscreen = vi.fn()
    const fullscreenListener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isEscapeOwnedByDialog()) return
      exitFullscreen()
    }
    document.addEventListener('keydown', fullscreenListener)

    const view = render(
      <Dialog open onClose={() => {}} ariaLabel="link">
        <Dialog.Body>link</Dialog.Body>
      </Dialog>
    )

    pressKey('Escape')
    expect(exitFullscreen).not.toHaveBeenCalled()

    view.rerender(
      <Dialog open={false} onClose={() => {}} ariaLabel="link">
        <Dialog.Body>link</Dialog.Body>
      </Dialog>
    )

    pressKey('Escape')
    expect(exitFullscreen).toHaveBeenCalledTimes(1)

    document.removeEventListener('keydown', fullscreenListener)
  })

  it('keeps Escape away from a fullscreen handler bound after the dialog opened', () => {
    // The fullscreen effect re-subscribes whenever its callback identity
    // changes, which puts it behind the dialog listener. By the time it runs,
    // React has already flushed the close and the stack is empty, so the guard
    // has to recognise the event itself.
    const exitFullscreen = vi.fn()
    let dialogOpen = true
    const Harness = () => (
      <Dialog open={dialogOpen} onClose={() => {}} ariaLabel="link">
        <Dialog.Body>link</Dialog.Body>
      </Dialog>
    )

    const view = render(<Harness />)

    // Close the dialog the moment the stack handles Escape, exactly as React
    // does for a discrete event, then let the trailing listener run.
    const closingListener = () => {
      dialogOpen = false
      view.rerender(<Harness />)
    }
    document.addEventListener('keydown', closingListener)

    const fullscreenListener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isEscapeOwnedByDialog(event)) return
      exitFullscreen()
    }
    document.addEventListener('keydown', fullscreenListener)

    pressKey('Escape')
    expect(dialogStack.size()).toBe(0)
    expect(exitFullscreen).not.toHaveBeenCalled()

    document.removeEventListener('keydown', closingListener)
    document.removeEventListener('keydown', fullscreenListener)
  })
})

describe('focus return', () => {
  it('gives focus back to the trigger when the last dialog closes', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const view = render(
      <Dialog open onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>picker</Dialog.Body>
      </Dialog>
    )
    expect(document.activeElement).not.toBe(trigger)

    view.rerender(
      <Dialog open={false} onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>picker</Dialog.Body>
      </Dialog>
    )
    expect(document.activeElement).toBe(trigger)
  })

  it('returns focus to the drawer when a dialog opened from it closes', () => {
    const view = render(
      <>
        <Dialog open onClose={() => {}} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>
            <button type="button">Open picker</button>
          </Dialog.Body>
        </Dialog>
        <Dialog open={false} onClose={() => {}} ariaLabel="picker">
          <Dialog.Body>picker</Dialog.Body>
        </Dialog>
      </>
    )

    const drawerTrigger = document.querySelector<HTMLElement>('[data-dialog-panel] button')
    expect(document.activeElement).toBe(drawerTrigger)

    // The picker opens from inside the drawer, the way the field pickers do.
    view.rerender(
      <>
        <Dialog open onClose={() => {}} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>
            <button type="button">Open picker</button>
          </Dialog.Body>
        </Dialog>
        <Dialog open onClose={() => {}} ariaLabel="picker">
          <Dialog.Body>picker</Dialog.Body>
        </Dialog>
      </>
    )
    expect(document.activeElement).not.toBe(drawerTrigger)

    view.rerender(
      <>
        <Dialog open onClose={() => {}} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>
            <button type="button">Open picker</button>
          </Dialog.Body>
        </Dialog>
        <Dialog open={false} onClose={() => {}} ariaLabel="picker">
          <Dialog.Body>picker</Dialog.Body>
        </Dialog>
      </>
    )

    expect(document.activeElement).toBe(drawerTrigger)
  })

  it('does not steal focus from a dialog that is still open above', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const view = render(
      <>
        <Dialog open onClose={() => {}} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>drawer</Dialog.Body>
        </Dialog>
        <Dialog open onClose={() => {}} ariaLabel="picker">
          <Dialog.Body>picker</Dialog.Body>
        </Dialog>
      </>
    )

    const pickerPanel = panels()[1]

    view.rerender(
      <>
        <Dialog open={false} onClose={() => {}} variant="drawer-right" ariaLabel="drawer">
          <Dialog.Body>drawer</Dialog.Body>
        </Dialog>
        <Dialog open onClose={() => {}} ariaLabel="picker">
          <Dialog.Body>picker</Dialog.Body>
        </Dialog>
      </>
    )

    expect(document.activeElement).not.toBe(trigger)
    expect(document.activeElement).toBe(pickerPanel)
  })
})

describe('live stacking', () => {
  const stackOf = (open: boolean[]) => (
    <>
      {open.map((isOpen, index) => (
        <Dialog key={index} open={isOpen} onClose={() => {}} ariaLabel={`dialog-${index}`}>
          <Dialog.Body>{`dialog-${index}`}</Dialog.Body>
        </Dialog>
      ))}
    </>
  )

  it('re-reads the rendered z-index when dialogs below close', () => {
    const view = render(stackOf([true, true, true, false]))
    expect(wrappers().map(node => node.style.zIndex)).toEqual([
      String(Z_OVERLAY),
      String(Z_OVERLAY + 1),
      String(Z_OVERLAY + 2),
    ])

    // Close the two below, then open a fourth: the survivor has to fall back to
    // the base or the newcomer would paint underneath it.
    view.rerender(stackOf([false, false, true, true]))
    expect(wrappers().map(node => node.style.zIndex)).toEqual([
      String(Z_OVERLAY),
      String(Z_OVERLAY + 1),
    ])
    expect(dialogStack.size()).toBe(2)
  })
})

describe('background inert', () => {
  it('marks the page behind inert while a dialog is open and releases it after', () => {
    const view = render(
      <Dialog open onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>picker</Dialog.Body>
      </Dialog>
    )

    const overlayRoot = document.getElementById(OVERLAY_ROOT_ID)
    const background = Array.from(document.body.children).filter(child => child !== overlayRoot)
    expect(background.length).toBeGreaterThan(0)
    background.forEach(child => {
      expect(child.hasAttribute('inert')).toBe(true)
      expect(child.getAttribute('aria-hidden')).toBe('true')
    })
    expect(overlayRoot?.hasAttribute('inert')).toBe(false)

    view.rerender(
      <Dialog open={false} onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>picker</Dialog.Body>
      </Dialog>
    )
    background.forEach(child => expect(child.hasAttribute('inert')).toBe(false))
  })
})

describe('scroll lock', () => {
  it('locks the body while open and restores it on close', () => {
    const view = render(
      <Dialog open onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>picker</Dialog.Body>
      </Dialog>
    )
    expect(document.body.style.overflow).toBe('hidden')

    view.rerender(
      <Dialog open={false} onClose={() => {}} ariaLabel="picker">
        <Dialog.Body>picker</Dialog.Body>
      </Dialog>
    )
    expect(document.body.style.overflow).toBe('')
  })
})
