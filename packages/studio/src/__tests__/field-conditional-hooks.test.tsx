/**
 * Rules-of-hooks guard for the two editor fields.
 *
 * RichTextField and PortableTextField both used to place early returns (the
 * invalid-type guard and the read-only view) above hook calls, and RichTextField
 * called a useMemo from inside the read-only branch. That is only observable
 * once an already-mounted instance changes mode: React then sees a different
 * hook sequence and throws. These tests mount the real components and flip
 * `mode` / `isReadonly` / `definition.type` on the mounted instance, asserting
 * both that no hook error escapes and that each mode still renders what it did.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import type { FieldComponentProps } from '../fields/base/FieldPlugin'
import { RichTextFieldComponent } from '../fields/definitions/RichTextField/component'
import { PortableTextFieldComponent } from '../fields/definitions/PortableTextField/component'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const HOOK_ERROR = /hook/i

/**
 * React reports an illegal hook sequence by throwing, but a render error inside
 * act() is also written to console.error. Fail on both channels so a future
 * regression cannot be swallowed by an error boundary.
 */
function withHookErrorWatch<T>(run: () => T): T {
  const messages: string[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    for (const arg of args) {
      messages.push(String(arg instanceof Error ? arg.message : arg))
    }
  })
  // React 19 reports a render error that no boundary caught through a global
  // error event rather than console.error, so both channels are watched.
  const onWindowError = (event: ErrorEvent) => {
    messages.push(String(event.error instanceof Error ? event.error.message : event.message))
  }
  window.addEventListener('error', onWindowError)
  try {
    const result = run()
    const hookErrors = messages.filter(message => HOOK_ERROR.test(message))
    expect(hookErrors, `hook complaints: ${JSON.stringify(hookErrors)}`).toHaveLength(0)
    return result
  } finally {
    window.removeEventListener('error', onWindowError)
    spy.mockRestore()
  }
}

const richtextDefinition = (type = 'richtext') => ({
  name: 'body',
  title: 'Body',
  type,
  options: { showStats: true },
  validation: {},
}) as any

const portableDefinition = (type = 'portable') => ({
  name: 'body',
  title: 'Body',
  type,
  options: { showBlockCount: true, showCharacterCount: true, showWordCount: true },
  validation: {},
}) as any

const portableValue = {
  blocks: [
    {
      _key: 'b1',
      _type: 'block',
      style: 'normal',
      children: [{ _key: 's1', _type: 'span', text: 'Portable hello', marks: [] }],
      markDefs: [],
    },
  ],
}

function richtextProps(overrides: Partial<FieldComponentProps> = {}): FieldComponentProps {
  return {
    fieldId: 'body',
    value: '<p>Rich hello</p>',
    onChange: () => {},
    definition: richtextDefinition(),
    ...overrides,
  }
}

function portableProps(overrides: Partial<FieldComponentProps> = {}): FieldComponentProps {
  return {
    fieldId: 'body',
    value: portableValue,
    onChange: () => {},
    definition: portableDefinition(),
    ...overrides,
  }
}

/**
 * Registered before the mode-toggling suites on purpose. React logs its "change
 * in the order of Hooks" warning once per component per process, and the
 * invalid-type guard returns after a useContext-only prefix, which leaves the
 * fiber's hook list empty so React cannot additionally throw "rendered fewer
 * hooks". That warning is the only signal here, so this has to be the first
 * mismatch each component sees.
 */
describe('invalid definition type guard', () => {
  it('RichTextField renders the guard and recovers when the type is corrected', () => {
    withHookErrorWatch(() => {
      const { rerender } = render(
        <RichTextFieldComponent {...richtextProps({ definition: richtextDefinition('string') })} />
      )
      expect(document.body.textContent).toContain('invalidConfig')

      act(() => {
        rerender(<RichTextFieldComponent {...richtextProps({ mode: 'edit' })} />)
      })
      expect(document.body.textContent).not.toContain('invalidConfig')
      expect(richtextIsEditRendering()).toBe(true)
    })
  })

  it('PortableTextField renders the guard and recovers when the type is corrected', () => {
    withHookErrorWatch(() => {
      const { rerender } = render(
        <PortableTextFieldComponent {...portableProps({ definition: portableDefinition('string') })} />
      )
      expect(document.body.textContent).toContain('invalidFieldConfig')

      act(() => {
        rerender(<PortableTextFieldComponent {...portableProps({ mode: 'edit' })} />)
      })
      expect(document.body.textContent).not.toContain('invalidFieldConfig')
      expect(portableIsEditRendering()).toBe(true)
    })
  })
})

// --- RichTextField -----------------------------------------------------------

const richtextIsViewRendering = () =>
  !document.querySelector('.rich-text-field') &&
  !!document.querySelector('.prose') &&
  (document.body.textContent || '').includes('Rich hello')

const richtextIsEditRendering = () => !!document.querySelector('.rich-text-field')

describe('RichTextFieldComponent hook stability', () => {
  it('survives preview -> edit -> preview on a mounted instance', () => {
    withHookErrorWatch(() => {
      const { rerender } = render(<RichTextFieldComponent {...richtextProps({ mode: 'preview' })} />)
      expect(richtextIsViewRendering(), 'preview shows the read-only rendering').toBe(true)

      act(() => {
        rerender(<RichTextFieldComponent {...richtextProps({ mode: 'edit' })} />)
      })
      expect(richtextIsEditRendering(), 'edit shows the editable surface').toBe(true)

      act(() => {
        rerender(<RichTextFieldComponent {...richtextProps({ mode: 'preview' })} />)
      })
      expect(richtextIsViewRendering(), 'back to the read-only rendering').toBe(true)
    })
  })

  it('survives isReadonly toggling on a mounted instance', () => {
    withHookErrorWatch(() => {
      const { rerender } = render(
        <RichTextFieldComponent {...richtextProps({ mode: 'edit', isReadonly: false })} />
      )
      expect(richtextIsEditRendering()).toBe(true)

      act(() => {
        rerender(<RichTextFieldComponent {...richtextProps({ mode: 'edit', isReadonly: true })} />)
      })
      expect(richtextIsViewRendering()).toBe(true)

      act(() => {
        rerender(<RichTextFieldComponent {...richtextProps({ mode: 'edit', isReadonly: false })} />)
      })
      expect(richtextIsEditRendering()).toBe(true)
    })
  })

})

// --- PortableTextField -------------------------------------------------------

const portableIsViewRendering = () =>
  !document.querySelector('.portable-text-field') &&
  (document.body.textContent || '').includes('Portable hello')

const portableIsEditRendering = () =>
  !!document.querySelector('.portable-text-field') &&
  !!document.querySelector('[contenteditable]')

describe('PortableTextFieldComponent hook stability', () => {
  it('survives preview -> edit -> preview on a mounted instance', () => {
    withHookErrorWatch(() => {
      const { rerender } = render(<PortableTextFieldComponent {...portableProps({ mode: 'preview' })} />)
      expect(portableIsViewRendering(), 'preview shows the read-only rendering').toBe(true)

      act(() => {
        rerender(<PortableTextFieldComponent {...portableProps({ mode: 'edit' })} />)
      })
      expect(portableIsEditRendering(), 'edit shows the editable surface').toBe(true)

      act(() => {
        rerender(<PortableTextFieldComponent {...portableProps({ mode: 'preview' })} />)
      })
      expect(portableIsViewRendering(), 'back to the read-only rendering').toBe(true)
    })
  })

  it('survives isReadonly toggling on a mounted instance', () => {
    withHookErrorWatch(() => {
      const { rerender } = render(
        <PortableTextFieldComponent {...portableProps({ mode: 'edit', isReadonly: false })} />
      )
      expect(portableIsEditRendering()).toBe(true)

      act(() => {
        rerender(<PortableTextFieldComponent {...portableProps({ mode: 'edit', isReadonly: true })} />)
      })
      expect(portableIsViewRendering()).toBe(true)

      act(() => {
        rerender(<PortableTextFieldComponent {...portableProps({ mode: 'edit', isReadonly: false })} />)
      })
      expect(portableIsEditRendering()).toBe(true)
    })
  })

})

