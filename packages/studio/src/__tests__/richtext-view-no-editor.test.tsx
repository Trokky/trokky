/**
 * The read-only path must not construct a Tiptap editor.
 *
 * Tiptap offers no way to skip creating one, so an early return inside a single component
 * still pays for the full extension set on every preview mount. The guard is structural: the
 * editor lives in its own component, which read-only mode never renders. Nothing asserted
 * that before, which is how it regressed unnoticed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { RichTextFieldComponent } from '../fields/definitions/RichTextField/component'

const useEditorSpy = vi.fn()

vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual<typeof import('@tiptap/react')>('@tiptap/react')
  return {
    ...actual,
    useEditor: (...args: unknown[]) => {
      useEditorSpy(...args)
      return null
    },
  }
})

vi.mock('@trokky/trokky/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

function props(overrides: Record<string, unknown> = {}) {
  return {
    value: '<p>Some stored content</p>',
    onChange: vi.fn(),
    definition: { type: 'richtext', options: { showStats: true }, validation: {} },
    fieldId: 'body',
    isDisabled: false,
    isReadonly: false,
    studioContext: null,
    mode: 'edit',
    ...overrides,
  } as any
}

describe('RichTextField read-only rendering', () => {
  beforeEach(() => useEditorSpy.mockClear())

  it.each([
    ['preview mode', { mode: 'preview' }],
    ['readonly', { isReadonly: true }],
    ['disabled', { isDisabled: true }],
  ])('should not construct an editor when %s', (_label, overrides) => {
    render(<RichTextFieldComponent {...props(overrides)} />)
    expect(useEditorSpy).not.toHaveBeenCalled()
  })

  it('should still render the stored content in read-only mode', () => {
    const { container } = render(<RichTextFieldComponent {...props({ mode: 'preview' })} />)
    expect(container.textContent).toContain('Some stored content')
  })

  it('should construct an editor when the field is editable', () => {
    render(<RichTextFieldComponent {...props()} />)
    expect(useEditorSpy).toHaveBeenCalled()
  })
})
