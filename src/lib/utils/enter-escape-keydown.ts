import type { KeyboardEvent } from 'react'

// Enter/Escape dispatch for an inline editor's input, shared by the grid cells (EditableCellInput)
// and the section drawer so the two can't drift on which key does what. Both keys are swallowed:
// inside the grid the keypress would otherwise also drive react-datasheet-grid's selection
// underneath the cell, and matching that outside the grid keeps one behaviour to reason about.
export function enterEscapeKeyDown<ElementT extends HTMLElement>(handlers: {
  onEnter?: (event: KeyboardEvent<ElementT>) => void
  onEscape?: (event: KeyboardEvent<ElementT>) => void
}) {
  return (event: KeyboardEvent<ElementT>) => {
    const handler =
      event.key === 'Enter'
        ? handlers.onEnter
        : event.key === 'Escape'
          ? handlers.onEscape
          : undefined
    if (!handler) return
    event.preventDefault()
    event.stopPropagation()
    handler(event)
  }
}
