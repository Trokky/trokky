/**
 * Guard for the caret the portable text field restores after every keystroke.
 *
 * `handleBlockInput` rewrites the block's text through React, which drops the
 * caret, so it puts the caret back inside a requestAnimationFrame. It used to
 * look for the text node at `editableDiv.firstChild.firstChild` - a wrapper
 * depth the block row does not render - so it never found one, fell back to a
 * bare focus(), and every following character was inserted at offset 0: typing
 * "abc" produced "cba". This mounts the real field and types character by
 * character the way a browser does, so that regression cannot come back.
 */
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

import { PortableTextFieldComponent } from '../fields/definitions/PortableTextField/component'

function Harness() {
  const [value, setValue] = React.useState<unknown>(undefined)
  return (
    <PortableTextFieldComponent
      fieldId="body"
      value={value}
      onChange={(next: unknown) => setValue(next)}
      definition={{ type: 'portable', title: 'Body', options: {} } as any}
      mode="edit"
    />
  )
}

function editable(): HTMLElement {
  const el = document.querySelector('[contenteditable="true"]') as HTMLElement
  expect(el, 'contenteditable block').toBeTruthy()
  return el
}

/**
 * Where a browser would put the caret: the collapsed selection if it sits
 * inside the block, otherwise the start - which is where a bare focus() on a
 * contenteditable leaves it.
 */
function caretOffset(el: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0
  const range = selection.getRangeAt(0)
  const node = range.startContainer
  if (node !== el && !el.contains(node)) return 0
  return range.startOffset
}

async function typeCharacter(character: string) {
  const el = editable()
  const offset = caretOffset(el)
  const text = el.textContent || ''

  await act(async () => {
    // The browser splices the character in at the caret and leaves the caret
    // just after it, then fires `input`.
    el.textContent = text.slice(0, offset) + character + text.slice(offset)
    const range = document.createRange()
    range.setStart(el.firstChild!, offset + 1)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  // The field restores the caret in a requestAnimationFrame.
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('PortableTextField caret restoration', () => {
  it('should keep typed characters in the order they were typed', async () => {
    render(<Harness />)

    await typeCharacter('a')
    await typeCharacter('b')
    await typeCharacter('c')

    expect(editable().textContent).toBe('abc')
  })
})
